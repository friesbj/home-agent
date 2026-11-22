// Test-only: minimal Streamable-HTTP MCP server imitating Home Assistant's "Device control" tools.
// Used by integration tests and Playwright (via e2e/support/fake-mcp-server.ts). Never imported by app code.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

export const FAKE_MCP_TOKEN = 'e2e-mcp-token';

export const FAKE_LIVE_CONTEXT = `Live Context: An overview of the areas and the devices in this smart home:
- names: Kitchen Light
  domain: light
  state: 'on'
  areas: Kitchen
- names: Thermostat
  domain: climate
  state: heat
  areas: Living Room
`;

const TOOLS = [
	{
		name: 'GetLiveContext',
		description: 'Current state',
		inputSchema: { type: 'object', properties: {} }
	},
	{
		name: 'HassTurnOn',
		description: 'Turn on',
		inputSchema: {
			type: 'object',
			properties: { name: { type: 'string' }, domain: { type: 'array', items: { type: 'string' } } }
		}
	},
	{
		name: 'homeassistant__call_service',
		description: 'Call any action',
		inputSchema: { type: 'object', properties: {} }
	}
];

interface JsonRpcMessage {
	id?: number | string;
	method: string;
	params?: { protocolVersion?: string; name?: string; arguments?: unknown };
}

export interface FakeMcpServer {
	url: string;
	/** Names and arguments of every `tools/call` request received. */
	calls: { name: string; arguments: unknown }[];
	close: () => Promise<void>;
}

export async function startFakeHaMcpServer(port = 0): Promise<FakeMcpServer> {
	const calls: FakeMcpServer['calls'] = [];

	function reply(message: JsonRpcMessage) {
		const { id, method, params } = message;
		if (id === undefined) return null;
		switch (method) {
			case 'initialize':
				return {
					jsonrpc: '2.0',
					id,
					result: {
						protocolVersion: params?.protocolVersion ?? '2025-06-18',
						capabilities: { tools: {} },
						serverInfo: { name: 'Fake Home Assistant', version: '0.0.1' }
					}
				};
			case 'tools/list':
				return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
			case 'tools/call': {
				calls.push({ name: params?.name ?? '', arguments: params?.arguments });
				const text =
					params?.name === 'GetLiveContext'
						? JSON.stringify({ success: true, result: FAKE_LIVE_CONTEXT })
						: JSON.stringify({ success: true });
				return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }] } };
			}
			case 'ping':
				return { jsonrpc: '2.0', id, result: {} };
			default:
				return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
		}
	}

	function handle(req: IncomingMessage, res: ServerResponse) {
		if (req.headers.authorization !== `Bearer ${FAKE_MCP_TOKEN}`) {
			res.writeHead(401).end();
			return;
		}
		if (req.method !== 'POST') {
			res.writeHead(req.method === 'DELETE' ? 200 : 405).end();
			return;
		}
		let body = '';
		req.on('data', (chunk) => (body += chunk));
		req.on('end', () => {
			const parsed = JSON.parse(body) as JsonRpcMessage | JsonRpcMessage[];
			const replies = (Array.isArray(parsed) ? parsed : [parsed]).map(reply).filter(Boolean);
			if (replies.length === 0) {
				res.writeHead(202).end();
				return;
			}
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify(Array.isArray(parsed) ? replies : replies[0]));
		});
	}

	const server = createServer(handle);
	await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
	const { port: actualPort } = server.address() as AddressInfo;
	return {
		url: `http://127.0.0.1:${actualPort}/api/mcp`,
		calls,
		close: () => new Promise((resolve) => server.close(() => resolve()))
	};
}
