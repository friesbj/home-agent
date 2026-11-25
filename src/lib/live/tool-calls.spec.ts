import { describe, expect, it, vi } from 'vitest';
import type { LiveFunctionCall } from './events';
import type { LiveToolResponse } from './protocol';
import { LiveToolCoordinator, type LiveToolHost } from './tool-calls';

const executed = (output: string): LiveToolResponse => ({
	status: 'completed',
	outcome: 'executed',
	output
});
const confirmationRequired: LiveToolResponse = {
	status: 'confirmation-required',
	confirmation: { token: 'signed-token', summary: 'Turn on', targets: ['Kitchen'], expiresAt: 1 }
};
const turnOn = { name: 'Kitchen Light', domain: ['light'] };

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

function setup(execute: LiveToolHost['execute']) {
	const sent: Record<string, unknown>[] = [];
	const coordinator = new LiveToolCoordinator({
		send: (event) => sent.push(event),
		execute: vi.fn(execute),
		onChange: () => {}
	});
	const call = (callId: string, name = 'GetLiveContext', args: unknown = {}) =>
		coordinator.handle({
			kind: 'function-call',
			delegationId: 'delegation_1',
			callId,
			name,
			arguments: JSON.stringify(args)
		});
	const finish = (ok = true) =>
		coordinator.handle({ kind: 'finished', delegationId: 'delegation_1', ok });
	const outputs = () =>
		sent
			.filter((event) => event.type === 'response.item.create')
			.map((event) => event.item as { call_id: string; output: string });
	const continuations = () => sent.filter((event) => event.type === 'response.create').length;
	return { coordinator, sent, call, finish, outputs, continuations };
}

const settle = () => new Promise((resolve) => setTimeout(resolve));

describe('LiveToolCoordinator', () => {
	it('continues the backend only after the response finished and every call has a result', async () => {
		const results = new Map<string, ReturnType<typeof deferred<LiveToolResponse>>>();
		const { call, finish, outputs, continuations, coordinator } = setup((pending) => {
			const result = deferred<LiveToolResponse>();
			results.set(pending.callId, result);
			return result.promise;
		});

		call('call_1');
		call('call_2');
		finish();
		results.get('call_1')?.resolve(executed('first'));
		await settle();
		expect(outputs()).toEqual([
			{ type: 'function_call_output', call_id: 'call_1', output: 'first' }
		]);
		expect(continuations()).toBe(0);
		expect(coordinator.busy).toBe(true);

		results.get('call_2')?.resolve(executed('second'));
		await settle();
		expect(outputs().map((item) => item.call_id)).toEqual(['call_1', 'call_2']);
		expect(continuations()).toBe(1);
		expect(coordinator.busy).toBe(false);
	});

	it('waits for the response to finish when results arrive first and never continues without calls', async () => {
		const { call, finish, outputs, continuations } = setup(async () => executed('state'));

		finish();
		expect(continuations()).toBe(0);

		call('call_1');
		await settle();
		expect(outputs()).toHaveLength(1);
		expect(continuations()).toBe(0);

		finish();
		expect(continuations()).toBe(1);
	});

	it('reports an unknown outcome when a change request fails', async () => {
		const { call, outputs } = setup(async () => {
			throw new Error('network');
		});

		call('call_1', 'HassTurnOn', turnOn);
		call('call_2', 'GetLiveContext');
		await settle();

		expect(outputs()[0].output).toMatch(/outcome of this change is unknown/);
		expect(outputs()[1].output).toBe('The information is unavailable right now.');
	});

	it('shows one confirmation and returns the denial even if reporting it fails', async () => {
		const { call, coordinator, outputs, sent } = setup(async (_pending, approval) => {
			if (approval) throw new Error('network');
			return confirmationRequired;
		});

		call('call_1', 'HassTurnOn', turnOn);
		await settle();
		expect(coordinator.confirmation).toEqual({ summary: 'Turn on', targets: ['Kitchen'] });
		expect(coordinator.activity).toMatchObject({
			kind: 'change',
			progress: 'Waiting for your decision.'
		});
		expect(sent.map((event) => event.type)).toEqual(['session.commentary.append']);

		coordinator.respond(false);
		expect(coordinator.confirmation).toBeUndefined();
		await settle();
		expect(outputs()).toEqual([
			{
				type: 'function_call_output',
				call_id: 'call_1',
				output: 'The user denied this change. Do not retry it.'
			}
		]);
	});

	it('does not ask twice when the server answers an approval with another confirmation', async () => {
		const { call, coordinator, outputs } = setup(async () => confirmationRequired);

		call('call_1', 'HassTurnOn', turnOn);
		await settle();
		coordinator.respond(true);
		await settle();

		expect(coordinator.confirmation).toBeUndefined();
		expect(outputs()[0].output).toBe(
			'The confirmation could not be verified. Nothing was changed.'
		);
	});

	it('drops the calls of a failed response and ignores their late results', async () => {
		const result = deferred<LiveToolResponse>();
		const { call, finish, coordinator, sent } = setup(() => result.promise);

		call('call_1');
		finish(false);
		expect(coordinator.busy).toBe(false);
		result.resolve(executed('late'));
		await settle();
		expect(sent).toEqual([]);
	});

	it('reports an interruption only when a device change was pending', async () => {
		const pendingCall = (name: string, args: unknown) => {
			const context = setup(
				(_pending: LiveFunctionCall, _approval, signal) =>
					new Promise<LiveToolResponse>((_, reject) => {
						signal.addEventListener('abort', () => reject(new Error('aborted')));
					})
			);
			context.call('call_1', name, args);
			return context;
		};

		const read = pendingCall('GetLiveContext', {});
		expect(read.coordinator.cancel()).toBe(false);

		const change = pendingCall('HassTurnOn', turnOn);
		expect(change.coordinator.cancel()).toBe(true);
		expect(change.coordinator.cancel()).toBe(false);
		await settle();
		expect(change.sent).toEqual([]);
		expect(change.coordinator.busy).toBe(false);
	});
});
