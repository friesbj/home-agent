export type LiveServerEvent = Record<string, unknown> & { type: string };

export interface LiveTranscriptState {
	heardText: string;
	spokenText: string;
	thinking: boolean;
	activeDelegations: string[];
	turns: LiveTranscriptTurn[];
}

export interface LiveTranscriptTurn {
	id?: string;
	role: 'user' | 'assistant';
	text: string;
	startMs?: number;
	endMs?: number;
}

const TRANSCRIPT_TURN_GAP_MS = 1500;

export const initialLiveTranscriptState: LiveTranscriptState = {
	heardText: '',
	spokenText: '',
	thinking: false,
	activeDelegations: [],
	turns: []
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseLiveServerEvent(data: unknown): LiveServerEvent {
	if (typeof data !== 'string') throw new Error('Live events must be JSON text.');

	let parsed: unknown;
	try {
		parsed = JSON.parse(data);
	} catch {
		throw new Error('Live event was not valid JSON.');
	}

	if (!isRecord(parsed) || typeof parsed.type !== 'string') {
		throw new Error('Live event did not contain an event type.');
	}
	return parsed as LiveServerEvent;
}

export function reduceLiveTranscript(
	state: LiveTranscriptState,
	event: LiveServerEvent
): LiveTranscriptState {
	if (
		(event.type === 'session.input_transcript.delta' ||
			event.type === 'session.output_transcript.delta') &&
		typeof event.delta === 'string'
	) {
		const role = event.type === 'session.input_transcript.delta' ? 'user' : 'assistant';
		const startMs =
			typeof event.start_ms === 'number' && Number.isFinite(event.start_ms)
				? event.start_ms
				: undefined;
		const endMs =
			typeof event.end_ms === 'number' && Number.isFinite(event.end_ms) ? event.end_ms : startMs;
		const turnIndex = findTranscriptTurnIndex(state.turns, role, startMs, endMs);
		const previousTurn = state.turns[turnIndex];
		const turns = [...state.turns];
		if (previousTurn) {
			turns[turnIndex] = {
				...previousTurn,
				text: previousTurn.text + event.delta,
				...(startMs === undefined
					? {}
					: { startMs: Math.min(previousTurn.startMs ?? startMs, startMs) }),
				...(endMs === undefined ? {} : { endMs: Math.max(previousTurn.endMs ?? endMs, endMs) })
			};
		} else {
			turns.push({
				id: `${role}-${startMs ?? turns.length}`,
				role,
				text: event.delta,
				...(startMs === undefined ? {} : { startMs }),
				...(endMs === undefined ? {} : { endMs })
			});
		}
		const updated = turns[previousTurn ? turnIndex : turns.length - 1].text;
		return {
			...state,
			// Captions follow the latest turn of each speaker rather than the whole session.
			heardText: role === 'user' ? updated : state.heardText,
			spokenText: role === 'assistant' ? updated : state.spokenText,
			turns
		};
	}
	if (
		event.type === 'session.delegation.created' &&
		isRecord(event.delegation) &&
		typeof event.delegation.id === 'string' &&
		event.delegation.id
	)
		return withDelegation(state, event.delegation.id, true);
	const backend = readBackendEvent(event);
	if (backend?.kind === 'started') return withDelegation(state, backend.delegationId, true);
	if (backend?.kind === 'finished') return withDelegation(state, backend.delegationId, false);
	return state;
}

function withDelegation(state: LiveTranscriptState, id: string, active: boolean): LiveTranscriptState {
	const activeDelegations = active
		? [...new Set([...state.activeDelegations, id])]
		: state.activeDelegations.filter((item) => item !== id);
	return { ...state, activeDelegations, thinking: activeDelegations.length > 0 };
}

export interface LiveFunctionCall {
	delegationId: string;
	callId: string;
	name: string;
	arguments: string;
}

export type LiveBackendEvent =
	| { kind: 'started'; delegationId: string }
	| ({ kind: 'function-call' } & LiveFunctionCall)
	| { kind: 'finished'; delegationId: string; ok: boolean };

/**
 * Reads the Responses lifecycle from a `response.event` envelope. Completed function calls arrive
 * as `response.output_item.done`; the forwarded lifecycle snapshots carry no output items.
 */
export function readBackendEvent(event: LiveServerEvent): LiveBackendEvent | undefined {
	if (event.type !== 'response.event' || !isRecord(event.event)) return undefined;
	const delegationId = typeof event.delegation_id === 'string' ? event.delegation_id : '';
	const nested = event.event;

	if (nested.type === 'response.created') return { kind: 'started', delegationId };
	if (nested.type === 'response.completed') return { kind: 'finished', delegationId, ok: true };
	if (nested.type === 'response.failed' || nested.type === 'response.incomplete') {
		return { kind: 'finished', delegationId, ok: false };
	}
	if (nested.type === 'response.output_item.done' && isRecord(nested.item)) {
		const { type, call_id: callId, name, arguments: args } = nested.item;
		if (
			type === 'function_call' &&
			typeof callId === 'string' &&
			typeof name === 'string' &&
			typeof args === 'string'
		) {
			return { kind: 'function-call', delegationId, callId, name, arguments: args };
		}
	}
	return undefined;
}

function findTranscriptTurnIndex(
	turns: LiveTranscriptTurn[],
	role: LiveTranscriptTurn['role'],
	startMs?: number,
	endMs?: number
) {
	if (startMs === undefined) {
		const lastIndex = turns.length - 1;
		return turns[lastIndex]?.role === role ? lastIndex : -1;
	}

	let candidate = -1;
	let latestEnd = Number.NEGATIVE_INFINITY;
	const intervalEnd = endMs ?? startMs;
	for (let index = 0; index < turns.length; index++) {
		const turn = turns[index];
		if (turn.role !== role || turn.endMs === undefined || turn.startMs === undefined) continue;
		const overlaps = startMs <= turn.endMs && intervalEnd >= turn.startMs;
		const withinGap = startMs >= turn.endMs && startMs - turn.endMs <= TRANSCRIPT_TURN_GAP_MS;
		if ((overlaps || withinGap) && turn.endMs >= latestEnd) {
			candidate = index;
			latestEnd = turn.endMs;
		}
	}
	return candidate;
}
