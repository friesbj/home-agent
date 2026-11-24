<script lang="ts">
	import { tick } from 'svelte';
	import { resolve } from '$app/paths';
	import { House, MessageCircle, Settings } from '@lucide/svelte';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import HomeView from '$lib/components/HomeView.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { getChatSessionManager } from '$lib/home/chat-session.svelte';

	const manager = getChatSessionManager();
	let mobileView = $state<'home' | 'assistant'>('home');
	let assistantView = $state<HTMLElement>();
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
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<div class="lg:h-dvh">
	<div
		class={[
			'mx-auto flex min-h-dvh max-w-7xl flex-col lg:h-dvh lg:min-h-0 lg:px-8 lg:pt-6 lg:pb-7',
			mobileView === 'assistant' ? 'px-0 pt-0' : 'px-5 pt-6'
		]}
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
				<ChatPanel />
			</section>
		</main>
	</div>
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
				type="button"
				class="-mt-6 flex items-center justify-center text-ink-muted aria-pressed:text-ink"
				aria-label="Open text assistant"
				aria-pressed={mobileView === 'assistant'}
				onclick={() => openMobileView('assistant')}
			>
				<span class="relative"
					><AssistantOrb size="nav" animated={mobileView === 'home'} /><MessageCircle
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
</div>
