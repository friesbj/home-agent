import { describe, expect, it } from 'vitest';
import {
	initialLiveTranscriptState,
	parseLiveServerEvent,
	readBackendEvent,
	reduceLiveTranscript,
	type LiveServerEvent
} from './events';

const reduce = (events: LiveServerEvent[]) =>
	events.reduce(reduceLiveTranscript, initialLiveTranscriptState);

describe('Live data-channel events', () => {
	it('rejects malformed or non-JSON event messages', () => {
		expect(() => parseLiveServerEvent('{')).toThrow('Live event was not valid JSON.');
		expect(() => parseLiveServerEvent(JSON.stringify({ delta: 'missing type' }))).toThrow(
			'Live event did not contain an event type.'
		);
	});

	it('groups overlapping speech by speaker and session timeline', () => {
		const state = reduce([
			{ type: 'session.input_transcript.delta', start_ms: 1000, end_ms: 1200, delta: 'Turn on ' },
			{
				type: 'session.output_transcript.delta',
				start_ms: 1100,
				end_ms: 1300,
				delta: 'I can do that.'
			},
			{ type: 'session.input_transcript.delta', start_ms: 1200, end_ms: 1500, delta: 'the light.' }
		]);

		expect(state.turns).toEqual([
			{ id: 'user-1000', role: 'user', startMs: 1000, endMs: 1500, text: 'Turn on the light.' },
			{
				id: 'assistant-1100',
				role: 'assistant',
				startMs: 1100,
				endMs: 1300,
				text: 'I can do that.'
			}
		]);
		expect(state.heardText).toBe('Turn on the light.');
		expect(state.spokenText).toBe('I can do that.');
	});

	it('starts a new turn after a pause and captions only the latest one', () => {
		const state = reduce([
			{
				type: 'session.input_transcript.delta',
				start_ms: 1000,
				end_ms: 1500,
				delta: 'Turn on the light.'
			},
			{ type: 'session.input_transcript.delta', start_ms: 5000, end_ms: 5400, delta: 'Thanks.' }
		]);

		expect(state.turns.map((turn) => turn.text)).toEqual(['Turn on the light.', 'Thanks.']);
		expect(state.heardText).toBe('Thanks.');
	});

	it('tracks Responses delegation across continued backend responses', () => {
		const response = (type: string): LiveServerEvent => ({
			type: 'response.event',
			delegation_id: 'delegation_1',
			event: { type }
		});
		const events = [
			{ type: 'session.delegation.created', delegation: { id: 'delegation_1' } },
			response('response.output_text.delta')
		];
		expect(reduce(events).thinking).toBe(true);

		events.push(response('response.completed'));
		expect(reduce(events).thinking).toBe(false);

		events.push(response('response.created'));
		expect(reduce(events).thinking).toBe(true);

		events.push(response('response.failed'));
		expect(reduce(events).thinking).toBe(false);
	});

	it('keeps thinking while another delegation is still running', () => {
		const events: LiveServerEvent[] = [
			{ type: 'session.delegation.created', delegation: { id: 'first' } },
			{ type: 'session.delegation.created', delegation: { id: 'second' } },
			{ type: 'response.event', delegation_id: 'first', event: { type: 'response.created' } },
			{ type: 'response.event', delegation_id: 'second', event: { type: 'response.created' } },
			{ type: 'response.event', delegation_id: 'first', event: { type: 'response.completed' } }
		];
		expect(reduce(events).thinking).toBe(true);
		events.push({
			type: 'response.event',
			delegation_id: 'second',
			event: { type: 'response.failed' }
		});
		expect(reduce(events).thinking).toBe(false);
	});

	it('reads completed function calls only from nested output items', () => {
		const item = { type: 'function_call', call_id: 'call_1', name: 'HassTurnOn', arguments: '{}' };
		const envelope = (event: Record<string, unknown>): LiveServerEvent => ({
			type: 'response.event',
			delegation_id: 'delegation_1',
			event
		});

		expect(readBackendEvent(envelope({ type: 'response.output_item.done', item }))).toEqual({
			kind: 'function-call',
			delegationId: 'delegation_1',
			callId: 'call_1',
			name: 'HassTurnOn',
			arguments: '{}'
		});
		// An arguments-done event alone does not identify the call.
		expect(
			readBackendEvent(envelope({ type: 'response.function_call_arguments.done', arguments: '{}' }))
		).toBeUndefined();
		expect(
			readBackendEvent(envelope({ type: 'response.output_item.done', item: { type: 'message' } }))
		).toBeUndefined();
		expect(
			readBackendEvent(
				envelope({ type: 'response.output_item.done', item: { ...item, call_id: undefined } })
			)
		).toBeUndefined();
		expect(readBackendEvent({ type: 'response.output_item.done', item })).toBeUndefined();
	});
});
