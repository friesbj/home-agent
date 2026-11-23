<script lang="ts">
	import { ChevronRight, CircleAlert } from '@lucide/svelte';
	import type { HomeArea, HomeEntity } from '$lib/home/types';
	import DomainIcon from './DomainIcon.svelte';

	interface Props {
		/** Areas in display order, favorites first. */
		areas: HomeArea[];
		favorites: string[];
		/** When set, only entities of this domain are listed and matching rooms are open. */
		domain?: string | null;
	}

	let { areas, favorites, domain = null }: Props = $props();

	const ACTIVE_STATES = ['on', 'open', 'unlocked', 'heat', 'cool', 'heat_cool', 'auto'];
	const UNAVAILABLE = ['unavailable', 'unknown'];

	/** Explicit open/closed choices by area name; unset areas fall back to "favorites open". */
	let expanded = $state<Record<string, boolean>>({});

	const visible = $derived(
		domain
			? areas
					.map((area) => ({
						...area,
						entities: area.entities.filter((entity) => entity.domain === domain)
					}))
					.filter((area) => area.entities.length > 0)
			: areas
	);

	function isOpen(name: string) {
		if (domain) return true;
		return expanded[name] ?? favorites.includes(name.toLowerCase());
	}

	export function setAll(open: boolean) {
		expanded = Object.fromEntries(areas.map((area) => [area.name, open]));
	}

	function activeCount(entities: HomeEntity[]) {
		return entities.filter((entity) => ACTIVE_STATES.includes(entity.state)).length;
	}

	function stateKind(entity: HomeEntity) {
		if (ACTIVE_STATES.includes(entity.state)) return 'active';
		// Scenes and scripts have no on/off state; "unknown" only means not triggered yet.
		if (['scene', 'script'].includes(entity.domain)) return 'idle';
		if (UNAVAILABLE.includes(entity.state)) return 'unavailable';
		return 'idle';
	}

	function stateLabel(entity: HomeEntity) {
		if (['scene', 'script'].includes(entity.domain) && UNAVAILABLE.includes(entity.state))
			return '—';
		return entity.state || '—';
	}
</script>

<div class="space-y-3">
	{#each visible as area (area.name)}
		{@const active = activeCount(area.entities)}
		<details
			class="group rounded-tile surface-glass"
			bind:open={
				() => isOpen(area.name),
				(open) => {
					if (!domain) expanded[area.name] = open;
				}
			}
		>
			<summary
				class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-tile px-4 py-2 hover:bg-white/5 [&::-webkit-details-marker]:hidden"
			>
				<span class="flex min-w-0 items-center gap-2">
					<ChevronRight
						class="shrink-0 text-ink-muted transition-transform group-open:rotate-90"
						size={18}
						aria-hidden="true"
					/>
					<h3 class="truncate font-semibold">{area.name}</h3>
				</span>
				<span class="shrink-0 text-sm text-ink-muted">
					{area.entities.length}
					{area.entities.length === 1 ? 'device' : 'devices'}{active > 0
						? ` · ${active} active`
						: ''}
				</span>
			</summary>
			<ul class="divide-y divide-white/10 border-t border-white/10">
				<!-- GetLiveContext has no entity IDs and names may repeat, so the position is part of the key. -->
				{#each area.entities as entity, entityIndex (`${entityIndex}:${entity.domain}:${entity.name}`)}
					{@const kind = stateKind(entity)}
					<li class="flex items-center justify-between gap-3 px-4 py-3">
						<span class="flex min-w-0 items-center gap-3">
							<DomainIcon domain={entity.domain} />
							<span class="min-w-0">
								<span class="block truncate">{entity.name}</span>
								<span class="block text-sm text-ink-muted">{entity.domain}</span>
							</span>
						</span>
						<span
							class={[
								'inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm font-medium',
								kind === 'active' && 'border-warm/50 bg-warm/10 text-warm',
								kind === 'unavailable' && 'border-danger/50 text-danger',
								kind === 'idle' && 'border-white/15 text-ink-muted'
							]}
						>
							{#if kind === 'unavailable'}<CircleAlert size={14} aria-hidden="true" />{/if}
							{stateLabel(entity)}
						</span>
					</li>
				{/each}
			</ul>
		</details>
	{/each}
</div>
