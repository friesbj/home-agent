<script lang="ts" module>
	import type { ConfirmationPolicy, Secrets, Settings } from '$lib/config/settings';

	export interface SettingsFormResult {
		settings: Settings;
		confirmation: ConfirmationPolicy;
		secrets: Secrets;
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { ChevronDown, ShieldCheck, TriangleAlert } from '@lucide/svelte';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { discoverTools } from '$lib/home/api';
	import { validateMcpUrl, type McpUrlPolicy } from '$lib/config/mcp-url';
	import {
		CONFIRMABLE_DOMAINS,
		HIGH_RISK_DOMAINS,
		INITIAL_DOMAINS,
		LIVE_MODEL,
		MODEL_SUGGESTIONS,
		SECRET_LABELS,
		VOICE_CATALOG,
		confirmationPolicySchema,
		settingsSchema,
		type SecretName,
		type SecretStatusMap
	} from '$lib/config/settings';

	interface Props {
		settings: Settings;
		confirmation: ConfirmationPolicy;
		secretStatus: SecretStatusMap;
		mcpUrlPolicy: McpUrlPolicy;
		serverHasOpenAiKey: boolean;
		submitLabel: string;
		onsave: (result: SettingsFormResult) => void;
	}

	let {
		settings,
		confirmation,
		secretStatus,
		mcpUrlPolicy,
		serverHasOpenAiKey,
		submitLabel,
		onsave
	}: Props = $props();

	// The form edits a detached draft; parents re-key the component to load new values.
	const initial = untrack(() => ({
		settings: $state.snapshot(settings) as Settings,
		confirmation: $state.snapshot(confirmation) as ConfirmationPolicy
	}));

	let draft = $state(initial.settings);
	let policy = $state(initial.confirmation);
	let areasText = $state(initial.settings.favorites.areas.join(', '));
	let secretInputs = $state<Record<SecretName, string>>({
		openaiApiKey: '',
		mcpToken: '',
		homeAssistantToken: ''
	});
	let errors = $state<Record<string, string>>({});
	let testing = $state(false);
	let testResult = $state<{ ok: boolean; message: string } | null>(null);
	let advancedOpen = $state(false);
	let voiceSearch = $state('');
	let voiceLanguage = $state('All');
	let voicePresentation = $state('All');
	const filteredVoices = $derived(
		VOICE_CATALOG.filter((voice) => {
			const query = voiceSearch.trim().toLowerCase();
			return (
				(!query ||
					voice.name.toLowerCase().includes(query) ||
					voice.apiName.includes(query) ||
					voice.character?.toLowerCase().includes(query)) &&
				(voiceLanguage === 'All' || voice.language === voiceLanguage) &&
				(voicePresentation === 'All' || voice.presentation === voicePresentation)
			);
		})
	);

	/** Fields shown outside Advanced settings; errors elsewhere open that section. */
	const ESSENTIAL_FIELDS = new Set(['mcp-url', 'mcp-token', 'openai-key']);

	const safetySummary = $derived(
		{
			all: 'Every change to your home asks for your confirmation first.',
			'high-risk': 'Locks, alarms, garage doors, and irrigation ask for your confirmation first.',
			custom: 'Changes to selected device types ask for your confirmation first.',
			none: 'Changes run without asking for confirmation.'
		}[policy.mode]
	);

	async function testConnection() {
		const mcp = validateMcpUrl(draft.mcp.url, mcpUrlPolicy);
		if (!mcp.ok) {
			errors = { ...errors, 'mcp-url': mcp.error };
			testResult = { ok: false, message: mcp.error };
			return;
		}
		testing = true;
		testResult = null;
		try {
			const token =
				draft.mcp.authType === 'bearer'
					? secretInputs.mcpToken.trim() || appConfig.getSecret('mcpToken')
					: undefined;
			const result = await discoverTools({
				url: mcp.url.href,
				transport: draft.mcp.transport,
				token
			});
			const count = (kind: string) => result.tools.filter((tool) => tool.kind === kind).length;
			testResult = {
				ok: true,
				message: `Connected${result.serverName ? ` to ${result.serverName}` : ''}: ${count('read')} read-only and ${count('mutation')} control tools available, ${count('blocked')} blocked by policy.`
			};
		} catch (error) {
			testResult = { ok: false, message: (error as Error).message || 'Connection failed.' };
		} finally {
			testing = false;
		}
	}

	const domainLabels: Record<string, string> = {
		light: 'Lights',
		climate: 'Climate',
		scene: 'Scenes',
		script: 'Scripts',
		lock: 'Locks',
		alarm_control_panel: 'Alarm panels',
		cover: 'Covers and garage doors',
		valve: 'Valves and irrigation'
	};

	const confirmationModes: { value: ConfirmationPolicy['mode']; label: string; hint: string }[] = [
		{
			value: 'all',
			label: 'Confirm every change (recommended)',
			hint: 'Read-only questions never need confirmation.'
		},
		{
			value: 'high-risk',
			label: 'Confirm high-risk changes only',
			hint: `Locks, alarms, garage doors, and irrigation (${HIGH_RISK_DOMAINS.join(', ')}).`
		},
		{
			value: 'custom',
			label: 'Choose by domain',
			hint: 'Select which domains require confirmation.'
		},
		{
			value: 'none',
			label: 'No confirmation',
			hint: 'Only for trusted private deployments. Server-side allowlists still apply.'
		}
	];

	function toggle(list: string[], value: string, checked: boolean) {
		return checked ? [...new Set([...list, value])] : list.filter((item) => item !== value);
	}

	function secretRequired(name: SecretName) {
		return secretStatus[name] === 'missing' && !secretInputs[name].trim();
	}

	function validate(): SettingsFormResult | null {
		const next: Record<string, string> = {};

		const mcp = validateMcpUrl(draft.mcp.url, mcpUrlPolicy);
		if (!mcp.ok) next['mcp-url'] = mcp.error;

		if (draft.homeAssistant.baseUrl.trim()) {
			const ha = validateMcpUrl(draft.homeAssistant.baseUrl, mcpUrlPolicy);
			if (!ha.ok) next['ha-url'] = ha.error;
		}

		if (draft.mcp.authType === 'bearer' && secretRequired('mcpToken')) {
			next['mcp-token'] =
				'Enter the access token, or choose no authentication under Advanced settings.';
		}
		if (!serverHasOpenAiKey && secretRequired('openaiApiKey')) {
			next['openai-key'] = 'An OpenAI API key is required because the server has none configured.';
		}
		if (policy.mode === 'none' && !policy.acknowledgedNoConfirmationRisk) {
			next['confirmation'] = 'Acknowledge the risk to disable confirmations.';
		}

		const candidate = {
			...draft,
			mcp: { ...draft.mcp, url: mcp.ok ? mcp.url.href : draft.mcp.url },
			favorites: {
				...draft.favorites,
				areas: areasText
					.split(',')
					.map((area) => area.trim())
					.filter(Boolean)
			}
		};
		const parsedSettings = settingsSchema.safeParse(candidate);
		if (!parsedSettings.success) {
			for (const issue of parsedSettings.error.issues) {
				const key = issue.path.join('.');
				const field =
					key === 'models.voice'
						? 'voice'
						: key === 'models.backendModel'
							? 'backend-model'
							: key === 'models.textModel'
								? 'text-model'
								: key.startsWith('favorites')
									? 'areas'
									: key.startsWith('profile')
										? 'display-name'
										: 'form';
				next[field] ??= issue.message;
			}
		}
		const parsedPolicy = confirmationPolicySchema.safeParse(policy);
		if (!parsedPolicy.success) next['confirmation'] ??= 'Invalid confirmation settings.';

		errors = next;
		if (Object.keys(next).length > 0 || !parsedSettings.success || !parsedPolicy.success) {
			return null;
		}

		const secrets: Secrets = {};
		for (const [name, value] of Object.entries(secretInputs)) {
			if (value.trim()) secrets[name as SecretName] = value.trim();
		}
		return { settings: parsedSettings.data, confirmation: parsedPolicy.data, secrets };
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const result = validate();
		if (!result) {
			if (Object.keys(errors).some((field) => !ESSENTIAL_FIELDS.has(field))) {
				advancedOpen = true;
				await tick();
			}
			const firstInvalid = form.querySelector<HTMLElement>('[aria-invalid="true"]');
			firstInvalid?.focus();
			return;
		}
		secretInputs = { openaiApiKey: '', mcpToken: '', homeAssistantToken: '' };
		onsave(result);
	}
</script>

{#snippet fieldError(id: string)}
	{#if errors[id]}
		<p id="{id}-error" class="mt-1 text-sm text-danger">{errors[id]}</p>
	{/if}
{/snippet}

{#snippet secretField(name: SecretName, id: string, hint: string, label = SECRET_LABELS[name])}
	<div>
		<label for={id} class="block text-sm font-medium text-ink">{label}</label>
		<p id="{id}-status" class="text-sm text-ink-muted">
			{secretStatus[name] === 'stored' ? 'Stored in this browser. Leave empty to keep it.' : ''}
			{hint}
		</p>
		<input
			{id}
			type="password"
			autocomplete="off"
			spellcheck="false"
			class="mt-1 field w-full"
			bind:value={secretInputs[name]}
			aria-invalid={errors[id] ? 'true' : undefined}
			aria-describedby="{id}-status {errors[id] ? `${id}-error` : ''}"
		/>
		{@render fieldError(id)}
	</div>
{/snippet}

<form class="space-y-6" onsubmit={handleSubmit} novalidate>
	<fieldset class="form-section space-y-5">
		<legend>Connect your home</legend>
		<div>
			<label for="mcp-url" class="block text-sm font-medium text-ink">
				Server address <span aria-hidden="true">*</span>
			</label>
			<input
				id="mcp-url"
				type="url"
				required
				inputmode="url"
				placeholder="https://homeassistant.local:8123/api/mcp"
				class="mt-1 field w-full"
				bind:value={draft.mcp.url}
				aria-invalid={errors['mcp-url'] ? 'true' : undefined}
				aria-describedby="mcp-url-hint {errors['mcp-url'] ? 'mcp-url-error' : ''}"
			/>
			<p id="mcp-url-hint" class="mt-1 text-sm text-ink-muted">
				The Model Context Protocol address of your Home Assistant, usually ending in /api/mcp.
				{mcpUrlPolicy.allowInsecureHttp ? '' : 'Only https:// is allowed.'}
				{mcpUrlPolicy.allowPrivateHosts ? '' : 'Local network addresses are blocked here.'}
			</p>
			{@render fieldError('mcp-url')}
		</div>
		{#if draft.mcp.authType === 'bearer'}
			{@render secretField(
				'mcpToken',
				'mcp-token',
				'Create a long-lived access token in your Home Assistant profile.',
				'Access token'
			)}
		{/if}
		{@render secretField(
			'openaiApiKey',
			'openai-key',
			serverHasOpenAiKey ? 'Optional: the server has a key configured.' : 'Required.'
		)}
		<div class="space-y-2">
			<button type="button" class="btn btn-secondary" onclick={testConnection} disabled={testing}>
				{testing ? 'Testing…' : 'Test connection'}
			</button>
			<div role="status" aria-live="polite" class="text-sm">
				{#if testResult?.ok}
					<p class="text-success">{testResult.message}</p>
				{:else if testResult}
					<p class="text-danger">{testResult.message}</p>
				{/if}
			</div>
		</div>
		<p class="flex items-start gap-2 border-t border-white/10 pt-4 text-sm text-ink-muted">
			{#if policy.mode === 'none'}
				<TriangleAlert class="mt-0.5 shrink-0 text-warning" size={18} aria-hidden="true" />
			{:else}
				<ShieldCheck class="mt-0.5 shrink-0 text-success" size={18} aria-hidden="true" />
			{/if}
			<span>{safetySummary} You can change this under Advanced settings.</span>
		</p>
	</fieldset>

	<details class="group rounded-card surface-glass" bind:open={advancedOpen}>
		<summary
			class="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-3 hover:bg-white/5 [&::-webkit-details-marker]:hidden"
		>
			<span>
				<span class="block font-semibold">Advanced settings</span>
				<span class="block text-sm text-ink-muted"
					>Name, voice and models, confirmations, favorites, history, and connection details</span
				>
			</span>
			<ChevronDown
				class="shrink-0 text-ink-muted transition-transform group-open:rotate-180"
				size={20}
				aria-hidden="true"
			/>
		</summary>
		<div class="space-y-6 border-t border-white/10 p-5">
			<fieldset class="form-group space-y-4">
				<legend>Profile</legend>
				<div>
					<label for="display-name" class="block text-sm font-medium text-ink">
						Your name (optional)
					</label>
					<p id="display-name-hint" class="text-sm text-ink-muted">
						Used only for the greeting on Home and stored in this browser.
					</p>
					<input
						id="display-name"
						type="text"
						autocomplete="given-name"
						maxlength="40"
						class="mt-1 field w-full"
						bind:value={draft.profile.displayName}
						aria-invalid={errors['display-name'] ? 'true' : undefined}
						aria-describedby="display-name-hint {errors['display-name']
							? 'display-name-error'
							: ''}"
					/>
					{@render fieldError('display-name')}
				</div>
			</fieldset>

			<fieldset
				class="form-group space-y-3"
				aria-describedby={errors['confirmation'] ? 'confirmation-error' : undefined}
			>
				<legend>Confirm smart-home changes</legend>
				{#each confirmationModes as mode (mode.value)}
					<label class="flex min-h-11 items-start gap-3 py-1">
						<input
							type="radio"
							name="confirmation-mode"
							value={mode.value}
							class="mt-1"
							bind:group={policy.mode}
						/>
						<span>
							<span class="block font-medium text-ink">{mode.label}</span>
							<span class="block text-sm text-ink-muted">{mode.hint}</span>
						</span>
					</label>
				{/each}
				{#if policy.mode === 'custom'}
					<div class="ml-7 grid gap-2 sm:grid-cols-2">
						{#each CONFIRMABLE_DOMAINS as domain (domain)}
							<label class="flex min-h-11 items-center gap-3 text-sm">
								<input
									type="checkbox"
									checked={policy.domains.includes(domain)}
									onchange={(event) =>
										(policy.domains = toggle(policy.domains, domain, event.currentTarget.checked))}
								/>
								{domainLabels[domain]}
							</label>
						{/each}
					</div>
				{/if}
				{#if policy.mode === 'none'}
					<div class="ml-7 notice flex-col gap-2 notice-warning" role="note">
						<p class="font-semibold text-warning">
							Warning: the assistant will change devices without asking first.
						</p>
						<label class="flex min-h-11 items-center gap-3">
							<input type="checkbox" bind:checked={policy.acknowledgedNoConfirmationRisk} />
							I understand and use a restricted private deployment.
						</label>
					</div>
				{/if}
				{@render fieldError('confirmation')}
			</fieldset>

			<fieldset class="form-group space-y-4">
				<legend>Voice and models</legend>
				<p class="text-sm text-ink-muted">
					Live conversation model: <span class="font-mono">{LIVE_MODEL}</span>
				</p>
				<div class="grid gap-4 sm:grid-cols-3">
					<fieldset class="space-y-3 sm:col-span-3">
						<legend class="block text-sm font-medium text-ink">Voice</legend>
						<div class="grid gap-3 sm:grid-cols-3">
							<label class="block text-sm">
								<span class="text-ink-muted">Search</span>
								<input
									class="mt-1 field w-full"
									bind:value={voiceSearch}
									placeholder="Name or character"
								/>
							</label>
							<label class="block text-sm">
								<span class="text-ink-muted">Language</span>
								<select class="mt-1 field w-full" bind:value={voiceLanguage}>
									<option>All</option>
									<option>English</option>
									<option>Portuguese</option>
									<option>Spanish</option>
									<option>German</option>
									<option>French</option>
									<option>Hindi</option>
									<option>Japanese</option>
									<option>Korean</option>
								</select>
							</label>
							<label class="block text-sm">
								<span class="text-ink-muted">Presentation</span>
								<select class="mt-1 field w-full" bind:value={voicePresentation}>
									<option>All</option>
									<option>Feminine</option>
									<option>Masculine</option>
								</select>
							</label>
						</div>
						<div class="max-h-64 space-y-2 overflow-y-auto rounded-tile border border-line p-2">
							{#each filteredVoices as voice (voice.apiName)}
								<label
									class="flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-3 py-2 hover:bg-white/5"
								>
									<input
										type="radio"
										name="live-voice"
										value={voice.apiName}
										bind:group={draft.models.voice}
										class="mt-1"
									/>
									<span class="min-w-0">
										<span class="block font-medium">{voice.name}</span>
										{#if voice.character}<span class="block text-sm text-accent-ink"
												>{voice.character}</span
											>{/if}
										<span class="block text-xs text-ink-muted">
											{voice.language}{voice.regionalInfluence
												? ` · ${voice.regionalInfluence}`
												: ''} · {voice.presentation}
										</span>
									</span>
								</label>
							{:else}
								<p class="p-3 text-sm text-ink-muted">No natural voices match these filters.</p>
							{/each}
						</div>
						{@render fieldError('voice')}
					</fieldset>
					<div>
						<label for="backend-model" class="block text-sm font-medium text-ink">
							Backend reasoning model
						</label>
						<input
							id="backend-model"
							list="model-options"
							class="mt-1 field w-full"
							bind:value={draft.models.backendModel}
							aria-invalid={errors['backend-model'] ? 'true' : undefined}
							aria-describedby={errors['backend-model'] ? 'backend-model-error' : undefined}
						/>
						{@render fieldError('backend-model')}
					</div>
					<div>
						<label for="text-model" class="block text-sm font-medium text-ink"
							>Text chat model</label
						>
						<input
							id="text-model"
							list="model-options"
							class="mt-1 field w-full"
							bind:value={draft.models.textModel}
							aria-invalid={errors['text-model'] ? 'true' : undefined}
							aria-describedby={errors['text-model'] ? 'text-model-error' : undefined}
						/>
						{@render fieldError('text-model')}
					</div>
				</div>
				<datalist id="model-options">
					{#each MODEL_SUGGESTIONS as model (model)}<option value={model}></option>{/each}
				</datalist>
			</fieldset>

			<fieldset class="form-group space-y-4">
				<legend>Favorites and history</legend>
				<div>
					<label for="areas" class="block text-sm font-medium text-ink">
						Favorite areas (comma separated)
					</label>
					<input
						id="areas"
						type="text"
						placeholder="Living room, Kitchen"
						class="mt-1 field w-full"
						bind:value={areasText}
						aria-invalid={errors['areas'] ? 'true' : undefined}
						aria-describedby={errors['areas'] ? 'areas-error' : undefined}
					/>
					{@render fieldError('areas')}
				</div>
				<div class="grid gap-2 sm:grid-cols-4">
					{#each INITIAL_DOMAINS as domain (domain)}
						<label class="flex min-h-11 items-center gap-3 text-sm">
							<input
								type="checkbox"
								checked={draft.favorites.domains.includes(domain)}
								onchange={(event) =>
									(draft.favorites.domains = toggle(
										draft.favorites.domains,
										domain,
										event.currentTarget.checked
									))}
							/>
							{domainLabels[domain]}
						</label>
					{/each}
				</div>
				<p class="text-sm text-ink-muted">
					Text messages, voice transcripts, and voice tool results are stored unencrypted in this
					browser. You can delete chat history in Settings.
				</p>
			</fieldset>

			<fieldset class="form-group space-y-4">
				<legend>Connection details</legend>
				<div class="grid gap-4 sm:grid-cols-2">
					<div>
						<label for="mcp-transport" class="block text-sm font-medium text-ink">Transport</label>
						<select id="mcp-transport" class="mt-1 field w-full" bind:value={draft.mcp.transport}>
							<option value="streamable-http">Streamable HTTP</option>
							<option value="sse">Server-sent events (legacy)</option>
						</select>
					</div>
					<div>
						<label for="mcp-name" class="block text-sm font-medium text-ink">
							Display name (optional)
						</label>
						<input
							id="mcp-name"
							type="text"
							maxlength="80"
							class="mt-1 field w-full"
							bind:value={draft.mcp.displayName}
						/>
					</div>
				</div>
				<div>
					<label for="mcp-auth" class="block text-sm font-medium text-ink">Authentication</label>
					<select id="mcp-auth" class="mt-1 field w-full" bind:value={draft.mcp.authType}>
						<option value="none">None</option>
						<option value="bearer">Bearer token</option>
					</select>
				</div>
			</fieldset>

			<fieldset class="form-group space-y-4">
				<legend>Home Assistant (optional)</legend>
				<p class="text-sm text-ink-muted">Used later for live entity updates over WebSocket.</p>
				<div>
					<label for="ha-url" class="block text-sm font-medium text-ink">Base URL</label>
					<input
						id="ha-url"
						type="url"
						inputmode="url"
						placeholder="https://homeassistant.example.com"
						class="mt-1 field w-full"
						bind:value={draft.homeAssistant.baseUrl}
						aria-invalid={errors['ha-url'] ? 'true' : undefined}
						aria-describedby={errors['ha-url'] ? 'ha-url-error' : undefined}
					/>
					{@render fieldError('ha-url')}
				</div>
				{@render secretField(
					'homeAssistantToken',
					'ha-token',
					'Use a dedicated, least-privilege token.'
				)}
			</fieldset>
		</div>
	</details>

	{#if errors['form']}
		<p class="text-sm text-danger" role="alert">{errors['form']}</p>
	{/if}
	{#if Object.keys(errors).length > 0}
		<p class="text-sm text-danger" role="alert">Please fix the highlighted fields.</p>
	{/if}

	<button type="submit" class="btn w-full btn-primary sm:w-auto">
		{submitLabel}
	</button>
</form>
