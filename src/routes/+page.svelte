<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { House, Mic, Settings } from '@lucide/svelte';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import HomeView from '$lib/components/HomeView.svelte';
	import VoiceStage, { type VoiceStageState } from '$lib/components/VoiceStage.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { savedMcpTarget } from '$lib/home/api';
	import { getChatSessionManager } from '$lib/home/chat-session.svelte';
	import { LiveSessionController } from '$lib/live/live-session';

	const manager = getChatSessionManager();
	let mobileView = $state<'home' | 'assistant'>('home');
	let assistantMode = $state<'text' | 'voice'>('text');
	let assistantView = $state<HTMLElement>();
	let voiceOverlay = $state<HTMLElement>();
	let liveAudio = $state<HTMLAudioElement>();
	let voiceState = $state<VoiceStageState>({ kind: 'ready' });
	// The choice lasts while this page is open; every visit starts without captions.
	let captionsVisible = $state(false);
	let voiceOpenerId = 'start-voice';
	const liveSession = new LiveSessionController({
		onState: (state) => (voiceState = state),
		getConfiguration: () => ({
			apiKey: appConfig.getSecret('openaiApiKey'),
			backendModel: appConfig.settings.models.backendModel,
			voice: appConfig.settings.models.voice,
			mcp: savedMcpTarget(),
			confirmation: appConfig.confirmation
		}),
		onTranscript: (turns) => manager.appendVoiceTranscript(turns),
		// Same notice as an interrupted text response: the outcome of the change is unknown.
		onInterrupted: () => (manager.interruptedTools = true)
	});
	const serverLabel = $derived(
		appConfig.settings.mcp.displayName ||
			(appConfig.settings.mcp.url ? new URL(appConfig.settings.mcp.url).host : 'Not configured')
	);

	function openMobileView(view: 'home' | 'assistant') {
		mobileView = view;
		window.scrollTo({ top: 0 });
	}

	/**
	 * Shows the Assistant and moves focus into it. The button that triggered this can disappear
	 * with the Home view, and focus on a hidden element would fall back to the page body.
	 */
	async function showAssistant(focus: 'composer' | 'view') {
		openMobileView('assistant');
		await tick();
		const target = focus === 'composer' ? document.getElementById('chat-input') : assistantView;
		target?.focus({ preventScroll: true });
	}

	function runShortcut(request: string) {
		if (manager.submitShortcut(request)) void showAssistant('view');
	}

	/**
	 * Opens the voice stage. With the microphone already allowed it connects at once; otherwise
	 * the stage shows the first-use or blocked screen. `openerId` is where focus returns on close.
	 */
	async function showVoiceAssistant(openerId: string) {
		// Voice turns are appended to this chat, which must not be mid-response or awaiting approval.
		if (manager.shortcutBlockedReason) {
			await showAssistant('view');
			return;
		}
		voiceOpenerId = openerId;
		assistantMode = 'voice';
		openMobileView('assistant');
		await tick();
		if (await liveSession.prepare()) startLiveConversation();
		await tick();
		voiceOverlay
			?.querySelector<HTMLButtonElement>('.btn-primary:not([disabled]), .btn:not([disabled])')
			?.focus({ preventScroll: true });
	}

	async function showTextAssistant() {
		const wasConnected = voiceState.kind === 'connected';
		await liveSession.end();
		if (wasConnected && voiceState.kind === 'error') manager.notice = voiceState.message;
		assistantMode = 'text';
		openMobileView('assistant');
		await tick();
		// The opener may be hidden now, for example the Home card behind the Assistant view.
		const opener = document.getElementById(voiceOpenerId);
		(opener?.checkVisibility() ? opener : assistantView)?.focus({ preventScroll: true });
	}

	function startLiveConversation() {
		if (!liveAudio) {
			voiceState = { kind: 'error', message: 'Audio playback is not available in this browser.' };
			return;
		}
		void liveSession.start(liveAudio);
	}

	function handleVoiceKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			void showTextAssistant();
			return;
		}
		if (event.key !== 'Tab' || !voiceOverlay) return;

		const controls = Array.from(
			voiceOverlay.querySelectorAll<HTMLElement>(
				'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
			)
		);
		const first = controls[0];
		const last = controls.at(-1);
		if (!first || !last) return;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	onDestroy(() => {
		void liveSession.end();
	});
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<div class="lg:h-dvh">
	<div
		class={[
			'mx-auto flex min-h-dvh max-w-7xl flex-col lg:h-dvh lg:min-h-0 lg:px-8 lg:pt-6 lg:pb-7',
			mobileView === 'assistant' ? 'px-0 pt-0' : 'px-5 pt-6'
		]}
		inert={assistantMode === 'voice'}
	>
		<header
			class={[
				'flex shrink-0 items-center justify-between gap-4 lg:pointer-events-auto lg:static lg:p-0 lg:pb-6',
				mobileView === 'assistant'
					? 'pointer-events-none absolute top-[env(safe-area-inset-top)] left-0 z-10 p-2'
					: 'pb-6'
			]}
		>
			<div class="flex min-w-0 items-center gap-3">
				<span
					class={['icon-well', mobileView === 'assistant' && 'max-lg:size-10 max-lg:border-0']}
					aria-hidden="true"
				>
					<House class="text-accent-ink" size={21} strokeWidth={1.75} />
				</span>
				<div class={['min-w-0', mobileView === 'assistant' && 'max-lg:hidden']}>
					<h1 class="text-lg font-bold tracking-tight">Home Agent</h1>
					<p class="truncate text-sm text-ink-muted">{serverLabel}</p>
				</div>
			</div>
			<a
				class="btn hidden surface-glass hover:bg-white/10 lg:inline-flex"
				href={resolve('/settings')}><Settings size={18} aria-hidden="true" /> Settings</a
			>
		</header>

		<main
			class={[
				'grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-rows-1 lg:px-0 lg:pb-0',
				mobileView === 'assistant' ? 'px-0 pt-[env(safe-area-inset-top)]' : 'px-0'
			]}
		>
			<section
				class={['min-h-0 lg:block lg:overflow-y-auto lg:pr-2', { hidden: mobileView !== 'home' }]}
				aria-label="Home"
			>
				<HomeView
					onopenassistant={() => showAssistant('composer')}
					onstartvoice={() => showVoiceAssistant('home-voice')}
					onshortcut={runShortcut}
					shortcutBlockedReason={manager.shortcutBlockedReason}
				/>
			</section>

			<section
				class={[
					'min-h-0 outline-none lg:block lg:h-auto',
					mobileView === 'assistant'
						? 'h-[calc(100dvh-5.5rem-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'
						: 'hidden h-[calc(100dvh-12rem-env(safe-area-inset-bottom))]'
				]}
				aria-label="Assistant"
				tabindex="-1"
				bind:this={assistantView}
			>
				<div class="h-full min-h-0" class:hidden={assistantMode === 'voice'}>
					<ChatPanel onstartvoice={() => showVoiceAssistant('start-voice')} />
				</div>
			</section>
		</main>
	</div>
	{#if assistantMode === 'voice'}
		<div
			class="fixed inset-0 z-30 overflow-y-auto bg-canvas/90 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:grid lg:place-items-center lg:p-8"
			role="dialog"
			aria-modal="true"
			aria-label="Live conversation"
			bind:this={voiceOverlay}
			onkeydown={handleVoiceKeydown}
			tabindex="-1"
		>
			<VoiceStage
				state={voiceState}
				voiceName={appConfig.settings.models.voice}
				getLevel={() => liveSession.audioLevel}
				bind:captionsVisible
				onstart={startLiveConversation}
				onpermission={startLiveConversation}
				ontogglemicrophone={() => liveSession.toggleMicrophone()}
				onapprove={() => liveSession.respondToConfirmation(true)}
				ondeny={() => liveSession.respondToConfirmation(false)}
				onend={() => void liveSession.end()}
				onbacktotext={() => void showTextAssistant()}
				onretry={startLiveConversation}
			/>
		</div>
		<audio bind:this={liveAudio} class="sr-only" autoplay playsinline aria-hidden="true"></audio>
	{/if}
	{#if assistantMode === 'text'}
		<nav
			aria-label="Main navigation"
			class="fixed inset-x-0 bottom-0 z-20 rounded-t-[24px] border-t surface-bar px-5 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
		>
			<div class="mx-auto grid max-w-xs grid-cols-3 items-end">
				<button
					type="button"
					class="flex min-h-12 items-center justify-center text-ink-muted aria-pressed:text-ink"
					aria-label="Home"
					aria-pressed={mobileView === 'home'}
					onclick={() => openMobileView('home')}
				>
					<House size={24} aria-hidden="true" />
				</button>
				<button
					id="voice-orb"
					type="button"
					class="-mt-6 flex items-center justify-center text-ink"
					aria-label="Start voice mode"
					onclick={() => showVoiceAssistant('voice-orb')}
				>
					<span class="relative"
						><AssistantOrb size="nav" animated={mobileView === 'home'} /><Mic
							class="absolute inset-0 m-auto"
							size={22}
							aria-hidden="true"
						/></span
					>
				</button>
				<a
					class="flex min-h-12 items-center justify-center text-ink-muted"
					aria-label="Settings"
					href={resolve('/settings')}
				>
					<Settings size={24} aria-hidden="true" />
				</a>
			</div>
		</nav>
	{/if}
</div>
