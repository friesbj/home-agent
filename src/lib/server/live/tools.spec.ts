import { describe, expect, it, vi } from 'vitest';
import type { ConfirmationPolicy } from '$lib/config/settings';
import { McpGatewayError, type HomeAssistantGateway } from '$lib/server/mcp/gateway';
import {
	issueApprovalToken,
	liveFunctionTools,
	liveToolRequestSchema,
	runLiveToolCall,
	verifyApprovalToken,
	type LiveToolRequest
} from './tools';

const secret = 'test-secret-test-secret-test-secret';
const kitchenLight = JSON.stringify({ name: 'Kitchen Light', domain: ['light'] });
const noConfirmation: ConfirmationPolicy = {
	mode: 'none',
	domains: [],
	acknowledgedNoConfirmationRisk: true
};
let callCount = 0;

function request(overrides: Partial<LiveToolRequest> = {}): LiveToolRequest {
	return liveToolRequestSchema.parse({
		sessionId: 'live_session',
		// Each test call is distinct, as approvals are single use.
		callId: `call_${++callCount}`,
		name: 'HassTurnOn',
		arguments: kitchenLight,
		mcp: { url: 'https://ha.example.com/api/mcp' },
		...overrides
	});
}

function setup(
	execute: HomeAssistantGateway['callTool'] = async () => ({ text: 'ok', isError: false })
) {
	const callTool = vi.fn(execute);
	const close = vi.fn(async () => {});
	const connect = vi.fn(async () => ({ callTool, close }));
	const run = (toolRequest: LiveToolRequest, options: { allowMutations?: boolean } = {}) =>
		runLiveToolCall(toolRequest, {
			connect,
			allowMutations: options.allowMutations ?? true,
			approvalSecret: secret,
			requestId: 'req-1',
			now: () => 1_000_000
		});
	return { run, connect, callTool, close };
}

async function confirmationToken(
	run: ReturnType<typeof setup>['run'],
	toolRequest: LiveToolRequest
) {
	const result = await run(toolRequest);
	if (result.status !== 'confirmation-required') throw new Error('Expected a confirmation.');
	return result.confirmation.token;
}

describe('liveFunctionTools', () => {
	it('describes allowlisted MCP tools as application-executed functions', async () => {
		const toolDefinitions = vi.fn(async () => [
			{
				name: 'HassTurnOn',
				description: 'Turn on',
				inputSchema: { type: 'object' as const, properties: { name: { type: 'string' } } }
			},
			{ name: 'invalid name', inputSchema: { type: 'object' as const } }
		]);

		expect(await liveFunctionTools({ toolDefinitions }, false)).toEqual([
			{
				type: 'function',
				name: 'HassTurnOn',
				description: 'Turn on',
				parameters: { type: 'object', properties: { name: { type: 'string' } } },
				strict: false
			}
		]);
		expect(toolDefinitions).toHaveBeenCalledWith({ allowMutations: false });
	});
});

describe('runLiveToolCall', () => {
	it('runs read tools without confirmation and closes the connection', async () => {
		const { run, callTool, close } = setup();

		const result = await run(request({ name: 'GetLiveContext', arguments: '' }));

		expect(result).toEqual({ status: 'completed', outcome: 'executed', output: 'ok' });
		expect(callTool).toHaveBeenCalledWith('GetLiveContext', {}, { allowMutations: true });
		expect(close).toHaveBeenCalledOnce();
	});

	it('asks for confirmation by default and runs a change only once it is approved', async () => {
		const { run, connect, callTool } = setup();
		const toolRequest = request();

		const pending = await run(toolRequest);
		expect(pending).toEqual({
			status: 'confirmation-required',
			confirmation: {
				token: expect.any(String),
				summary: 'Turn on / activate: name "Kitchen Light" (light)',
				targets: ['Kitchen Light'],
				expiresAt: 1_300_000
			}
		});
		expect(connect).not.toHaveBeenCalled();
		if (pending.status !== 'confirmation-required') return;

		const approval = { token: pending.confirmation.token, approved: true };
		expect(await run({ ...toolRequest, approval })).toMatchObject({ outcome: 'executed' });
		expect(callTool).toHaveBeenCalledWith(
			'HassTurnOn',
			{ name: 'Kitchen Light', domain: ['light'] },
			{ allowMutations: true }
		);

		// The same approval cannot run the change a second time.
		expect(await run({ ...toolRequest, approval })).toMatchObject({ outcome: 'denied' });
		expect(callTool).toHaveBeenCalledOnce();
	});

	it('rejects approvals that were issued for a different call or have expired', async () => {
		const { run, connect } = setup();
		const toolRequest = request();
		const token = await confirmationToken(run, toolRequest);
		const approval = { token, approved: true };
		const expired = issueApprovalToken(secret, toolRequest, 999_999);

		for (const tampered of [
			{ ...toolRequest, approval, arguments: JSON.stringify({ domain: ['light'] }) },
			{ ...toolRequest, approval, callId: 'another_call' },
			{ ...toolRequest, approval, sessionId: 'another_session' },
			{ ...toolRequest, approval: { token: `9999999.${token.split('.')[1]}`, approved: true } },
			{ ...toolRequest, approval: { token: 'forged', approved: true } },
			{ ...toolRequest, approval: { token: expired, approved: true } }
		]) {
			expect(await run(tampered)).toEqual({
				status: 'completed',
				outcome: 'denied',
				output: 'The confirmation was invalid, expired, or already used. Nothing was changed.'
			});
		}
		expect(connect).not.toHaveBeenCalled();
		expect(verifyApprovalToken(secret, toolRequest, token, 1_000_000)).toBe(true);
		expect(verifyApprovalToken('another-secret', toolRequest, token, 1_000_000)).toBe(false);
	});

	it('never runs a denied change, even when the policy needs no confirmation', async () => {
		const { run, connect } = setup();
		const toolRequest = request();
		const token = await confirmationToken(run, toolRequest);

		for (const confirmation of [undefined, noConfirmation]) {
			expect(
				await run({ ...toolRequest, confirmation, approval: { token, approved: false } })
			).toEqual({
				status: 'completed',
				outcome: 'denied',
				output: 'The user denied this change. Do not retry it.'
			});
		}
		expect(connect).not.toHaveBeenCalled();
	});

	it('follows the confirmation policy but not past the allowlist', async () => {
		const { run, connect, callTool } = setup();

		expect(await run(request({ confirmation: noConfirmation }))).toMatchObject({
			outcome: 'executed'
		});
		expect(callTool).toHaveBeenCalledOnce();

		const blocked = [
			request({ confirmation: noConfirmation, name: 'homeassistant__call_service' }),
			request({
				confirmation: noConfirmation,
				arguments: JSON.stringify({ name: 'Front door', domain: ['lock'] })
			}),
			request({ confirmation: noConfirmation, arguments: JSON.stringify({ name: 'Kitchen' }) })
		];
		for (const toolRequest of blocked) {
			expect(await run(toolRequest)).toMatchObject({ outcome: 'blocked' });
		}
		expect(await run(request({ confirmation: noConfirmation }), { allowMutations: false })).toEqual(
			{
				status: 'completed',
				outcome: 'blocked',
				output: 'Device changes are disabled on this server.'
			}
		);
		expect(connect).toHaveBeenCalledOnce();
	});

	it('reports failures without claiming a result', async () => {
		const failing = setup(async () => {
			throw new Error('socket closed: token abc');
		});
		expect(await failing.run(request({ confirmation: noConfirmation }))).toEqual({
			status: 'completed',
			outcome: 'failed',
			output: expect.stringMatching(/outcome of this change is unknown/)
		});
		expect(failing.close).toHaveBeenCalledOnce();

		const unreachable = setup();
		unreachable.connect.mockRejectedValue(new McpGatewayError('The MCP server did not respond.'));
		expect(await unreachable.run(request({ confirmation: noConfirmation }))).toEqual({
			status: 'completed',
			outcome: 'failed',
			output:
				'Home Assistant could not be reached (The MCP server did not respond.). Nothing was changed.'
		});

		const reportsError = setup(async () => ({ text: 'Unknown device', isError: true }));
		expect(await reportsError.run(request({ name: 'GetLiveContext', arguments: '{}' }))).toEqual({
			status: 'completed',
			outcome: 'failed',
			output: 'Home Assistant reported an error: Unknown device'
		});

		expect(await setup().run(request({ arguments: '["not", "an", "object"]' }))).toMatchObject({
			outcome: 'failed'
		});
	});
});
