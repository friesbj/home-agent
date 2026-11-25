import { json } from '@sveltejs/kit';
import { getServerEnv } from '$lib/server/env';
import { liveToolRequestSchema, runLiveToolCall } from '$lib/server/live/tools';
import { connectHomeAssistant } from '$lib/server/mcp/gateway';
import { readJsonBody, readMcpConnection } from '$lib/server/mcp/request';
import type { RequestHandler } from './$types';

/** Runs one function call that a Live session delegated to this application. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();
	const body = await readJsonBody(request, liveToolRequestSchema);
	const result = await runLiveToolCall(body, {
		connect: () =>
			connectHomeAssistant(readMcpConnection(request, body.mcp), {
				policy: env.mcpUrlPolicy,
				timeoutMs: env.mcpTimeoutMs,
				signal: request.signal
			}),
		allowMutations: env.allowMutations,
		approvalSecret: env.toolApprovalSecret,
		requestId: locals.requestId
	});
	return json(result);
};
