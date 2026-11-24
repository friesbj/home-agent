<script lang="ts">
	import {
		ArrowUpRight,
		ChevronRight,
		CircleAlert,
		Info,
		Lightbulb,
		RefreshCw,
		Thermometer
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { fetchHomeState, savedMcpTarget } from '$lib/home/api';
	import { greeting, summarizeHome } from '$lib/home/summary';
	import type { HomeState } from '$lib/home/types';
	import AssistantOrb from './AssistantOrb.svelte';
	import DomainIcon from './DomainIcon.svelte';
	import RoomList from './RoomList.svelte';

	interface Props {
		onopenassistant: () => void;
		onshortcut: (request: string) => void;
		/** Why shortcuts are unavailable right now; empty when they can be used. */
		shortcutBlockedReason: string;
	}

	let { onopenassistant, onshortcut, shortcutBlockedReason }: Props = $props();

	let home = $state<HomeState | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let filter = $state<'light' | 'climate' | null>(null);
	let now = $state(new Date());
	let roomList = $state<ReturnType<typeof RoomList>>();
	let controller: AbortController | undefined;

	const configured = $derived(Boolean(appConfig.settings.mcp.url));
	const favorites = $derived(appConfig.settings.favorites.areas.map((area) => area.toLowerCase()));
	const summary = $derived(home ? summarizeHome(home) : null);
	const title = $derived(greeting(now, appConfig.settings.profile.displayName));

	const areas = $derived.by(() => {
		const rank = (name: string) => {
			const index = favorites.indexOf(name.toLowerCase());
			return index === -1 ? favorites.length : index;
		};
		return [...(home?.areas ?? [])].sort((a, b) => rank(a.name) - rank(b.name));
	});

	const status = $derived.by(() => {
		if (!configured) return 'Connect your Home Assistant MCP server to get started.';
		if (errorMessage) return 'Could not reach your home.';
		if (!summary) return 'Checking your home…';
		return summary.status;
	});

	async function refresh() {
		const target = savedMcpTarget();
		if (!target) return;
		controller?.abort();
		controller = new AbortController();
		loading = true;
		errorMessage = null;
		now = new Date();
		try {
			home = await fetchHomeState(target, controller.signal);
		} catch (error) {
			if ((error as Error).name !== 'AbortError') {
				errorMessage = (error as Error).message || 'Could not load the home state.';
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		if (configured) refresh();
		return () => controller?.abort();
	});

	function toggleFilter(domain: 'light' | 'climate') {
		filter = filter === domain ? null : domain;
		if (filter) {
			const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
			document
				.getElementById('rooms-heading')
				?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
		}
	}

	function scrollFor(domain: string) {
		return domain === 'light' ? 'lights' : 'climate devices';
	}
</script>

<div class="space-y-8">
	<div>
		<h2 class="text-[1.75rem] leading-tight font-semibold tracking-tight">{title}</h2>
		<p class="mt-2 text-lg text-ink-muted" role="status">{status}</p>
		{#if configured}
			<div class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
				{#if home}
					<span>Updated {new Date(home.fetchedAt).toLocaleTimeString()}</span>
				{/if}
				<button type="button" class="-ml-2 btn px-2 btn-quiet" onclick={refresh} disabled={loading}>
					<RefreshCw size={16} class={loading ? 'animate-spin' : ''} aria-hidden="true" />
					{loading ? 'Refreshing…' : 'Refresh'}
				</button>
			</div>
		{/if}
	</div>

	<button
		type="button"
		class="flex min-h-40 w-full items-center justify-between gap-4 overflow-hidden rounded-card p-5 text-left transition-colors surface-glass hover:border-accent-ink/60 lg:hidden"
		onclick={onopenassistant}
	>
		<span>
			<span class="block text-[1.0625rem] font-semibold">Ask your home</span>
			<span class="mt-2 block text-sm text-ink-muted">Open the text assistant</span>
			<span class="mt-4 flex items-center gap-1 text-sm font-semibold text-accent-ink"
				>Start a conversation <ArrowUpRight size={16} aria-hidden="true" /></span
			>
		</span>
		<span class="shrink-0"><AssistantOrb /></span>
	</button>

	{#if !configured}
		<p class="notice notice-info">
			<Info class="shrink-0 text-accent-ink" size={20} aria-hidden="true" />
			<span
				>No MCP server configured. <a class="font-semibold underline" href={resolve('/settings')}
					>Open Settings</a
				>.</span
			>
		</p>
	{:else if errorMessage}
		<p class="notice notice-error" role="alert">
			<CircleAlert class="shrink-0 text-danger" size={20} aria-hidden="true" />
			<span>{errorMessage}</span>
		</p>
	{/if}

	{#if summary && (summary.lights.total > 0 || summary.climate.total > 0)}
		<div class="grid grid-cols-2 gap-3" aria-label="Summary" role="group">
			{#if summary.lights.total > 0}
				<button
					type="button"
					class={[
						'flex min-h-32 flex-col justify-between gap-3 rounded-card p-4 text-left transition-colors',
						filter === 'light' ? 'surface-selected' : 'surface-glass hover:border-accent-ink/60'
					]}
					aria-pressed={filter === 'light'}
					aria-controls="rooms"
					onclick={() => toggleFilter('light')}
					aria-label="Lights: {summary.lights.on} on, {summary.lights.off} off. Show {scrollFor(
						'light'
					)} in rooms."
				>
					<span class="flex items-center justify-between">
						<span class="icon-well"
							><Lightbulb class="text-warm" size={20} strokeWidth={1.75} aria-hidden="true" /></span
						>
						<ChevronRight class="text-ink-muted" size={18} aria-hidden="true" />
					</span>
					<span>
						<span class="block text-[1.0625rem] font-semibold">Lights</span>
						<span class="block text-sm text-ink-muted"
							>{summary.lights.on} on · {summary.lights.off} off{summary.lights.unavailable
								? ` · ${summary.lights.unavailable} unavailable`
								: ''}</span
						>
					</span>
				</button>
			{/if}
			{#if summary.climate.total > 0}
				<button
					type="button"
					class={[
						'flex min-h-32 flex-col justify-between gap-3 rounded-card p-4 text-left transition-colors',
						filter === 'climate' ? 'surface-selected' : 'surface-glass hover:border-accent-ink/60'
					]}
					aria-pressed={filter === 'climate'}
					aria-controls="rooms"
					onclick={() => toggleFilter('climate')}
					aria-label="Climate: {summary.climate.display || 'no temperature reported'}{summary
						.climate.detail
						? `, ${summary.climate.detail}`
						: ''}. Show {scrollFor('climate')} in rooms."
				>
					<span class="flex items-center justify-between">
						<span class="icon-well"
							><Thermometer
								class="text-cool"
								size={20}
								strokeWidth={1.75}
								aria-hidden="true"
							/></span
						>
						<ChevronRight class="text-ink-muted" size={18} aria-hidden="true" />
					</span>
					<span>
						<span class="block text-[1.0625rem] font-semibold">Climate</span>
						<span class="block text-sm text-ink-muted">
							{#if summary.climate.display}
								<span class="text-lg font-semibold text-ink">{summary.climate.display}</span>
								<span class="block">{summary.climate.detail}</span>
							{:else}
								No temperature reported
							{/if}
						</span>
					</span>
				</button>
			{/if}
		</div>
	{/if}

	{#if summary && summary.scenes.length > 0}
		<section aria-labelledby="scenes-heading">
			<h2 id="scenes-heading" class="text-lg font-semibold">Scenes</h2>
			<p id="scenes-hint" class="mt-1 text-sm text-ink-muted">
				{shortcutBlockedReason ||
					'Ask the assistant to activate a scene. Changes still need your confirmation.'}
			</p>
			<ul class="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-2 lg:mx-0 lg:flex-wrap lg:px-0">
				{#each summary.scenes as scene (scene)}
					<li class="shrink-0">
						<button
							type="button"
							class="flex min-h-24 w-28 flex-col items-center justify-center gap-2 rounded-tile p-3 text-center text-sm font-medium transition-colors surface-glass hover:border-accent-ink/60 active:surface-selected disabled:cursor-not-allowed disabled:opacity-55"
							aria-describedby="scenes-hint"
							disabled={Boolean(shortcutBlockedReason)}
							onclick={() => onshortcut(`Activate the scene "${scene}".`)}
						>
							<DomainIcon domain="scene" />
							<span class="line-clamp-2">{scene}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if home && areas.length > 0}
		<section id="rooms" aria-labelledby="rooms-heading" aria-busy={loading}>
			<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
				<h2 id="rooms-heading" class="scroll-mt-6 text-lg font-semibold">Rooms</h2>
				<div class="flex flex-wrap gap-1">
					{#if filter}
						<button type="button" class="btn btn-secondary" onclick={() => (filter = null)}>
							Show all devices
						</button>
					{:else if areas.length > 1}
						<button type="button" class="btn btn-quiet" onclick={() => roomList?.setAll(true)}>
							Expand all
						</button>
						<button type="button" class="btn btn-quiet" onclick={() => roomList?.setAll(false)}>
							Collapse all
						</button>
					{/if}
				</div>
			</div>
			{#if filter}
				<p class="mb-3 text-sm text-ink-muted" role="status">
					Showing {scrollFor(filter)} only.
				</p>
			{/if}
			<RoomList bind:this={roomList} {areas} {favorites} domain={filter} />
		</section>
	{:else if home}
		<p class="notice notice-info">
			<Info class="shrink-0 text-accent-ink" size={20} aria-hidden="true" />
			<span>No exposed entities found. Expose entities to voice assistants in Home Assistant.</span>
		</p>
	{/if}
</div>
