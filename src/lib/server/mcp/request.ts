import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { MCP_TRANSPORTS } from '$lib/config/settings';
import { MCP_TOKEN_HEADER } from '$lib/config/headers';
import type { McpConnectionRequest } from './gateway';

export const mcpConnectionSchema = z.object({
	url: z.string().trim().min(1).max(2048),
	transport: z.enum(MCP_TRANSPORTS).default('streamable-http')
});

export function readMcpConnection(
	request: Request,
	connection: z.infer<typeof mcpConnectionSchema>
): McpConnectionRequest {
	const token = request.headers.get(MCP_TOKEN_HEADER)?.trim();
	return { ...connection, token: token || undefined };
}

/** Parses a JSON request body with a zod schema, responding 400 on failure. */
export async function readJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		error(400, 'Request body must be JSON.');
	}
	const parsed = schema.safeParse(body);
	if (!parsed.success) error(400, 'Invalid request.');
	return parsed.data;
}
