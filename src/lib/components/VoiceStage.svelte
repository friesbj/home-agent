<script lang="ts">
	import {
		Captions,
		CaptionsOff,
		Eye,
		Mic,
		MicOff,
		PenLine,
		PhoneOff,
		TriangleAlert
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import AssistantOrbCanvas from './AssistantOrbCanvas.svelte';
	import type { OrbVisual } from '$lib/live/orb-visual';
	import { VOICE_CATALOG } from '$lib/config/voices';

	export type VoiceActivity = {
		kind: 'read' | 'change';
		target: string;
		progress: string;
	};

	export type VoiceConfirmation = {
		summary: string;
		targets: string[];
		/** Known only when the application resolved the targets; omitted otherwise. */
		affectedCount?: number;
	};

	export type VoiceStageState =
		/** Permission was never granted (first use) or, when `blocked`, was refused for this site. */
		| { kind: 'needs-microphone'; blocked?: boolean }
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
				/** A problem that did not end the session. */
				notice?: string;
				/** The session is shutting down; the microphone is already off. */
				closing?: boolean;
		  }
		/** `title` names the failure when it is not a lost connection. */
		| { kind: 'error'; message: string; title?: string };

	interface Props {
		state: VoiceStageState;
		/** The configured voice, shown on the first-use screen with a link to Settings. */
		voiceName?: string;
		/** Live audio level (0..1) that drives the orb; omit when no session is connected. */
		getLevel?: () => number;
		/** Captions are off by default; bind this to keep the user's choice between conversations. */
		captionsVisible?: boolean;
		onpermission?: () => void;
		ontogglemicrophone?: () => void;
		onend?: () => void;
		onclose?: () => void;
		onapprove?: () => void;
		ondeny?: () => void;
		onretry?: () => void;
	}

	let {
		state: stageState,
		voiceName,
		getLevel,
		captionsVisible = $bindable(false),
		onpermission,
		ontogglemicrophone,
		onend,
		onclose,
		onapprove,
		ondeny,
		onretry
	}: Props = $props();

	const microphoneOn = $derived(
		(stageState.kind === 'connecting' && stageState.microphoneOn) ||
			(stageState.kind === 'connected' && stageState.microphoneOn)
	);
	const selectedVoice = $derived(VOICE_CATALOG.find((voice) => voice.apiName === voiceName));

	const presentation = $derived.by(() => {
		if (stageState.kind === 'needs-microphone') {
			return stageState.blocked
				? {
						label: 'Microphone blocked',
						detail:
							'Allow the microphone for this site in your browser, for example with the icon next to the address, then try again.',
						orb: 'idle'
					}
				: {
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
			return {
				label: stageState.title ?? 'Connection lost',
				detail: stageState.message,
				orb: 'error'
			};
		}
		if (stageState.kind === 'connected') {
			if (stageState.closing) {
				return { label: 'Ending…', detail: 'Closing your live conversation.', orb: 'muted' };
			}
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
	const confirmationDetails = $derived.by(() => {
		if (!confirmation) return '';
		const count = confirmation.affectedCount;
		return [
			'Change',
			confirmation.targets.join(', ') || 'All matching devices',
			count === undefined ? '' : `${count} ${count === 1 ? 'device' : 'devices'}`
		]
			.filter(Boolean)
			.join(' · ');
	});
	let confirmationCard = $state<HTMLElement>();

	// Focus goes to the card, not a button, so a stray Enter or Space cannot approve.
	$effect(() => {
		if (confirmationCard && onapprove) confirmationCard.focus({ preventScroll: true });
	});
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
</script>

<section
	class="voice-stage mx-auto flex min-h-[min(760px,100dvh)] w-full max-w-[560px] flex-col gap-5 rounded-card p-5 surface-glass sm:p-7"
	aria-label="Live conversation"
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

	<div class="stage-focus flex flex-1 flex-col items-center justify-center gap-4 text-center">
		<div class={['voice-orb', `orb-${presentation.orb}`]} aria-hidden="true">
			<AssistantOrbCanvas orb={presentation.orb as OrbVisual} {getLevel} />
			{#if !microphoneOn}
				<span class="voice-orb-mute"><MicOff size={22} /></span>
			{/if}
		</div>
		<div class="stage-status space-y-1">
			<p class="text-xl font-semibold" role="status" aria-live="polite" aria-atomic="true">
				{presentation.label}
			</p>
			<p class="text-sm text-ink-muted">{presentation.detail}</p>
			{#if connectedState?.notice}
				<p class="mx-auto notice max-w-sm notice-warning text-left text-sm" aria-live="polite">
					<TriangleAlert class="shrink-0 text-warning" size={18} aria-hidden="true" />
					<span>{connectedState.notice}</span>
				</p>
			{/if}
			{#if connectedState}
				<!-- The row keeps its height so the stage does not jump when states overlap. -->
				<div class="min-h-9 pt-2">
					{#if secondarySignals.length > 0}
						<ul class="flex flex-wrap justify-center gap-2" aria-label="Also active">
							{#each secondarySignals as signal (signal)}
								<li class="rounded-full border border-line-strong px-3 py-1 text-xs font-medium">
									{signal}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<div class="stage-details space-y-4">
		{#if stageState.kind === 'needs-microphone'}
			{#if !stageState.blocked}
				<div class="space-y-1 rounded-tile bg-white/5 p-3 text-sm text-ink-muted">
					<p>
						While a conversation is open, your voice is sent to the model provider. Voice
						transcripts are stored unencrypted in this browser's chat history.
					</p>
					{#if voiceName}
						<p class="flex flex-wrap items-center gap-x-2">
							<span>
								Voice:
								<span class="font-medium text-ink">
									{selectedVoice?.name ?? voiceName}{selectedVoice?.character
										? ` · ${selectedVoice.character}`
										: ''}
								</span>
							</span>
							<a
								class="inline-flex min-h-11 items-center font-medium text-accent-ink underline"
								href={resolve('/settings')}>Change in Settings</a
							>
						</p>
					{/if}
				</div>
			{/if}
		{:else if stageState.kind === 'connecting' || stageState.kind === 'connected'}
			<!-- Voice comes first: captions are an option, off until the user asks for them. -->
			<button
				type="button"
				class="mx-auto flex min-h-11 items-center gap-2 rounded-control px-3 text-sm text-ink-muted hover:text-ink"
				onclick={() => (captionsVisible = !captionsVisible)}
				aria-expanded={captionsVisible}
			>
				{#if captionsVisible}
					<CaptionsOff size={16} aria-hidden="true" /> Hide captions
				{:else}
					<Captions size={16} aria-hidden="true" /> Show captions
				{/if}
			</button>
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
			<section
				class="rounded-tile p-4 surface-solid"
				aria-labelledby="voice-confirmation-title"
				aria-describedby="voice-confirmation-summary"
				tabindex="-1"
				bind:this={confirmationCard}
			>
				<h3 id="voice-confirmation-title" class="font-semibold">Waiting for your confirmation</h3>
				<p id="voice-confirmation-summary" class="mt-2">{confirmation.summary}</p>
				<p class="mt-1 text-sm text-ink-muted">{confirmationDetails}</p>
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
			{#if stageState.kind === 'needs-microphone'}
				<button
					type="button"
					class="btn min-h-12 btn-primary"
					disabled={!onpermission}
					onclick={onpermission}
				>
					{stageState.blocked ? 'Try again' : 'Allow microphone'}
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
					disabled={!ontogglemicrophone || stageState.closing}
					onclick={ontogglemicrophone}
				>
					{#if stageState.microphoneOn}
						<MicOff size={17} aria-hidden="true" /> Turn microphone off
					{:else}
						<Mic size={17} aria-hidden="true" /> Turn microphone on
					{/if}
				</button>
			{/if}
			{#if stageState.kind === 'connecting' || stageState.kind === 'connected'}
				<button
					type="button"
					class={['btn min-h-12 btn-secondary', stageState.kind === 'connecting' && 'col-span-2']}
					disabled={!onend || connectedState?.closing}
					onclick={onend}
				>
					<PhoneOff size={17} aria-hidden="true" /> End
				</button>
			{/if}
		</div>
		{#if stageState.kind === 'needs-microphone' || stageState.kind === 'error'}
			<div class="flex justify-center">
				<button
					type="button"
					class="btn min-h-12 btn-secondary"
					disabled={!onclose}
					onclick={onclose}
				>
					Close
				</button>
			</div>
		{/if}
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
	@media (max-height: 600px) {
		.voice-orb {
			width: 140px;
		}
	}
	/* A phone in landscape: the orb on the left; status, captions, and controls on the right. */
	@media (orientation: landscape) and (max-height: 500px) {
		.voice-stage {
			display: grid;
			grid-template-columns: minmax(96px, 28%) minmax(0, 1fr);
			column-gap: 1.25rem;
			align-items: center;
			min-height: 0;
		}
		.voice-stage > header {
			grid-column: 1 / -1;
		}
		.stage-focus {
			display: contents;
		}
		.voice-orb {
			grid-row: 2 / span 2;
			grid-column: 1;
			justify-self: center;
			width: min(100%, 140px);
		}
		.stage-status,
		.stage-details {
			grid-column: 2;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.voice-orb {
			transition: none;
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
</style>
