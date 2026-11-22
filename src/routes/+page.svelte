<script lang="ts">
	import { resolve } from '$app/paths';
	import ChatPanel from '$lib/components/ChatPanel.svelte';
	import HomeOverview from '$lib/components/HomeOverview.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';

	const serverLabel = $derived(
		appConfig.settings.mcp.displayName ||
			(appConfig.settings.mcp.url ? new URL(appConfig.settings.mcp.url).host : 'Not configured')
	);
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<div class="mx-auto max-w-6xl space-y-6 px-4 py-6">
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-semibold text-stone-900">Home Agent</h1>
			<p class="text-sm text-stone-600">MCP server: {serverLabel}</p>
		</div>
		<nav>
			<a class="text-stone-700 underline" href={resolve('/settings')}>Settings</a>
		</nav>
	</header>

	<main class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
		<ChatPanel />
		<aside>
			<HomeOverview />
		</aside>
	</main>
</div>
