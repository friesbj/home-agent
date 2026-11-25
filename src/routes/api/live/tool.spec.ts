import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MCP_TOKEN_HEADER } from '$lib/config/headers';
import { liveToolResponseSchema } from '$lib/live/protocol';
import {
	FAKE_MCP_TOKEN,
	startFakeHaMcpServer,
	type FakeMcpServer
} from '$lib/server/mcp/fake-ha-mcp-server';
import { POST } from './tool/+server';

vi.mock('$lib/server/env', () => ({
	getServerEnv: () => ({
		mcpUrlPolicy: { allowInsecureHttp: true, allowPrivateHosts: true },
		mcpTimeoutMs: 5000,
		allowMutations: true,
		toolApprovalSecret: 'test-secret-test-secret-test-secret'
	})
}));

const kitchenLight = { name: 'Kitchen Light', domain: ['light'] };

describe('POST /api/live/tool with a real MCP connection (fake Home Assistant)', () => {
	let server: FakeMcpServer;
	beforeAll(async () => {
		server = await startFakeHaMcpServer();
	});
	afterAll(() => server.close());

	async function post(body: Record<string, unknown>, token = FAKE_MCP_TOKEN) {
		const response = await POST({
			request: new Request('http://localhost/api/live/tool', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', [MCP_TOKEN_HEADER]: token },
				body: JSON.stringify({
					sessionId: 'live_session',
					mcp: { url: server.url, transport: 'streamable-http' },
					...body
				})
			}),
			locals: { requestId: 'live-tool-test' }
		} as Parameters<typeof POST>[0]);
		return liveToolResponseSchema.parse(await response.json());
	}

	it('returns read results and reports an unreachable Home Assistant', async () => {
		const read = { callId: 'call_read', name: 'GetLiveContext', arguments: '{}' };

		const result = await post(read);
		expect(result).toMatchObject({ status: 'completed', outcome: 'executed' });
		expect(result.status === 'completed' && result.output).toContain('Kitchen Light');
		expect(server.calls.at(-1)?.name).toBe('GetLiveContext');

		expect(await post(read, 'wrong-token')).toEqual({
			status: 'completed',
			outcome: 'failed',
			output:
				'Home Assistant could not be reached (The MCP server rejected the credentials. Check the access token.).'
		});
	});

	it('calls the MCP change tool only after an approval for exactly that call', async () => {
		const callsBefore = server.calls.length;
		const change = {
			callId: 'call_change',
			name: 'HassTurnOn',
			arguments: JSON.stringify(kitchenLight)
		};

		const pending = await post(change);
		if (pending.status !== 'confirmation-required') throw new Error('Expected a confirmation.');
		const approval = { token: pending.confirmation.token, approved: true };

		const everyLight = JSON.stringify({ domain: ['light'] });
		expect(await post({ ...change, arguments: everyLight, approval })).toMatchObject({
			outcome: 'denied'
		});
		expect(server.calls.length).toBe(callsBefore);

		expect(await post({ ...change, approval })).toMatchObject({ outcome: 'executed' });
		expect(server.calls.slice(callsBefore)).toEqual([
			{ name: 'HassTurnOn', arguments: kitchenLight }
		]);
	});

	it('never forwards tools outside the allowlist', async () => {
		const callsBefore = server.calls.length;

		expect(
			await post({
				callId: 'call_blocked',
				name: 'homeassistant__call_service',
				arguments: '{}',
				confirmation: { mode: 'none', acknowledgedNoConfirmationRisk: true }
			})
		).toMatchObject({ outcome: 'blocked' });
		expect(server.calls.length).toBe(callsBefore);
	});

	it('rejects malformed requests', async () => {
		await expect(post({ callId: 'call_1', name: 'not a function name' })).rejects.toMatchObject({
			status: 400
		});
	});
});
