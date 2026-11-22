import { error, json } from '@sveltejs/kit';
import { z } from 'zod';
import { getServerEnv } from '$lib/server/env';
import {
	connectHomeAssistant,
	McpGatewayError,
	type HomeAssistantGateway
} from '$lib/server/mcp/gateway';
import { mcpConnectionSchema, readJsonBody, readMcpConnection } from '$lib/server/mcp/request';
import { errorName, logEvent } from '$lib/server/log';
import type { RequestHandler } from './$types';

const stateSchema = z.object({ mcp: mcpConnectionSchema });

/** Read-only snapshot of exposed entities grouped by area (via Home Assistant's GetLiveContext). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();
	const body = await readJsonBody(request, stateSchema);
	let gateway: HomeAssistantGateway | undefined;
	try {
		gateway = await connectHomeAssistant(readMcpConnection(request, body.mcp), {
			policy: env.mcpUrlPolicy,
			timeoutMs: env.mcpTimeoutMs,
			signal: request.signal
		});
		return json(await gateway.liveContext());
	} catch (cause) {
		logEvent('warn', 'home.state.failed', { requestId: locals.requestId, error: errorName(cause) });
		if (cause instanceof McpGatewayError) error(cause.status, cause.message);
		error(502, 'Could not read the current state from Home Assistant.');
	} finally {
		await gateway?.close();
	}
};
