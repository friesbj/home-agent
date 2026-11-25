import { describe, expect, it, vi } from 'vitest';
import type { ListToolsResult } from '@ai-sdk/mcp';
import {
	connectHomeAssistant,
	McpGatewayError,
	sanitizeToolResult,
	type GatewayClient
} from './gateway';

const policy = { allowInsecureHttp: false, allowPrivateHosts: false };
const lookup = async () => [{ address: '93.184.216.34', family: 4 }];

const definitions = {
	tools: [
		{ name: 'GetLiveContext', inputSchema: { type: 'object' } },
		{ name: 'HassTurnOn', inputSchema: { type: 'object' } },
		{ name: 'homeassistant__call_service', inputSchema: { type: 'object' } }
	]
} as unknown as ListToolsResult;

function fakeClient(execute = vi.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] }))) {
	const client = {
		serverInfo: { name: 'Home Assistant', version: '2026.11' },
		listTools: vi.fn(async () => definitions),
		callTool: vi.fn(),
		close: vi.fn(async () => undefined),
		toolsFromDefinitions: vi.fn((defs: ListToolsResult) =>
			Object.fromEntries(defs.tools.map((tool) => [tool.name, { description: tool.name, execute }]))
		)
	};
	return { client: client as unknown as GatewayClient & typeof client, execute };
}

const execOptions = (toolCallId: string) => ({ toolCallId, messages: [], context: {} }) as never;

async function connect(client: GatewayClient) {
	const createClient = vi.fn<(config: unknown) => Promise<GatewayClient>>(async () => client);
	const gateway = await connectHomeAssistant(
		{ url: 'https://ha.example.com/api/mcp', transport: 'streamable-http', token: 'secret-token' },
		{ policy, timeoutMs: 1000, lookup, createClient }
	);
	return { gateway, createClient };
}

describe('Home Assistant MCP gateway', () => {
	it('connects with bearer auth, redirects disabled, and a pinned fetch', async () => {
		const { client } = fakeClient();
		const { createClient } = await connect(client);
		const config = createClient.mock.calls[0][0] as {
			transport: {
				type: string;
				url: string;
				headers: Record<string, string>;
				redirect: string;
				fetch: unknown;
			};
		};
		expect(config.transport).toMatchObject({
			type: 'http',
			url: 'https://ha.example.com/api/mcp',
			headers: { Authorization: 'Bearer secret-token' },
			redirect: 'error'
		});
		expect(config.transport.fetch).toBeTypeOf('function');
	});

	it('rejects disallowed URLs before connecting', async () => {
		const createClient = vi.fn();
		await expect(
			connectHomeAssistant(
				{ url: 'http://ha.example.com', transport: 'sse' },
				{ policy, timeoutMs: 1000, lookup, createClient }
			)
		).rejects.toBeInstanceOf(McpGatewayError);
		expect(createClient).not.toHaveBeenCalled();
	});

	it('maps connection failures to safe messages', async () => {
		await expect(
			connectHomeAssistant(
				{ url: 'https://ha.example.com', transport: 'streamable-http' },
				{
					policy,
					timeoutMs: 1000,
					lookup,
					createClient: async () => {
						throw new Error('HTTP 401 Unauthorized: token abc');
					}
				}
			)
		).rejects.toThrow('The MCP server rejected the credentials. Check the access token.');
	});

	it('discovers tools with their policy classification', async () => {
		const { gateway } = await connect(fakeClient().client);
		const result = await gateway.discover();
		expect(result.serverName).toBe('Home Assistant');
		expect(result.tools.map((tool) => [tool.name, tool.kind])).toEqual([
			['GetLiveContext', 'read'],
			['HassTurnOn', 'mutation'],
			['homeassistant__call_service', 'blocked']
		]);
	});

	it('reads the observed prefixed GetLiveContext and its JSON result envelope', async () => {
		const { client } = fakeClient();
		client.listTools.mockResolvedValue({
			tools: [{ name: 'homeassistant__GetLiveContext', inputSchema: { type: 'object' } }]
		} as ListToolsResult);
		client.callTool.mockResolvedValue({
			content: [
				{
					type: 'text',
					text: JSON.stringify({
						result: `Live Context: An overview of the areas and the devices in this smart home:
- names:Thermostat
  domain: climate
  state: heat
  areas: Room
  attributes:
    current_temperature: 27.0
    temperature_unit: °C
    temperature: 21
`
					})
				}
			]
		});
		const { gateway } = await connect(client);

		expect((await gateway.liveContext()).areas).toEqual([
			{
				name: 'Room',
				entities: [
					{
						name: 'Thermostat',
						domain: 'climate',
						state: 'heat',
						areas: ['Room'],
						attributes: { current_temperature: '27.0', temperature_unit: '°C', temperature: '21' }
					}
				]
			}
		]);
		expect(client.callTool).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'homeassistant__GetLiveContext', arguments: {} })
		);
	});

	it('exposes only allowlisted tools and re-checks every call', async () => {
		const { client, execute } = fakeClient();
		const { gateway } = await connect(client);

		const tools = await gateway.createTools({ allowMutations: true });
		expect(Object.keys(tools)).toEqual(['GetLiveContext', 'HassTurnOn']);

		await expect(
			(tools.HassTurnOn.execute as (input: unknown, options: never) => Promise<unknown>)(
				{ domain: ['lock'], name: 'Front door' },
				execOptions('1')
			)
		).rejects.toThrow(/not allowed/);
		expect(execute).not.toHaveBeenCalled();

		await (tools.HassTurnOn.execute as (input: unknown, options: never) => Promise<unknown>)(
			{ domain: ['light'], name: 'Kitchen' },
			execOptions('2')
		);
		expect(execute).toHaveBeenCalledOnce();

		const readOnly = await gateway.createTools({ allowMutations: false });
		expect(Object.keys(readOnly)).toEqual(['GetLiveContext']);
	});

	it('calls a single tool only when it is allowlisted, offered, and permitted', async () => {
		const { client } = fakeClient();
		client.callTool.mockResolvedValue({ content: [{ type: 'text', text: 'done' }] });
		const { gateway } = await connect(client);
		const kitchen = { domain: ['light'], name: 'Kitchen' };

		const readOnly = await gateway.toolDefinitions({ allowMutations: false });
		expect(readOnly.map((tool) => tool.name)).toEqual(['GetLiveContext']);

		await expect(
			gateway.callTool('HassTurnOn', { domain: ['lock'] }, { allowMutations: true })
		).rejects.toThrow(/not allowed/);
		await expect(
			gateway.callTool('homeassistant__call_service', {}, { allowMutations: true })
		).rejects.toThrow(/not allowed/);
		await expect(
			gateway.callTool('HassTurnOn', kitchen, { allowMutations: false })
		).rejects.toThrow('Device changes are disabled on this server.');
		await expect(gateway.callTool('HassLightSet', {}, { allowMutations: true })).rejects.toThrow(
			'The MCP server does not offer this tool.'
		);
		expect(client.callTool).not.toHaveBeenCalled();

		expect(await gateway.callTool('HassTurnOn', kitchen, { allowMutations: true })).toEqual({
			text: 'done',
			isError: false
		});
		expect(client.callTool).toHaveBeenCalledWith({
			name: 'HassTurnOn',
			arguments: kitchen,
			options: { timeout: 1000 }
		});
	});

	it('closes the client only once', async () => {
		const { client } = fakeClient();
		const { gateway } = await connect(client);
		await gateway.close();
		await gateway.close();
		expect(client.close).toHaveBeenCalledOnce();
	});
});

describe('sanitizeToolResult', () => {
	it('redacts secret fields and truncates long text', () => {
		const result = sanitizeToolResult({
			content: [{ type: 'text', text: 'x'.repeat(9000) }],
			structuredContent: { access_token: 'abc', state: 'on' }
		});
		expect(result.structuredContent).toEqual({ access_token: '[redacted]', state: 'on' });
		expect(result.content[0].text.endsWith('[truncated]')).toBe(true);
		expect(result.content[0].text.length).toBeLessThan(8100);
	});
});
