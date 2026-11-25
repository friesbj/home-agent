<script lang="ts">
	import { X } from '@lucide/svelte';
	import VoiceStage, { type VoiceStageState } from '$lib/components/VoiceStage.svelte';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	const samples: { name: string; state: VoiceStageState }[] = [
		{ name: 'Ready', state: { kind: 'ready' } },
		{ name: 'Needs microphone', state: { kind: 'needs-microphone' } },
		{ name: 'Connecting', state: { kind: 'connecting', microphoneOn: true } },
		{
			name: 'Listening',
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: true,
				speaking: false,
				thinking: false,
				heardText: 'Turn on the kitchen lights.'
			}
		},
		{
			name: 'Speaking',
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: true,
				speaking: true,
				thinking: false,
				heardText: 'Turn on the kitchen lights.',
				spokenText: 'I can do that. Please confirm the change on screen.'
			}
		},
		{
			name: 'Thinking and delegation',
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: true,
				speaking: true,
				thinking: true,
				heardText: 'Which lights are on?',
				spokenText: 'I am checking that now.'
			}
		},
		{
			name: 'Tool use',
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: true,
				speaking: false,
				thinking: true,
				activity: {
					kind: 'read',
					target: 'Get live home context',
					progress: 'Reading the current home status…'
				},
				heardText: 'Which lights are on?'
			}
		},
		{
			name: 'Confirmation',
			state: {
				kind: 'connected',
				microphoneOn: true,
				listening: false,
				speaking: false,
				thinking: true,
				activity: {
					kind: 'change',
					target: 'Kitchen lights',
					progress: 'Waiting for your decision.'
				},
				confirmation: {
					summary: 'Turn on the kitchen lights?',
					targets: ['Kitchen'],
					affectedCount: 2
				},
				heardText: 'Turn on the kitchen lights.'
			}
		},
		{
			name: 'Microphone off',
			state: {
				kind: 'connected',
				microphoneOn: false,
				listening: false,
				speaking: true,
				thinking: false,
				spokenText: 'Your microphone is off. Turn it on when you are ready.'
			}
		},
		{
			name: 'Error',
			state: { kind: 'error', message: 'The connection ended. Try again when you are ready.' }
		}
	];
</script>

<div class="fixed inset-0 z-50 overflow-y-auto bg-canvas/95 p-4 text-ink sm:p-8">
	<div class="mx-auto max-w-7xl">
		<header class="mb-6 flex items-start justify-between gap-4">
			<div>
				<p class="text-xs font-semibold tracking-[0.18em] text-accent-ink uppercase">
					Development only
				</p>
				<h1 class="mt-1 text-2xl font-bold">Voice state gallery</h1>
				<p class="mt-2 max-w-2xl text-sm text-ink-muted">
					Design previews only. No microphone, audio, or GPT-Live connection is active. Controls in
					the samples are disabled.
				</p>
			</div>
			<button
				type="button"
				class="btn shrink-0 btn-secondary"
				aria-label="Close voice state gallery"
				onclick={onclose}
			>
				<X size={18} aria-hidden="true" /> Close
			</button>
		</header>

		<div class="grid gap-6 lg:grid-cols-2">
			{#each samples as sample (sample.name)}
				<article>
					<h2 class="mb-2 text-sm font-semibold text-ink-muted">{sample.name}</h2>
					<VoiceStage state={sample.state} />
				</article>
			{/each}
		</div>
	</div>
</div>
