<script lang="ts">
	import { ArrowLeft, Eye, Mic, MicOff, PenLine, PhoneOff } from '@lucide/svelte';
	import AssistantOrb from './AssistantOrb.svelte';

	export type VoiceActivity = {
		kind: 'read' | 'change';
		target: string;
		progress: string;
	};

	export type VoiceConfirmation = {
		summary: string;
		targets: string[];
		affectedCount: number;
	};

	export type VoiceStageState =
		| { kind: 'ready' }
		| { kind: 'needs-microphone' }
		| { kind: 'connecting'; microphoneOn: boolean }
		| {
				kind: 'connected';
				microphoneOn: boolean;
				listening: boolean;
				speaking: boolean;
				thinking: boolean;
				heardText?: string;
				spokenText?: string;
				activity?: VoiceActivity;
				confirmation?: VoiceConfirmation;
		  }
		| { kind: 'error'; message: string };

	interface Props {
		state: VoiceStageState;
		onstart?: () => void;
		onpermission?: () => void;
		ontogglemicrophone?: () => void;
		onend?: () => void;
		onbacktotext?: () => void;
		onapprove?: () => void;
		ondeny?: () => void;
		onretry?: () => void;
	}

	let {
		state: stageState,
		onstart,
		onpermission,
		ontogglemicrophone,
		onend,
		onbacktotext,
		onapprove,
		ondeny,
		onretry
	}: Props = $props();
	let captionsVisible = $state(true);

	const microphoneOn = $derived(
		(stageState.kind === 'connecting' && stageState.microphoneOn) ||
			(stageState.kind === 'connected' && stageState.microphoneOn)
	);

	const presentation = $derived.by(() => {
		if (stageState.kind === 'needs-microphone') {
			return {
				label: 'Microphone access needed',
				detail: 'Allow microphone access to start a voice conversation.',
				orb: 'idle'
			};
		}
		if (stageState.kind === 'connecting') {
			return {
				label: 'Connecting…',
				detail: 'Setting up your live conversation.',
				orb: 'connecting'
			};
		}
		if (stageState.kind === 'error') {
			return { label: 'Connection lost', detail: stageState.message, orb: 'error' };
		}
		if (stageState.kind === 'connected') {
			if (stageState.confirmation) {
				return {
					label: 'Waiting for your confirmation',
					detail: 'Review the requested change below.',
					orb: 'confirming'
				};
			}
			if (stageState.speaking) {
				return { label: 'Speaking', detail: 'The assistant is responding.', orb: 'speaking' };
			}
			if (stageState.thinking) {
				return {
					label: 'Working on it…',
					detail: 'The assistant is checking your request.',
					orb: 'thinking'
				};
			}
			if (stageState.listening && stageState.microphoneOn) {
				return { label: 'Listening', detail: 'You can speak naturally.', orb: 'listening' };
			}
			return {
				label: stageState.microphoneOn ? 'Connected' : 'Ready',
				detail: stageState.microphoneOn
					? 'Your live conversation is connected.'
					: 'Turn the microphone on to continue.',
				orb: stageState.microphoneOn ? 'listening' : 'muted'
			};
		}
		return { label: 'Ready', detail: 'Start a live conversation with your home.', orb: 'idle' };
	});

	const connectedState = $derived(stageState.kind === 'connected' ? stageState : undefined);
	const activity = $derived(connectedState?.activity);
	const confirmation = $derived(connectedState?.confirmation);
	const secondarySignals = $derived.by(() => {
		if (!connectedState) return [];
		const signals = [];
		if (connectedState.speaking && presentation.label !== 'Speaking') signals.push('Speaking');
		if (connectedState.thinking && presentation.label !== 'Working on it…') {
			signals.push('Working on it');
		}
		if (
			connectedState.listening &&
			connectedState.microphoneOn &&
			presentation.label !== 'Listening'
		) {
			signals.push('Listening');
		}
		return signals;
	});

	function backToText() {
		onbacktotext?.();
	}
</script>

<section
	class="voice-stage mx-auto flex min-h-[min(760px,100dvh)] w-full max-w-[560px] flex-col gap-5 rounded-card p-5 surface-glass sm:p-7"
	aria-label="Live conversation preview"
>
	<header class="flex items-start justify-between gap-3">
		<div>
			<p class="text-xs font-semibold tracking-[0.18em] text-accent-ink uppercase">
				Live conversation
			</p>
			<h2 class="mt-1 text-xl font-bold tracking-tight">Home Agent</h2>
		</div>
		<div
			class="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong px-3 text-sm font-medium"
			aria-label="Microphone {microphoneOn ? 'on' : 'off'}"
		>
			{#if microphoneOn}
				<Mic size={16} aria-hidden="true" />
				<span>Microphone on</span>
			{:else}
				<MicOff size={16} aria-hidden="true" />
				<span>Microphone off</span>
			{/if}
		</div>
	</header>

	<div class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
		<div class={['voice-orb', `orb-${presentation.orb}`]} aria-hidden="true">
			<AssistantOrb size="hero" />
			{#if !microphoneOn}
				<span class="voice-orb-mute"><MicOff size={22} /></span>
			{/if}
		</div>
		<div class="space-y-1">
			<p class="text-xl font-semibold" role="status" aria-live="polite" aria-atomic="true">
				{presentation.label}
			</p>
			<p class="text-sm text-ink-muted">{presentation.detail}</p>
			{#if secondarySignals.length > 0}
				<ul class="flex flex-wrap justify-center gap-2 pt-2" aria-label="Also active">
					{#each secondarySignals as signal (signal)}
						<li class="rounded-full border border-line-strong px-3 py-1 text-xs font-medium">
							{signal}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<div class="space-y-4">
		<div class="flex items-center justify-between gap-3">
			<h3 class="text-sm font-semibold">Captions</h3>
			<button
				type="button"
				class="min-h-11 rounded-control px-3 text-sm text-ink-muted hover:bg-white/10 hover:text-ink"
				onclick={() => (captionsVisible = !captionsVisible)}
				aria-expanded={captionsVisible}
			>
				{captionsVisible ? 'Hide captions' : 'Show captions'}
			</button>
		</div>
		{#if captionsVisible}
			<div
				class="space-y-2 rounded-tile bg-white/5 p-3 text-sm"
				role="group"
				aria-label="Captions"
				aria-live="off"
			>
				{#if connectedState?.heardText}
					<p class="text-ink-muted">
						<span class="font-semibold text-ink">You:</span>
						{connectedState.heardText}
					</p>
				{/if}
				{#if connectedState?.spokenText}
					<p>
						<span class="font-semibold text-accent-ink">Home Agent:</span>
						{connectedState.spokenText}
					</p>
				{/if}
				{#if !connectedState?.heardText && !connectedState?.spokenText}
					<p class="text-ink-muted">Captions will appear here during a conversation.</p>
				{/if}
			</div>
		{/if}

		{#if activity}
			<div class="rounded-tile p-3 text-sm surface-solid" aria-label="Tool activity">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold uppercase"
						class:tool-read={activity.kind === 'read'}
						class:tool-change={activity.kind === 'change'}
					>
						{#if activity.kind === 'read'}
							<Eye size={13} aria-hidden="true" /> Read
						{:else}
							<PenLine size={13} aria-hidden="true" /> Change
						{/if}
					</span>
					<span class="font-medium">{activity.target}</span>
				</div>
				<p class="mt-2 text-ink-muted">{activity.progress}</p>
			</div>
		{/if}

		{#if confirmation}
			<section class="rounded-tile p-4 surface-solid" aria-labelledby="voice-confirmation-title">
				<h3 id="voice-confirmation-title" class="font-semibold">Waiting for your confirmation</h3>
				<p class="mt-2">{confirmation.summary}</p>
				<p class="mt-1 text-sm text-ink-muted">
					Change · {confirmation.targets.join(', ')} · {confirmation.affectedCount}
					{confirmation.affectedCount === 1 ? 'device' : 'devices'}
				</p>
				<div class="mt-4 flex flex-wrap gap-2">
					<button type="button" class="btn btn-primary" disabled={!onapprove} onclick={onapprove}>
						Approve
					</button>
					<button type="button" class="btn btn-secondary" disabled={!ondeny} onclick={ondeny}>
						Deny
					</button>
				</div>
			</section>
		{/if}

		<div class="grid grid-cols-2 gap-3">
			{#if stageState.kind === 'ready'}
				<button
					type="button"
					class="btn min-h-12 btn-primary"
					disabled={!onstart}
					onclick={onstart}
				>
					Start conversation
				</button>
			{:else if stageState.kind === 'needs-microphone'}
				<button
					type="button"
					class="btn min-h-12 btn-primary"
					disabled={!onpermission}
					onclick={onpermission}
				>
					Allow microphone
				</button>
			{:else if stageState.kind === 'error'}
				<button
					type="button"
					class="btn min-h-12 btn-primary"
					disabled={!onretry}
					onclick={onretry}
				>
					Try again
				</button>
			{:else if stageState.kind === 'connected'}
				<button
					type="button"
					class="btn min-h-12 btn-secondary"
					disabled={!ontogglemicrophone}
					onclick={ontogglemicrophone}
				>
					{#if stageState.microphoneOn}
						<MicOff size={17} aria-hidden="true" /> Turn microphone off
					{:else}
						<Mic size={17} aria-hidden="true" /> Turn microphone on
					{/if}
				</button>
			{:else}
				<span></span>
			{/if}
			{#if stageState.kind === 'connecting' || stageState.kind === 'connected'}
				<button type="button" class="btn min-h-12 btn-secondary" disabled={!onend} onclick={onend}>
					<PhoneOff size={17} aria-hidden="true" /> End
				</button>
			{:else}
				<span></span>
			{/if}
		</div>

		<button
			type="button"
			class="mx-auto flex min-h-11 items-center gap-2 px-3 text-sm text-ink-muted hover:text-ink"
			disabled={!onbacktotext}
			onclick={backToText}
		>
			<ArrowLeft size={16} aria-hidden="true" /> Back to text
		</button>
	</div>
</section>

<style>
	.voice-orb {
		position: relative;
		display: grid;
		width: min(60vw, 320px);
		place-items: center;
		transition:
			opacity 250ms var(--ease-calm),
			transform 250ms var(--ease-calm),
			filter 250ms var(--ease-calm);
	}
	.voice-orb :global(.assistant-orb.hero) {
		width: 100%;
	}
	.voice-orb-mute {
		position: absolute;
		display: grid;
		width: 44px;
		height: 44px;
		place-items: center;
		border: 1px solid rgb(252 252 255 / 0.4);
		border-radius: 9999px;
		background: var(--color-surface-solid);
		color: var(--color-ink);
	}
	.orb-idle {
		opacity: 0.62;
		transform: scale(0.9);
	}
	.orb-connecting::after {
		position: absolute;
		inset: -8%;
		border: 2px solid transparent;
		border-top-color: var(--color-cool);
		border-radius: 50%;
		animation: connect-turn 2.4s linear infinite;
		content: '';
	}
	.orb-listening:not(.orb-muted) {
		animation: listen-breathe 4s ease-in-out infinite;
	}
	.orb-speaking {
		animation: speak-breathe 2.2s ease-in-out infinite;
	}
	.orb-thinking {
		animation: think-turn 24s linear infinite;
	}
	.orb-confirming {
		opacity: 0.76;
		transform: scale(0.46);
	}
	.orb-muted {
		filter: grayscale(0.7);
		opacity: 0.52;
	}
	.orb-error {
		filter: grayscale(0.8);
		opacity: 0.6;
	}
	@keyframes connect-turn {
		to {
			transform: rotate(360deg);
		}
	}
	@keyframes listen-breathe {
		50% {
			transform: scale(1.025);
		}
	}
	@keyframes speak-breathe {
		50% {
			transform: scale(1.035);
		}
	}
	@keyframes think-turn {
		to {
			transform: rotate(360deg);
		}
	}
	.tool-read {
		border-color: rgb(127 220 255 / 0.5);
		color: var(--color-cool);
	}
	.tool-change {
		border-color: rgb(247 199 104 / 0.55);
		color: var(--color-warning);
	}
	@media (max-height: 599px) {
		.voice-orb {
			width: 140px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.voice-orb,
		.voice-orb::after {
			animation: none !important;
		}
	}
</style>
