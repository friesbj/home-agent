<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import AssistantOrb from '$lib/components/AssistantOrb.svelte';
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

<main class="mx-auto max-w-3xl space-y-6 px-5 py-10">
	<header class="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-5">
		<span class="shrink-0"><AssistantOrb size="nav" /></span>
		<div class="space-y-2">
			<h1 class="text-[1.75rem] leading-tight font-semibold tracking-tight">
				Welcome to Home Agent
			</h1>
			<p class="text-ink-muted">
				Three fields and you're ready to talk to your home. Everything else can wait.
			</p>
		</div>
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
