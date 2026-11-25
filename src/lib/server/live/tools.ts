import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import {
	confirmationPolicySchema,
	defaultConfirmationPolicy,
	requiresConfirmation
} from '$lib/config/settings';
import { evaluateToolCall, toolCallTargets } from '$lib/home/ha-policy';
import type { LiveToolResponse } from '$lib/live/protocol';
import { errorName, logEvent } from '$lib/server/log';
import { McpGatewayError, type HomeAssistantGateway } from '$lib/server/mcp/gateway';
import { mcpConnectionSchema } from '$lib/server/mcp/request';

const APPROVAL_TTL_MS = 5 * 60_000;
const FUNCTION_NAME = /^[a-zA-Z0-9_-]{1,64}$/;
const UNKNOWN_OUTCOME =
	'The request to Home Assistant failed and the outcome of this change is unknown. Do not retry it automatically; ask the user to check the device.';

export interface LiveFunctionTool {
	type: 'function';
	name: string;
	description: string;
	parameters: unknown;
	strict: false;
}

/** Responses function definitions for the allowlisted MCP tools. Execution stays in this application. */
export async function liveFunctionTools(
	gateway: Pick<HomeAssistantGateway, 'toolDefinitions'>,
	allowMutations: boolean
): Promise<LiveFunctionTool[]> {
	const definitions = await gateway.toolDefinitions({ allowMutations });
	return definitions
		.filter((tool) => FUNCTION_NAME.test(tool.name))
		.map((tool) => ({
			type: 'function',
			name: tool.name,
			description: (tool.description ?? '').slice(0, 1024),
			parameters: tool.inputSchema ?? { type: 'object', properties: {} },
			strict: false
		}));
}

export const liveToolRequestSchema = z.object({
	sessionId: z.string().min(1).max(200),
	callId: z.string().min(1).max(200),
	name: z.string().regex(FUNCTION_NAME),
	arguments: z.string().max(16_000),
	mcp: mcpConnectionSchema,
	confirmation: confirmationPolicySchema.optional(),
	approval: z.object({ token: z.string().min(1).max(512), approved: z.boolean() }).optional()
});

export type LiveToolRequest = z.infer<typeof liveToolRequestSchema>;
type ApprovalClaims = Pick<LiveToolRequest, 'sessionId' | 'callId' | 'name' | 'arguments'>;

function sign(secret: string, claims: ApprovalClaims, expiresAt: number): string {
	return createHmac('sha256', secret)
		.update(
			JSON.stringify([
				'home-agent.live-approval.v1',
				claims.sessionId,
				claims.callId,
				claims.name,
				createHash('sha256').update(claims.arguments).digest('hex'),
				expiresAt
			])
		)
		.digest('base64url');
}

/** The token carries no claims: it only verifies against the exact call it was issued for. */
export function issueApprovalToken(secret: string, claims: ApprovalClaims, expiresAt: number) {
	return `${expiresAt}.${sign(secret, claims, expiresAt)}`;
}

export function verifyApprovalToken(
	secret: string,
	claims: ApprovalClaims,
	token: string,
	now: number
): boolean {
	const separator = token.indexOf('.');
	const expiresAt = Number(token.slice(0, separator));
	if (separator < 1 || !Number.isSafeInteger(expiresAt) || expiresAt <= now) return false;
	const expected = Buffer.from(sign(secret, claims, expiresAt));
	const actual = Buffer.from(token.slice(separator + 1));
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// Single use is enforced per server process only; several instances would need shared storage.
const usedApprovals = new Map<string, number>();

function consumeApproval(token: string, now: number): boolean {
	for (const [used, expiresAt] of usedApprovals) {
		if (expiresAt <= now) usedApprovals.delete(used);
	}
	if (usedApprovals.has(token)) return false;
	usedApprovals.set(token, Number(token.slice(0, token.indexOf('.'))));
	return true;
}

function parseArguments(raw: string): Record<string, unknown> | undefined {
	try {
		const parsed: unknown = JSON.parse(raw.trim() || '{}');
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

export interface LiveToolDependencies {
	connect: () => Promise<Pick<HomeAssistantGateway, 'callTool' | 'close'>>;
	allowMutations: boolean;
	approvalSecret: string;
	requestId: string;
	now?: () => number;
}

function completed(
	outcome: Extract<LiveToolResponse, { status: 'completed' }>['outcome'],
	output: string
): LiveToolResponse {
	return { status: 'completed', outcome, output };
}

/**
 * Authorizes and runs one function call delegated by a Live session. A change that needs
 * confirmation runs only with an approval token issued here for exactly this call.
 */
export async function runLiveToolCall(
	request: LiveToolRequest,
	dependencies: LiveToolDependencies
): Promise<LiveToolResponse> {
	const { requestId } = dependencies;
	const now = (dependencies.now ?? Date.now)();
	const input = parseArguments(request.arguments);
	if (!input) {
		return completed('failed', 'The tool arguments were not a JSON object. Nothing was done.');
	}

	const evaluation = evaluateToolCall(request.name, input);
	const log = (outcome: string) =>
		logEvent('info', 'live.tool.call', {
			requestId,
			tool: request.name,
			kind: evaluation.kind,
			outcome
		});

	if (evaluation.kind === 'blocked') {
		log('blocked');
		return completed('blocked', evaluation.reason);
	}
	if (request.approval && !request.approval.approved) {
		log('denied');
		return completed('denied', 'The user denied this change. Do not retry it.');
	}
	if (evaluation.kind === 'mutation') {
		if (!dependencies.allowMutations) {
			log('blocked');
			return completed('blocked', 'Device changes are disabled on this server.');
		}
		const policy = request.confirmation ?? defaultConfirmationPolicy();
		if (evaluation.domains.some((domain) => requiresConfirmation(policy, domain))) {
			if (!request.approval) {
				const expiresAt = now + APPROVAL_TTL_MS;
				log('confirmation-required');
				return {
					status: 'confirmation-required',
					confirmation: {
						token: issueApprovalToken(dependencies.approvalSecret, request, expiresAt),
						summary: evaluation.summary,
						targets: toolCallTargets(input),
						expiresAt
					}
				};
			}
			const { token } = request.approval;
			if (
				!verifyApprovalToken(dependencies.approvalSecret, request, token, now) ||
				!consumeApproval(token, now)
			) {
				logEvent('warn', 'live.tool.approval-invalid', { requestId, tool: request.name });
				return completed(
					'denied',
					'The confirmation was invalid, expired, or already used. Nothing was changed.'
				);
			}
		}
	}

	const isChange = evaluation.kind === 'mutation';
	let gateway: Awaited<ReturnType<LiveToolDependencies['connect']>>;
	try {
		gateway = await dependencies.connect();
	} catch (cause) {
		logEvent('warn', 'live.tool.unavailable', {
			requestId,
			tool: request.name,
			error: errorName(cause)
		});
		const reason =
			cause instanceof McpGatewayError ? cause.message : 'The MCP server is unavailable.';
		return completed(
			'failed',
			`Home Assistant could not be reached (${reason}).${isChange ? ' Nothing was changed.' : ''}`
		);
	}

	try {
		const result = await gateway.callTool(request.name, input, {
			allowMutations: dependencies.allowMutations
		});
		log(result.isError ? 'failed' : 'executed');
		return result.isError
			? completed('failed', `Home Assistant reported an error: ${result.text || 'no details'}`)
			: completed('executed', result.text || 'Done.');
	} catch (cause) {
		logEvent('warn', 'live.tool.failed', {
			requestId,
			tool: request.name,
			error: errorName(cause)
		});
		// Gateway errors are raised before the tool call is sent, so nothing ran.
		if (cause instanceof McpGatewayError) {
			return completed(cause.status === 403 ? 'blocked' : 'failed', cause.message);
		}
		return completed('failed', isChange ? UNKNOWN_OUTCOME : 'The information is unavailable.');
	} finally {
		await gateway.close();
	}
}
