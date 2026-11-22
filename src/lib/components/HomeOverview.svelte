<script lang="ts">
	import { resolve } from '$app/paths';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { fetchHomeState, savedMcpTarget } from '$lib/home/api';
	import type { HomeEntity, HomeState } from '$lib/home/types';

	const ACTIVE_STATES = ['on', 'open', 'unlocked', 'heat', 'cool', 'heat_cool', 'auto'];

	let home = $state<HomeState | null>(null);
	let loading = $state(false);
	let errorMessage = $state<string | null>(null);
	/** Explicit open/closed choices by area name; unset areas fall back to "favorites open". */
	let expanded = $state<Record<string, boolean>>({});
	let controller: AbortController | undefined;

	const configured = $derived(Boolean(appConfig.settings.mcp.url));
	const favorites = $derived(appConfig.settings.favorites.areas.map((area) => area.toLowerCase()));

	const areas = $derived.by(() => {
		const rank = (name: string) => {
			const index = favorites.indexOf(name.toLowerCase());
			return index === -1 ? favorites.length : index;
		};
		return [...(home?.areas ?? [])].sort((a, b) => rank(a.name) - rank(b.name));
	});

	function isOpen(name: string) {
		return expanded[name] ?? favorites.includes(name.toLowerCase());
	}

	function setAll(open: boolean) {
		expanded = Object.fromEntries(areas.map((area) => [area.name, open]));
	}

	function activeCount(entities: HomeEntity[]) {
		return entities.filter((entity) => ACTIVE_STATES.includes(entity.state)).length;
	}

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
		return ACTIVE_STATES.includes(state)
			? 'bg-amber-100 text-amber-900'
			: ['unavailable', 'unknown'].includes(state)
				? 'bg-red-50 text-red-800'
				: 'bg-stone-100 text-stone-700';
	}
</script>

<section class="space-y-3" aria-labelledby="home-heading" aria-busy={loading}>
	<div
		class="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-white/95 pb-2 backdrop-blur"
	>
		<h2 id="home-heading" class="text-lg font-semibold text-stone-900">Your home</h2>
		{#if configured}
			<div class="flex gap-2 text-sm">
				{#if areas.length > 1}
					<button
						type="button"
						class="rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100"
						onclick={() => setAll(true)}
					>
						Expand all
					</button>
					<button
						type="button"
						class="rounded-md px-2 py-1 text-stone-700 hover:bg-stone-100"
						onclick={() => setAll(false)}
					>
						Collapse all
					</button>
				{/if}
				<button
					type="button"
					class="rounded-md border border-stone-300 px-2 py-1 hover:bg-stone-100 disabled:opacity-50"
					onclick={refresh}
					disabled={loading}
				>
					{loading ? 'Refreshing…' : 'Refresh'}
				</button>
			</div>
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
		{@const active = activeCount(area.entities)}
		<details
			class="group rounded-lg border border-stone-200 bg-white"
			bind:open={() => isOpen(area.name), (open) => (expanded[area.name] = open)}
		>
			<summary
				class="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-stone-50 [&::-webkit-details-marker]:hidden"
			>
				<span class="flex items-center gap-2">
					<span
						class="inline-block text-stone-500 transition-transform group-open:rotate-90"
						aria-hidden="true">▸</span
					>
					<h3 class="font-medium text-stone-800">{area.name}</h3>
				</span>
				<span class="text-xs text-stone-500">
					{area.entities.length}
					{area.entities.length === 1 ? 'device' : 'devices'}{active > 0
						? ` · ${active} active`
						: ''}
				</span>
			</summary>
			<ul class="divide-y divide-stone-100 border-t border-stone-200">
				<!-- GetLiveContext has no entity IDs and names may repeat, so the position is part of the key. -->
				{#each area.entities as entity, entityIndex (`${entityIndex}:${entity.domain}:${entity.name}`)}
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
		</details>
	{/each}

	{#if home}
		<p class="text-xs text-stone-500">
			Updated {new Date(home.fetchedAt).toLocaleTimeString()}
		</p>
	{/if}
</section>
