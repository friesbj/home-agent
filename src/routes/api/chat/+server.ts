import type { UIMessage, ToolSet } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { error } from '@sveltejs/kit';
import { z } from 'zod';
import { OPENAI_KEY_HEADER } from '$lib/config/headers';
import { confirmationPolicySchema, defaultConfirmationPolicy } from '$lib/config/settings';
import { getServerEnv } from '$lib/server/env';
import { streamChat } from '$lib/server/chat/chat-service';
import {
	connectHomeAssistant,
	McpGatewayError,
	type HomeAssistantGateway
} from '$lib/server/mcp/gateway';
import { mcpConnectionSchema, readJsonBody, readMcpConnection } from '$lib/server/mcp/request';
import { errorName, logEvent } from '$lib/server/log';
import type { RequestHandler } from './$types';

const chatRequestSchema = z.object({
	messages: z
		.array(
			z.looseObject({
				id: z.string(),
				role: z.enum(['user', 'assistant', 'system']),
				parts: z.array(z.unknown())
			})
		)
		.min(1)
		.max(200),
	model: z
		.string()
		.regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i)
		.optional(),
	mcp: mcpConnectionSchema.optional(),
	confirmation: confirmationPolicySchema.optional()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();
	const requestId = locals.requestId;

	// Private MVP: the browser may supply its own key (stored in Browser Storage); fall back to the server key.
	const apiKey = request.headers.get(OPENAI_KEY_HEADER)?.trim() || env.openaiApiKey;
	if (!apiKey) error(400, 'No OpenAI API key is configured. Add one in Settings.');

	const body = await readJsonBody(request, chatRequestSchema);

	let gateway: HomeAssistantGateway | undefined;
	let tools: ToolSet = {};
	let notice: string | undefined;
	if (body.mcp) {
		try {
			gateway = await connectHomeAssistant(readMcpConnection(request, body.mcp), {
				policy: env.mcpUrlPolicy,
				timeoutMs: env.mcpTimeoutMs,
				signal: request.signal
			});
			tools = await gateway.createTools({ allowMutations: env.allowMutations });
		} catch (cause) {
			await gateway?.close();
			gateway = undefined;
			logEvent('warn', 'mcp.unavailable', { requestId, error: errorName(cause) });
			const reason =
				cause instanceof McpGatewayError ? cause.message : 'The MCP server is unavailable.';
			notice = `Home Assistant is currently unreachable (${reason}). Tell the user and do not claim to have checked or changed devices.`;
		}
	} else {
		notice = 'No Home Assistant MCP server is configured. Tell the user to add one in Settings.';
	}

	const openai = createOpenAI({ apiKey });
	try {
		return await streamChat({
			model: openai.responses(body.model ?? env.textModel),
			messages: body.messages as unknown as UIMessage[],
			tools,
			confirmation: body.confirmation ?? defaultConfirmationPolicy(),
			approvalSecret: env.toolApprovalSecret,
			timeoutMs: env.requestTimeoutMs,
			requestId,
			signal: request.signal,
			notice,
			onEnd: () => gateway?.close(),
			headers: { 'x-request-id': requestId }
		});
	} catch (cause) {
		await gateway?.close();
		logEvent('warn', 'chat.invalid', { requestId, error: errorName(cause) });
		error(400, 'Invalid chat request.');
	}
};
