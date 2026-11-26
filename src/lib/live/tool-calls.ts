import type { VoiceActivity, VoiceConfirmation } from '$lib/components/VoiceStage.svelte';
import { baseToolName, evaluateToolCall } from '$lib/home/ha-policy';
import type { LiveBackendEvent, LiveFunctionCall } from './events';
import type { LiveToolResponse } from './protocol';

export interface LiveToolApproval {
	token: string;
	approved: boolean;
}

export interface LiveToolHost {
	/** Sends a client event on the Live data channel. */
	send: (event: Record<string, unknown>) => void;
	/** Asks the server to authorize and run a call; rejects when the request itself fails. */
	execute: (
		call: LiveFunctionCall,
		approval: LiveToolApproval | undefined,
		signal: AbortSignal
	) => Promise<LiveToolResponse>;
	onChange: () => void;
}

type PendingConfirmation = Extract<
	LiveToolResponse,
	{ status: 'confirmation-required' }
>['confirmation'];

interface PendingCall {
	call: LiveFunctionCall;
	kind: VoiceActivity['kind'];
	target: string;
	phase: 'running' | 'confirming' | 'approving' | 'denying';
	confirmation?: PendingConfirmation;
}

export interface LiveToolCard {
	id: string;
	kind: VoiceActivity['kind'];
	/** Base tool name shown in mono, e.g. HassTurnOn, like the text-mode card. */
	label: string;
	/** Human-readable change summary; empty for reads, which show only the tool name. */
	summary: string;
	status: 'running' | 'waiting-confirmation' | 'done' | 'denied' | 'failed' | 'interrupted';
	output?: string;
}

interface Delegation {
	calls: Map<string, PendingCall>;
	submitted: number;
	/** The backend response has finished emitting, so no further calls belong to it. */
	finished: boolean;
}

const READ_TARGETS: Record<string, string> = {
	GetLiveContext: 'Home status',
	GetDateTime: 'Date and time',
	HassGetState: 'Device state',
	HassGetWeather: 'Weather',
	HassClimateGetTemperature: 'Temperature'
};

const PROGRESS: Record<PendingCall['phase'], string> = {
	running: 'Working on it…',
	confirming: 'Waiting for your decision.',
	approving: 'Applying the change…',
	denying: 'Cancelling the change…'
};

const DENIED = 'The user denied this change. Do not retry it.';
const UNKNOWN_OUTCOME =
	'The request failed and the outcome of this change is unknown. Do not retry it automatically; ask the user to check the device.';
const UNAVAILABLE = 'The information is unavailable right now.';

function parseArguments(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

/**
 * Runs the function calls of delegated backend responses through the server and returns their
 * results. Every pending call gets a result before the backend response is continued.
 */
export class LiveToolCoordinator {
	#host: LiveToolHost;
	#abort = new AbortController();
	#delegations = new Map<string, Delegation>();
	#eventCount = 0;
	#cards = new Map<string, LiveToolCard>();

	constructor(host: LiveToolHost) {
		this.#host = host;
	}

	get busy(): boolean {
		return this.#pending().length > 0;
	}

	get cards(): LiveToolCard[] {
		return [...this.#cards.values()];
	}

	get activity(): VoiceActivity | undefined {
		const pending = this.#current();
		if (!pending) return undefined;
		return {
			kind: pending.kind,
			target: pending.target,
			progress:
				pending.phase === 'running' && pending.kind === 'read'
					? 'Reading the current status…'
					: PROGRESS[pending.phase]
		};
	}

	get confirmation(): VoiceConfirmation | undefined {
		const confirmation = this.#confirming()?.confirmation;
		return confirmation && { summary: confirmation.summary, targets: confirmation.targets };
	}

	handle(event: LiveBackendEvent) {
		if (this.#abort.signal.aborted) return;
		if (event.kind === 'started') {
			const delegation = this.#delegations.get(event.delegationId);
			if (delegation) delegation.finished = false;
			return;
		}
		if (event.kind === 'function-call') {
			this.#start(event);
			return;
		}

		const delegation = this.#delegations.get(event.delegationId);
		if (!delegation) return;
		if (event.ok) {
			delegation.finished = true;
			this.#continue(event.delegationId, delegation);
		} else {
			// A failed response accepts no results; late results of its calls are dropped.
			this.#delegations.delete(event.delegationId);
		}
		this.#host.onChange();
	}

	/** Answers the confirmation that is currently shown. */
	respond(approved: boolean) {
		const pending = this.#confirming();
		if (!pending?.confirmation) return;
		pending.phase = approved ? 'approving' : 'denying';
		this.#host.onChange();
		void this.#run(pending, { token: pending.confirmation.token, approved });
	}

	/** Abandons all pending calls. Returns whether a device change was running or awaiting confirmation. */
	cancel(): boolean {
		if (this.#abort.signal.aborted) return false;
		const interrupted = this.#pending().some((pending) => pending.kind === 'change');
		for (const pending of this.#pending()) {
			const card = this.#cards.get(pending.call.callId);
			if (card) this.#cards.set(card.id, { ...card, status: 'interrupted' });
		}
		this.#abort.abort();
		this.#delegations.clear();
		this.#host.onChange();
		return interrupted;
	}

	#pending(): PendingCall[] {
		return [...this.#delegations.values()].flatMap((delegation) => [...delegation.calls.values()]);
	}

	#confirming(): PendingCall | undefined {
		return this.#pending().find((pending) => pending.phase === 'confirming');
	}

	#current(): PendingCall | undefined {
		return this.#confirming() ?? this.#pending()[0];
	}

	#isActive(pending: PendingCall): boolean {
		const { delegationId, callId } = pending.call;
		return (
			!this.#abort.signal.aborted &&
			this.#delegations.get(delegationId)?.calls.get(callId) === pending
		);
	}

	#start(call: LiveFunctionCall) {
		let delegation = this.#delegations.get(call.delegationId);
		if (!delegation) {
			delegation = { calls: new Map(), submitted: 0, finished: false };
			this.#delegations.set(call.delegationId, delegation);
		}
		if (delegation.calls.has(call.callId)) return;

		// Display only; the server authorizes the call independently.
		const evaluation = evaluateToolCall(call.name, parseArguments(call.arguments));
		const base = baseToolName(call.name);
		const pending: PendingCall = {
			call,
			kind: evaluation.kind === 'read' ? 'read' : 'change',
			target: evaluation.kind === 'mutation' ? evaluation.summary : (READ_TARGETS[base] ?? base),
			phase: 'running'
		};
		this.#cards.set(call.callId, {
			id: call.callId,
			kind: pending.kind,
			label: base,
			summary: evaluation.kind === 'mutation' ? evaluation.summary : '',
			status: 'running'
		});
		delegation.calls.set(call.callId, pending);
		this.#host.onChange();
		void this.#run(pending);
	}

	async #run(pending: PendingCall, approval?: LiveToolApproval) {
		let result: LiveToolResponse;
		try {
			result = await this.#host.execute(pending.call, approval, this.#abort.signal);
		} catch {
			if (!this.#isActive(pending)) return;
			const output =
				approval?.approved === false
					? DENIED
					: pending.kind === 'change'
						? UNKNOWN_OUTCOME
						: UNAVAILABLE;
			this.#submit(pending, output, approval?.approved === false ? 'denied' : 'failed');
			return;
		}
		if (!this.#isActive(pending)) return;

		if (result.status === 'completed') {
			this.#submit(
				pending,
				result.output,
				result.outcome === 'denied'
					? 'denied'
					: result.outcome === 'failed' || result.outcome === 'blocked'
						? 'failed'
						: 'done'
			);
		} else if (approval) {
			// The server asked again instead of deciding; never loop on confirmations.
			this.#submit(
				pending,
				'The confirmation could not be verified. Nothing was changed.',
				'failed'
			);
		} else {
			pending.phase = 'confirming';
			pending.confirmation = result.confirmation;
			const card = this.#cards.get(pending.call.callId);
			if (card) this.#cards.set(card.id, { ...card, status: 'waiting-confirmation' });
			this.#host.send({
				type: 'session.commentary.append',
				event_id: this.#eventId(),
				delegation_id: null,
				content: `A change is waiting for the user's confirmation on screen and has not been made yet: ${result.confirmation.summary.slice(0, 300)}. Ask the user to approve or deny it on screen.`
			});
			this.#host.onChange();
		}
	}

	#submit(pending: PendingCall, output: string, status: 'done' | 'denied' | 'failed') {
		const { delegationId, callId } = pending.call;
		const card = this.#cards.get(callId);
		if (card) this.#cards.set(callId, { ...card, status, output });
		const delegation = this.#delegations.get(delegationId);
		if (!delegation) return;
		delegation.calls.delete(callId);
		delegation.submitted += 1;
		this.#host.send({
			type: 'response.item.create',
			event_id: this.#eventId(),
			item: { type: 'function_call_output', call_id: callId, output }
		});
		this.#continue(delegationId, delegation);
		this.#host.onChange();
	}

	/** Resumes the backend once its response has finished and every call has a result. */
	#continue(delegationId: string, delegation: Delegation) {
		if (!delegation.finished || delegation.calls.size > 0) return;
		if (delegation.submitted > 0) {
			this.#host.send({ type: 'response.create', event_id: this.#eventId() });
		}
		this.#delegations.delete(delegationId);
	}

	#eventId(): string {
		return `home-agent-${++this.#eventCount}`;
	}
}
