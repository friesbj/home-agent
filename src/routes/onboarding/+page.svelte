<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SettingsForm, { type SettingsFormResult } from '$lib/components/SettingsForm.svelte';
	import StorageNotice from '$lib/components/StorageNotice.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';

	let { data } = $props();

	async function handleSave(result: SettingsFormResult) {
		appConfig.save({
			...result,
			settings: { ...result.settings, onboardingCompleted: true }
		});
		await goto(resolve('/'));
	}
</script>

<svelte:head><title>Set up Home Agent</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-6 px-4 py-10">
	<header class="space-y-2">
		<h1 class="text-3xl font-semibold text-stone-900">Welcome to Home Agent</h1>
		<p class="text-stone-700">
			Connect your Home Assistant MCP server and choose how the assistant should talk and act. You
			can change everything later in Settings.
		</p>
	</header>

	<StorageNotice />

	<SettingsForm
		settings={appConfig.settings}
		confirmation={appConfig.confirmation}
		secretStatus={appConfig.secretStatus}
		mcpUrlPolicy={data.mcpUrlPolicy}
		serverHasOpenAiKey={data.serverHasOpenAiKey}
		submitLabel="Finish setup"
		onsave={handleSave}
	/>
</main>
