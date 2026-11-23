<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SettingsForm, { type SettingsFormResult } from '$lib/components/SettingsForm.svelte';
	import StorageNotice from '$lib/components/StorageNotice.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { SECRET_LABELS, type SecretName } from '$lib/config/settings';
	import { clearChatHistory } from '$lib/home/chat-history';

	let { data } = $props();

	let formRevision = $state(0);
	let statusMessages = $state<string[]>([]);
	let pendingReset = $state<'preferences' | 'all' | null>(null);
	let pendingHistoryDeletion = $state(false);
	let historyError = $state('');

	const secretNames = Object.keys(SECRET_LABELS) as SecretName[];

	function changed(a: unknown, b: unknown) {
		return JSON.stringify(a) !== JSON.stringify(b);
	}

	function handleSave(result: SettingsFormResult) {
		const before = { settings: appConfig.settings, confirmation: appConfig.confirmation };
		appConfig.save(result);

		const messages: string[] = [];
		if (changed(before.confirmation, result.confirmation)) {
			messages.push(
				'Confirmation policy applied immediately. Pending confirmations are cancelled.'
			);
		}
		const connectionChanged =
			changed(before.settings.mcp, result.settings.mcp) ||
			changed(before.settings.homeAssistant, result.settings.homeAssistant) ||
			Object.keys(result.secrets).length > 0;
		if (connectionChanged) {
			messages.push('Connection settings saved. Active chat and voice sessions will reconnect.');
		}
		if (changed(before.settings.models, result.settings.models)) {
			messages.push('Voice and model changes apply to the next chat or voice session.');
		}
		statusMessages = messages.length > 0 ? messages : ['Settings saved.'];
		formRevision++;
	}

	function deleteSecret(name: SecretName) {
		appConfig.deleteSecret(name);
		statusMessages = [`${SECRET_LABELS[name]} deleted from this browser.`];
		formRevision++;
	}

	function deleteHistory() {
		try {
			clearChatHistory(localStorage);
			pendingHistoryDeletion = false;
			historyError = '';
			statusMessages = ['Chat history deleted from this browser.'];
		} catch {
			historyError = 'Chat history could not be deleted. Check browser storage.';
		}
	}

	async function confirmReset() {
		if (pendingReset === 'all') {
			appConfig.resetAll();
			pendingReset = null;
			await goto(resolve('/onboarding'));
			return;
		}
		appConfig.resetPreferences();
		pendingReset = null;
		statusMessages = ['Preferences restored to defaults. Connection and credentials were kept.'];
		formRevision++;
	}
</script>

<svelte:head><title>Settings · Home Agent</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-8 px-4 py-10">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-3xl font-semibold text-stone-900">Settings</h1>
		<a class="text-stone-700 underline" href={resolve('/')}>Back to assistant</a>
	</header>

	<div role="status" aria-live="polite">
		{#if statusMessages.length > 0}
			<ul class="space-y-1 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
				{#each statusMessages as message (message)}<li>{message}</li>{/each}
			</ul>
		{/if}
	</div>

	<StorageNotice />

	{#key formRevision}
		<SettingsForm
			settings={appConfig.settings}
			confirmation={appConfig.confirmation}
			secretStatus={appConfig.secretStatus}
			mcpUrlPolicy={data.mcpUrlPolicy}
			serverHasOpenAiKey={data.serverHasOpenAiKey}
			submitLabel="Save settings"
			onsave={handleSave}
		/>
	{/key}

	<section class="space-y-3" aria-labelledby="stored-credentials">
		<h2 id="stored-credentials" class="text-lg font-semibold text-stone-900">Stored credentials</h2>
		<ul class="divide-y divide-stone-200 rounded-md border border-stone-200">
			{#each secretNames as name (name)}
				<li class="flex items-center justify-between gap-4 p-3">
					<span>
						<span class="block font-medium text-stone-800">{SECRET_LABELS[name]}</span>
						<span class="text-sm text-stone-600">
							{appConfig.secretStatus[name] === 'stored' ? 'Stored' : 'Not stored'}
						</span>
					</span>
					{#if appConfig.secretStatus[name] === 'stored'}
						<button
							type="button"
							class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
							onclick={() => deleteSecret(name)}
						>
							Delete <span class="sr-only">{SECRET_LABELS[name]}</span>
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="space-y-3" aria-labelledby="history-heading">
		<h2 id="history-heading" class="text-lg font-semibold text-stone-900">Chat history</h2>
		{#if historyError}
			<p class="text-sm text-red-700" role="alert">{historyError}</p>
		{/if}
		{#if pendingHistoryDeletion}
			<div
				class="rounded-md border border-red-300 bg-red-50 p-4"
				role="alertdialog"
				aria-labelledby="history-question"
			>
				<p id="history-question">Delete saved chat history from this browser?</p>
				<div class="mt-3 flex gap-3">
					<button
						type="button"
						class="rounded-md bg-red-700 px-3 py-1 text-white"
						onclick={deleteHistory}>Delete history</button
					>
					<button
						type="button"
						class="rounded-md border border-stone-300 px-3 py-1"
						onclick={() => (pendingHistoryDeletion = false)}>Cancel</button
					>
				</div>
			</div>
		{:else}
			<button
				type="button"
				class="rounded-md border border-red-300 px-3 py-2 text-red-800 hover:bg-red-50"
				onclick={() => (pendingHistoryDeletion = true)}
			>
				Clear chat history
			</button>
		{/if}
	</section>

	<section class="space-y-3" aria-labelledby="reset-heading">
		<h2 id="reset-heading" class="text-lg font-semibold text-stone-900">Reset</h2>
		{#if pendingReset}
			<div
				class="rounded-md border border-red-300 bg-red-50 p-4"
				role="alertdialog"
				aria-labelledby="reset-question"
			>
				<p id="reset-question" class="font-medium text-red-900">
					{pendingReset === 'all'
						? 'Delete all settings, credentials, and history from this browser?'
						: 'Restore voice, model, confirmation, favorites, and history preferences to defaults?'}
				</p>
				<div class="mt-3 flex gap-3">
					<button
						type="button"
						class="rounded-md bg-red-700 px-3 py-1 text-white hover:bg-red-800"
						onclick={confirmReset}
					>
						{pendingReset === 'all' ? 'Delete everything' : 'Restore defaults'}
					</button>
					<button
						type="button"
						class="rounded-md border border-stone-300 px-3 py-1 hover:bg-stone-100"
						onclick={() => (pendingReset = null)}
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<div class="flex flex-wrap gap-3">
				<button
					type="button"
					class="rounded-md border border-stone-300 px-3 py-2 hover:bg-stone-100"
					onclick={() => (pendingReset = 'preferences')}
				>
					Reset preferences to defaults
				</button>
				<button
					type="button"
					class="rounded-md border border-red-300 px-3 py-2 text-red-800 hover:bg-red-50"
					onclick={() => (pendingReset = 'all')}
				>
					Reset all data
				</button>
			</div>
		{/if}
	</section>
</main>
