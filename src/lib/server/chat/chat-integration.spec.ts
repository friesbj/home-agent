import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { connectHomeAssistant, type HomeAssistantGateway } from '$lib/server/mcp/gateway';
import {
	FAKE_MCP_TOKEN,
	startFakeHaMcpServer,
	type FakeMcpServer
} from '$lib/server/mcp/fake-ha-mcp-server';
import {
	asksUser,
	assistantMessage,
	mockModel,
	respondToApprovals,
	runChat,
	textStep,
	toolCallStep,
	userMessage
} from './chat-test-helpers';

const policy = { allowInsecureHttp: true, allowPrivateHosts: true };

describe('text chat with a real MCP connection (fake Home Assistant)', () => {
	let server: FakeMcpServer;
	beforeAll(async () => {
		server = await startFakeHaMcpServer();
	});
	afterAll(() => server.close());

	async function connect(): Promise<HomeAssistantGateway> {
		return connectHomeAssistant(
			{ url: server.url, transport: 'streamable-http', token: FAKE_MCP_TOKEN },
			{ policy, timeoutMs: 5000 }
		);
	}

	it('exposes only allowlisted MCP tools and feeds read results to the model', async () => {
		const gateway = await connect();
		const tools = await gateway.createTools({ allowMutations: true });
		expect(Object.keys(tools).sort()).toEqual(['GetLiveContext', 'HassTurnOn']);

		const model = mockModel(
			toolCallStep('GetLiveContext', {}),
			textStep('The kitchen light is on.')
		);
		const onEnd = vi.fn(() => gateway.close());
		const chunks = await runChat({ model, tools, onEnd });

		expect(server.calls.at(-1)?.name).toBe('GetLiveContext');
		expect(JSON.stringify(model.doStreamCalls[1].prompt)).toContain('Kitchen Light');
		expect(chunks.some((chunk) => chunk.type === 'text-delta')).toBe(true);
		expect(onEnd).toHaveBeenCalled();
	});

	it('only calls the MCP mutation tool after the user approves', async () => {
		const callsBefore = server.calls.length;
		const kitchenLight = { name: 'Kitchen Light', domain: ['light'] };

		let gateway = await connect();
		const first = await runChat({
			model: mockModel(toolCallStep('HassTurnOn', kitchenLight)),
			tools: await gateway.createTools({ allowMutations: true }),
			onEnd: () => gateway.close()
		});
		expect(asksUser(first)).toBe(true);
		expect(server.calls.length).toBe(callsBefore);

		gateway = await connect();
		const approved = respondToApprovals(await assistantMessage(first), true);
		await runChat({
			model: mockModel(textStep('Done.')),
			tools: await gateway.createTools({ allowMutations: true }),
			messages: [userMessage, approved],
			onEnd: () => gateway.close()
		});
		expect(server.calls.at(-1)).toEqual({ name: 'HassTurnOn', arguments: kitchenLight });
	});
});
