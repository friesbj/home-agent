<script lang="ts">
	import { resolve } from '$app/paths';
	import { House, MessageCircle, Settings } from '@lucide/svelte';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import HomeView from '$lib/components/HomeView.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { getChatSessionManager } from '$lib/home/chat-session.svelte';

	const manager = getChatSessionManager();
	let mobileView = $state<'home' | 'assistant'>('home');
	const serverLabel = $derived(
		appConfig.settings.mcp.displayName ||
			(appConfig.settings.mcp.url ? new URL(appConfig.settings.mcp.url).host : 'Not configured')
	);

	function openMobileView(view: 'home' | 'assistant') {
		mobileView = view;
		window.scrollTo({ top: 0 });
	}

	function runShortcut(request: string) {
		if (manager.submitShortcut(request)) openMobileView('assistant');
	}
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<div class="lg:h-dvh">
	<div
		class="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 pt-6 lg:h-dvh lg:min-h-0 lg:px-8 lg:pb-7"
	>
		<header class="flex shrink-0 items-center justify-between gap-4 pb-6">
			<div class="flex min-w-0 items-center gap-3">
				<span class="icon-well" aria-hidden="true">
					<House class="text-accent-ink" size={21} strokeWidth={1.75} />
				</span>
				<div class="min-w-0">
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
			class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-6 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-rows-1 lg:pb-0"
		>
			<section
				class={['min-h-0 lg:block lg:overflow-y-auto lg:pr-2', { hidden: mobileView !== 'home' }]}
				aria-label="Home"
			>
				<HomeView
					onopenassistant={() => openMobileView('assistant')}
					onshortcut={runShortcut}
					shortcutBlockedReason={manager.shortcutBlockedReason}
				/>
			</section>

			<section
				class={[
					'h-[calc(100dvh-12rem-env(safe-area-inset-bottom))] min-h-0 lg:block lg:h-auto',
					{ hidden: mobileView !== 'assistant' }
				]}
				aria-label="Assistant"
			>
				<ChatPanel />
			</section>
		</main>
	</div>
	<nav
		aria-label="Main navigation"
		class="fixed inset-x-0 bottom-0 z-20 rounded-t-[28px] border-t surface-bar px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
	>
		<div class="mx-auto grid max-w-md grid-cols-3 items-end">
			<button
				type="button"
				class="flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold text-ink-muted aria-pressed:text-ink"
				aria-pressed={mobileView === 'home'}
				onclick={() => openMobileView('home')}
			>
				<House size={22} aria-hidden="true" /> Home
			</button>
			<button
				type="button"
				class="-mt-8 flex min-h-16 flex-col items-center gap-1 text-sm font-semibold text-ink-muted aria-pressed:text-ink"
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
				Assistant
			</button>
			<a
				class="flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold text-ink-muted"
				href={resolve('/settings')}
			>
				<Settings size={22} aria-hidden="true" /> Settings
			</a>
		</div>
	</nav>
</div>
