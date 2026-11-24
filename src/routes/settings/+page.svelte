<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { ArrowLeft, ChevronDown, CircleAlert, CircleCheck } from '@lucide/svelte';
	import SettingsForm, { type SettingsFormResult } from '$lib/components/SettingsForm.svelte';
	import StorageNotice from '$lib/components/StorageNotice.svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { SECRET_LABELS, type SecretName } from '$lib/config/settings';
	import { clearStoredChatHistory, resetApplicationData } from '$lib/home/chat-session.svelte';

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

	async function deleteHistory() {
		try {
			await clearStoredChatHistory();
			pendingHistoryDeletion = false;
			historyError = '';
			statusMessages = ['Chat history deleted from this browser.'];
		} catch {
			historyError = 'Chat history could not be deleted. Check browser storage.';
		}
	}

	async function confirmReset() {
		if (pendingReset === 'all') {
			try {
				await resetApplicationData();
				pendingReset = null;
				await goto(resolve('/onboarding'));
			} catch {
				historyError = 'Data could not be deleted. Check browser storage and try again.';
			}
			return;
		}
		appConfig.resetPreferences();
		pendingReset = null;
		statusMessages = ['Preferences restored to defaults. Connection and credentials were kept.'];
		formRevision++;
	}
</script>

<svelte:head><title>Settings · Home Agent</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-8 px-5 py-8">
	<header class="space-y-4">
		<a class="-ml-3 btn btn-quiet" href={resolve('/')}
			><ArrowLeft size={18} aria-hidden="true" /> Back to assistant</a
		>
		<h1 class="text-[1.75rem] leading-tight font-semibold tracking-tight">Settings</h1>
	</header>

	<div role="status" aria-live="polite">
		{#if statusMessages.length > 0}
			<div class="notice notice-success">
				<CircleCheck class="shrink-0 text-success" size={20} aria-hidden="true" />
				<ul class="space-y-1">
					{#each statusMessages as message (message)}<li>{message}</li>{/each}
				</ul>
			</div>
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

	<details class="group rounded-card surface-glass">
		<summary
			class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 hover:bg-white/5 [&::-webkit-details-marker]:hidden"
		>
			<span>
				<span class="block font-semibold">Data and privacy</span>
				<span class="block text-sm text-ink-muted"
					>Stored credentials, chat history, and resetting this browser</span
				>
			</span>
			<ChevronDown
				class="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
				size={20}
				aria-hidden="true"
			/>
		</summary>
		<div class="space-y-6 border-t border-white/10 p-5">
			<section class="space-y-3" aria-labelledby="stored-credentials">
				<h2 id="stored-credentials" class="text-lg font-semibold">Stored credentials</h2>
				<ul class="divide-y divide-white/10">
					{#each secretNames as name (name)}
						<li class="flex min-h-14 items-center justify-between gap-4 py-2">
							<span>
								<span class="block font-medium">{SECRET_LABELS[name]}</span>
								<span class="text-sm text-ink-muted">
									{appConfig.secretStatus[name] === 'stored' ? 'Stored' : 'Not stored'}
								</span>
							</span>
							{#if appConfig.secretStatus[name] === 'stored'}
								<button type="button" class="btn btn-danger" onclick={() => deleteSecret(name)}>
									Delete <span class="sr-only">{SECRET_LABELS[name]}</span>
								</button>
							{/if}
						</li>
					{/each}
				</ul>
			</section>

			<section
				class="space-y-5 rounded-card border border-danger/40 p-5"
				aria-labelledby="danger-heading"
			>
				<div>
					<h2 id="danger-heading" class="text-lg font-semibold text-danger">Delete and reset</h2>
					<p class="mt-1 text-sm text-ink-muted">
						These actions affect data in this browser and ask for confirmation first.
					</p>
				</div>

				<section class="space-y-3" aria-labelledby="history-heading">
					<h3 id="history-heading" class="font-semibold">Chat history</h3>
					{#if historyError}
						<p class="notice notice-error" role="alert">
							<CircleAlert class="shrink-0 text-danger" size={20} aria-hidden="true" />
							<span>{historyError}</span>
						</p>
					{/if}
					{#if pendingHistoryDeletion}
						<div
							class="space-y-3 rounded-tile border-l-4 border-l-danger p-4 surface-solid"
							role="alertdialog"
							aria-labelledby="history-question"
						>
							<p id="history-question" class="font-medium">
								Delete saved chat history from this browser?
							</p>
							<div class="flex flex-wrap gap-3">
								<button type="button" class="btn btn-danger-confirm" onclick={deleteHistory}
									>Delete history</button
								>
								<button
									type="button"
									class="btn btn-secondary"
									onclick={() => (pendingHistoryDeletion = false)}>Cancel</button
								>
							</div>
						</div>
					{:else}
						<button
							type="button"
							class="btn btn-danger"
							onclick={() => (pendingHistoryDeletion = true)}
						>
							Clear chat history
						</button>
					{/if}
				</section>

				<section class="space-y-3" aria-labelledby="reset-heading">
					<h3 id="reset-heading" class="font-semibold">Reset</h3>
					{#if pendingReset}
						<div
							class="space-y-3 rounded-tile border-l-4 border-l-danger p-4 surface-solid"
							role="alertdialog"
							aria-labelledby="reset-question"
						>
							<p id="reset-question" class="font-medium">
								{pendingReset === 'all'
									? 'Delete all settings, credentials, and history from this browser?'
									: 'Restore your name, voice, model, confirmation, favorites, and history preferences to defaults?'}
							</p>
							<div class="flex flex-wrap gap-3">
								<button type="button" class="btn btn-danger-confirm" onclick={confirmReset}>
									{pendingReset === 'all' ? 'Delete everything' : 'Restore defaults'}
								</button>
								<button
									type="button"
									class="btn btn-secondary"
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
								class="btn btn-secondary"
								onclick={() => (pendingReset = 'preferences')}
							>
								Reset preferences to defaults
							</button>
							<button type="button" class="btn btn-danger" onclick={() => (pendingReset = 'all')}>
								Reset all data
							</button>
						</div>
					{/if}
				</section>
			</section>
		</div>
	</details>
</main>
