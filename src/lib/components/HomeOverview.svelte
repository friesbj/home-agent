<script lang="ts">
	import { resolve } from '$app/paths';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { fetchHomeState, savedMcpTarget } from '$lib/home/api';
	import type { HomeState } from '$lib/home/types';

	let home = $state<HomeState | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	let controller: AbortController | undefined;

	const configured = $derived(Boolean(appConfig.settings.mcp.url));

	const areas = $derived.by(() => {
		const favorites = appConfig.settings.favorites.areas.map((area) => area.toLowerCase());
		const rank = (name: string) => {
			const index = favorites.indexOf(name.toLowerCase());
			return index === -1 ? favorites.length : index;
		};
		return [...(home?.areas ?? [])].sort((a, b) => rank(a.name) - rank(b.name));
	});

	async function refresh() {
		const target = savedMcpTarget();
		if (!target) return;
		controller?.abort();
		controller = new AbortController();
		loading = true;
		errorMessage = null;
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

	function stateTone(state: string) {
		return ['on', 'open', 'unlocked', 'heat', 'cool', 'heat_cool', 'auto'].includes(state)
			? 'bg-amber-100 text-amber-900'
			: ['unavailable', 'unknown'].includes(state)
				? 'bg-red-50 text-red-800'
				: 'bg-stone-100 text-stone-700';
	}
</script>

<section class="space-y-3" aria-labelledby="home-heading" aria-busy={loading}>
	<div class="flex items-center justify-between gap-2">
		<h2 id="home-heading" class="text-lg font-semibold text-stone-900">Your home</h2>
		{#if configured}
			<button
				type="button"
				class="rounded-md border border-stone-300 px-2 py-1 text-sm hover:bg-stone-100 disabled:opacity-50"
				onclick={refresh}
				disabled={loading}
			>
				{loading ? 'Refreshing…' : 'Refresh'}
			</button>
		{/if}
	</div>

	{#if !configured}
		<p class="text-sm text-stone-600">
			No MCP server configured. <a class="underline" href={resolve('/settings')}>Open Settings</a>.
		</p>
	{:else if errorMessage}
		<p class="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
			{errorMessage}
		</p>
	{:else if home && areas.length === 0}
		<p class="text-sm text-stone-600">
			No exposed entities found. Expose entities to voice assistants in Home Assistant.
		</p>
	{:else if !home}
		<p class="text-sm text-stone-600">Loading…</p>
	{/if}

	{#each areas as area (area.name)}
		<div class="rounded-lg border border-stone-200 bg-white">
			<h3 class="border-b border-stone-200 px-3 py-2 font-medium text-stone-800">{area.name}</h3>
			<ul class="divide-y divide-stone-100">
				{#each area.entities as entity (`${entity.domain}:${entity.name}`)}
					<li class="flex items-center justify-between gap-2 px-3 py-2 text-sm">
						<span>
							<span class="text-stone-900">{entity.name}</span>
							<span class="block text-xs text-stone-500">{entity.domain}</span>
						</span>
						<span class="rounded px-2 py-0.5 text-xs font-medium {stateTone(entity.state)}">
							{entity.state || '—'}
						</span>
					</li>
				{/each}
			</ul>
		</div>
	{/each}

	{#if home}
		<p class="text-xs text-stone-500">
			Updated {new Date(home.fetchedAt).toLocaleTimeString()}
		</p>
	{/if}
</section>
