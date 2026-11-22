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

const discoverSchema = z.object({ mcp: mcpConnectionSchema });

/** Connects to the MCP server and lists its tools with their allowlist classification (read-only). */
export const POST: RequestHandler = async ({ request, locals }) => {
	const env = getServerEnv();
	const body = await readJsonBody(request, discoverSchema);
	let gateway: HomeAssistantGateway | undefined;
	try {
		gateway = await connectHomeAssistant(readMcpConnection(request, body.mcp), {
			policy: env.mcpUrlPolicy,
			timeoutMs: env.mcpTimeoutMs,
			signal: request.signal
		});
		return json(await gateway.discover());
	} catch (cause) {
		logEvent('warn', 'mcp.discover.failed', {
			requestId: locals.requestId,
			error: errorName(cause)
		});
		if (cause instanceof McpGatewayError) error(cause.status, cause.message);
		error(502, 'Could not read tools from the MCP server.');
	} finally {
		await gateway?.close();
	}
};
