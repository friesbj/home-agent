<script lang="ts">
	import { resolve } from '$app/paths';
	import { ArrowUpRight, House, MessageCircle, Settings } from '@lucide/svelte';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import HomeOverview from '$lib/components/HomeOverview.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';

	let mobileView = $state<'home' | 'assistant'>('home');
	const serverLabel = $derived(
		appConfig.settings.mcp.displayName ||
			(appConfig.settings.mcp.url ? new URL(appConfig.settings.mcp.url).host : 'Not configured')
	);

	function openMobileView(view: 'home' | 'assistant') {
		mobileView = view;
		window.scrollTo({ top: 0 });
	}
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<div class="ambient-shell min-h-dvh font-ambient lg:h-dvh">
	<div
		class="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 pt-6 lg:h-dvh lg:min-h-0 lg:px-8 lg:pb-7"
	>
		<header class="flex shrink-0 items-center justify-between gap-4 pb-6">
			<div class="flex items-center gap-3">
				<span class="ambient-glass grid size-11 place-items-center rounded-2xl" aria-hidden="true">
					<House size={21} />
				</span>
				<div>
					<h1 class="text-lg font-bold tracking-tight">Home Agent</h1>
					<p class="text-xs text-ambient-muted">Your home, in conversation</p>
				</div>
			</div>
			<a
				class="ambient-glass hidden min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold hover:bg-white/10 lg:flex"
				href={resolve('/settings')}><Settings size={18} aria-hidden="true" /> Settings</a
			>
		</header>

		<main
			class="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-5 pb-[calc(7rem+env(safe-area-inset-bottom))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] lg:grid-rows-1 lg:pb-0"
		>
			<section
				class={['min-h-0 lg:block lg:overflow-y-auto lg:pr-1', { hidden: mobileView !== 'home' }]}
				aria-label="Home"
			>
				<div class="mb-6">
					<p class="mb-1 text-sm text-ambient-muted">Welcome home</p>
					<h2 class="text-2xl font-semibold tracking-tight">Your home, at a glance</h2>
					<p class="mt-2 text-sm text-ambient-muted">MCP server: {serverLabel}</p>
				</div>
				<button
					type="button"
					class="ambient-glass mb-6 flex min-h-40 w-full items-center justify-between gap-4 overflow-hidden rounded-3xl p-5 text-left hover:border-indigo-300 lg:hidden"
					onclick={() => openMobileView('assistant')}
				>
					<span>
						<span class="block text-lg font-semibold">Ask your home</span>
						<span class="mt-2 block text-sm text-ambient-muted">Open the text assistant</span>
						<span class="mt-4 flex items-center gap-1 text-sm font-semibold text-ambient-accent"
							>Start a conversation <ArrowUpRight size={16} aria-hidden="true" /></span
						>
					</span>
					<span class="shrink-0"><AssistantOrb /></span>
				</button>
				<div class="rounded-3xl bg-white p-4 text-stone-900">
					<HomeOverview />
				</div>
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
		class="fixed inset-x-0 bottom-0 z-20 rounded-t-[28px] border-t border-indigo-300/20 bg-[#131a38]/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
	>
		<div class="mx-auto grid max-w-md grid-cols-3 items-end">
			<button
				type="button"
				class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-ambient-muted aria-pressed:text-white"
				aria-pressed={mobileView === 'home'}
				onclick={() => openMobileView('home')}
			>
				<House size={21} aria-hidden="true" /> Home
			</button>
			<button
				type="button"
				class="-mt-8 flex min-h-16 flex-col items-center gap-1 text-xs font-semibold text-ambient-muted aria-pressed:text-white"
				aria-label="Open text assistant"
				aria-pressed={mobileView === 'assistant'}
				onclick={() => openMobileView('assistant')}
			>
				<span class="relative"
					><AssistantOrb compact /><MessageCircle
						class="absolute inset-0 m-auto"
						size={22}
						aria-hidden="true"
					/></span
				>
				Assistant
			</button>
			<a
				class="flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold text-ambient-muted"
				href={resolve('/settings')}
			>
				<Settings size={21} aria-hidden="true" /> Settings
			</a>
		</div>
	</nav>
</div>
