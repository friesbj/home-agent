import { error, json } from '@sveltejs/kit';
import { OPENAI_KEY_HEADER } from '$lib/config/headers';
import { getServerEnv } from '$lib/server/env';
import { errorName, logEvent } from '$lib/server/log';
import {
	liveSessionRequestSchema,
	LiveSessionError,
	provisionLiveSession
} from '$lib/server/live/session';
import { liveFunctionTools, type LiveFunctionTool } from '$lib/server/live/tools';
import {
	connectHomeAssistant,
	McpGatewayError,
	type HomeAssistantGateway
} from '$lib/server/mcp/gateway';
import { mcpConnectionSchema, readJsonBody, readMcpConnection } from '$lib/server/mcp/request';
import type { RequestHandler } from './$types';

const requestSchema = liveSessionRequestSchema.extend({ mcp: mcpConnectionSchema.optional() });

export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();
	const requestId = locals.requestId;
	const { mcp, ...offer } = await readJsonBody(request, requestSchema);
	const apiKey = request.headers.get(OPENAI_KEY_HEADER)?.trim() || env.openaiApiKey;
	if (!apiKey) error(400, 'No OpenAI API key is configured. Add one in Settings.');

	let tools: LiveFunctionTool[] = [];
	let notice: string | undefined;
	if (mcp) {
		let gateway: HomeAssistantGateway | undefined;
		try {
			gateway = await connectHomeAssistant(readMcpConnection(request, mcp), {
				policy: env.mcpUrlPolicy,
				timeoutMs: env.mcpTimeoutMs,
				signal: request.signal
			});
			tools = await liveFunctionTools(gateway, env.allowMutations);
		} catch (cause) {
			logEvent('warn', 'mcp.unavailable', { requestId, error: errorName(cause) });
			const reason =
				cause instanceof McpGatewayError ? cause.message : 'The MCP server is unavailable.';
			notice = `Home Assistant is currently unreachable (${reason}). Tell the user and do not claim to have checked or changed devices.`;
		} finally {
			await gateway?.close();
		}
	} else {
		notice = 'No Home Assistant MCP server is configured. Tell the user to add one in Settings.';
	}

	try {
		const session = await provisionLiveSession({
			...offer,
			apiKey,
			tools,
			notice,
			signal: request.signal,
			timeoutMs: env.requestTimeoutMs
		});
		return json(session, { status: 201 });
	} catch (cause) {
		const status = cause instanceof LiveSessionError ? cause.status : 502;
		const rejection = cause instanceof LiveSessionError ? cause.rejection : undefined;
		logEvent('warn', 'live.session.failed', {
			requestId,
			status,
			error: errorName(cause),
			providerType: rejection?.type,
			providerCode: rejection?.code,
			providerParam: rejection?.param,
			providerMessage: rejection?.message,
			backendModel: offer.backendModel,
			voice: offer.voice,
			toolCount: tools.length
		});

		if (status === 401 || status === 403) {
			error(502, 'OpenAI rejected the configured API key. Check your credentials in Settings.');
		}
		if (status === 429) error(503, 'OpenAI Live is temporarily busy. Try again shortly.');
		if (status === 400 || status === 404 || status === 422) {
			// Field paths and error codes are safe to show; the provider's message stays in the log.
			const hint = [rejection?.param, rejection?.code]
				.filter((value) => value && /^[\w.[\]-]{1,120}$/.test(value))
				.join(', ');
			error(
				502,
				`OpenAI rejected the voice session settings${hint ? ` (${hint})` : ''}. Check the voice and backend model in Settings (request ${requestId}).`
			);
		}
		error(502, `Could not start a Live conversation (request ${requestId}).`);
	}
};
