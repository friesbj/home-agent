<script lang="ts" module>
	import type { ConfirmationPolicy, Secrets, Settings } from '$lib/config/settings';

	export interface SettingsFormResult {
		settings: Settings;
		confirmation: ConfirmationPolicy;
		secrets: Secrets;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
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
		VOICE_SUGGESTIONS,
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
			next['mcp-token'] = 'Enter the MCP bearer token or choose no authentication.';
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

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		const result = validate();
		if (!result) {
			const firstInvalid = (event.currentTarget as HTMLFormElement).querySelector<HTMLElement>(
				'[aria-invalid="true"]'
			);
			firstInvalid?.focus();
			return;
		}
		secretInputs = { openaiApiKey: '', mcpToken: '', homeAssistantToken: '' };
		onsave(result);
	}
</script>

{#snippet fieldError(id: string)}
	{#if errors[id]}
		<p id="{id}-error" class="mt-1 text-sm text-red-700">{errors[id]}</p>
	{/if}
{/snippet}

{#snippet secretField(name: SecretName, id: string, hint: string)}
	<div>
		<label for={id} class="block text-sm font-medium text-stone-800">{SECRET_LABELS[name]}</label>
		<p id="{id}-status" class="text-sm text-stone-600">
			{secretStatus[name] === 'stored'
				? 'Stored in this browser. Leave empty to keep it.'
				: 'Not stored.'}
			{hint}
		</p>
		<input
			{id}
			type="password"
			autocomplete="off"
			spellcheck="false"
			class="mt-1 w-full rounded-md border-stone-300"
			bind:value={secretInputs[name]}
			aria-invalid={errors[id] ? 'true' : undefined}
			aria-describedby="{id}-status {errors[id] ? `${id}-error` : ''}"
		/>
		{@render fieldError(id)}
	</div>
{/snippet}

<form class="space-y-8" onsubmit={handleSubmit} novalidate>
	<fieldset class="space-y-4">
		<legend class="text-lg font-semibold text-stone-900">MCP server</legend>
		<div>
			<label for="mcp-url" class="block text-sm font-medium text-stone-800">
				Server address <span aria-hidden="true">*</span>
			</label>
			<input
				id="mcp-url"
				type="url"
				required
				inputmode="url"
				placeholder="https://mcp.example.com/mcp"
				class="mt-1 w-full rounded-md border-stone-300"
				bind:value={draft.mcp.url}
				aria-invalid={errors['mcp-url'] ? 'true' : undefined}
				aria-describedby="mcp-url-hint {errors['mcp-url'] ? 'mcp-url-error' : ''}"
			/>
			<p id="mcp-url-hint" class="mt-1 text-sm text-stone-600">
				{mcpUrlPolicy.allowInsecureHttp ? 'http:// and https://' : 'Only https://'} addresses;
				{mcpUrlPolicy.allowPrivateHosts
					? 'local network addresses are allowed.'
					: 'local network addresses are blocked by this deployment.'}
			</p>
			{@render fieldError('mcp-url')}
		</div>
		<div class="grid gap-4 sm:grid-cols-2">
			<div>
				<label for="mcp-transport" class="block text-sm font-medium text-stone-800">Transport</label
				>
				<select
					id="mcp-transport"
					class="mt-1 w-full rounded-md border-stone-300"
					bind:value={draft.mcp.transport}
				>
					<option value="streamable-http">Streamable HTTP</option>
					<option value="sse">Server-sent events (legacy)</option>
				</select>
			</div>
			<div>
				<label for="mcp-name" class="block text-sm font-medium text-stone-800">
					Display name (optional)
				</label>
				<input
					id="mcp-name"
					type="text"
					maxlength="80"
					class="mt-1 w-full rounded-md border-stone-300"
					bind:value={draft.mcp.displayName}
				/>
			</div>
		</div>
		<div>
			<label for="mcp-auth" class="block text-sm font-medium text-stone-800">Authentication</label>
			<select
				id="mcp-auth"
				class="mt-1 w-full rounded-md border-stone-300"
				bind:value={draft.mcp.authType}
			>
				<option value="none">None</option>
				<option value="bearer">Bearer token</option>
			</select>
		</div>
		{#if draft.mcp.authType === 'bearer'}
			{@render secretField(
				'mcpToken',
				'mcp-token',
				'Use a Home Assistant long-lived access token.'
			)}
		{/if}
		<div class="space-y-2">
			<button
				type="button"
				class="rounded-md border border-stone-300 px-3 py-1.5 text-sm hover:bg-stone-100 disabled:opacity-50"
				onclick={testConnection}
				disabled={testing}
			>
				{testing ? 'Testing…' : 'Test connection'}
			</button>
			<div role="status" aria-live="polite" class="text-sm">
				{#if testResult?.ok}
					<p class="text-emerald-800">{testResult.message}</p>
				{:else if testResult}
					<p class="text-red-700">{testResult.message}</p>
				{/if}
			</div>
		</div>
	</fieldset>

	<fieldset class="space-y-4">
		<legend class="text-lg font-semibold text-stone-900">OpenAI</legend>
		{@render secretField(
			'openaiApiKey',
			'openai-key',
			serverHasOpenAiKey ? 'Optional: the server has a key configured.' : 'Required.'
		)}
	</fieldset>

	<fieldset class="space-y-4">
		<legend class="text-lg font-semibold text-stone-900">Voice and models</legend>
		<p class="text-sm text-stone-600">
			Live conversation model: <span class="font-mono">{LIVE_MODEL}</span>
		</p>
		<div class="grid gap-4 sm:grid-cols-3">
			<div>
				<label for="voice" class="block text-sm font-medium text-stone-800">Voice</label>
				<input
					id="voice"
					list="voice-options"
					class="mt-1 w-full rounded-md border-stone-300"
					bind:value={draft.models.voice}
					aria-invalid={errors['voice'] ? 'true' : undefined}
					aria-describedby={errors['voice'] ? 'voice-error' : undefined}
				/>
				{@render fieldError('voice')}
			</div>
			<div>
				<label for="backend-model" class="block text-sm font-medium text-stone-800">
					Backend reasoning model
				</label>
				<input
					id="backend-model"
					list="model-options"
					class="mt-1 w-full rounded-md border-stone-300"
					bind:value={draft.models.backendModel}
					aria-invalid={errors['backend-model'] ? 'true' : undefined}
					aria-describedby={errors['backend-model'] ? 'backend-model-error' : undefined}
				/>
				{@render fieldError('backend-model')}
			</div>
			<div>
				<label for="text-model" class="block text-sm font-medium text-stone-800"
					>Text chat model</label
				>
				<input
					id="text-model"
					list="model-options"
					class="mt-1 w-full rounded-md border-stone-300"
					bind:value={draft.models.textModel}
					aria-invalid={errors['text-model'] ? 'true' : undefined}
					aria-describedby={errors['text-model'] ? 'text-model-error' : undefined}
				/>
				{@render fieldError('text-model')}
			</div>
		</div>
		<datalist id="voice-options">
			{#each VOICE_SUGGESTIONS as voice (voice)}<option value={voice}></option>{/each}
		</datalist>
		<datalist id="model-options">
			{#each MODEL_SUGGESTIONS as model (model)}<option value={model}></option>{/each}
		</datalist>
	</fieldset>

	<fieldset
		class="space-y-3"
		aria-describedby={errors['confirmation'] ? 'confirmation-error' : undefined}
	>
		<legend class="text-lg font-semibold text-stone-900">Confirm smart-home changes</legend>
		{#each confirmationModes as mode (mode.value)}
			<label class="flex items-start gap-3">
				<input
					type="radio"
					name="confirmation-mode"
					value={mode.value}
					class="mt-1"
					bind:group={policy.mode}
				/>
				<span>
					<span class="block font-medium text-stone-800">{mode.label}</span>
					<span class="block text-sm text-stone-600">{mode.hint}</span>
				</span>
			</label>
		{/each}
		{#if policy.mode === 'custom'}
			<div class="ml-7 grid gap-2 sm:grid-cols-2">
				{#each CONFIRMABLE_DOMAINS as domain (domain)}
					<label class="flex items-center gap-2 text-sm">
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
			<div class="ml-7 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm" role="note">
				<p class="font-medium text-amber-900">
					Warning: the assistant will change devices without asking first.
				</p>
				<label class="mt-2 flex items-center gap-2">
					<input type="checkbox" bind:checked={policy.acknowledgedNoConfirmationRisk} />
					I understand and use a restricted private deployment.
				</label>
			</div>
		{/if}
		{@render fieldError('confirmation')}
	</fieldset>

	<fieldset class="space-y-4">
		<legend class="text-lg font-semibold text-stone-900">Home Assistant (optional)</legend>
		<p class="text-sm text-stone-600">Used later for live entity updates over WebSocket.</p>
		<div>
			<label for="ha-url" class="block text-sm font-medium text-stone-800">Base URL</label>
			<input
				id="ha-url"
				type="url"
				inputmode="url"
				placeholder="https://homeassistant.example.com"
				class="mt-1 w-full rounded-md border-stone-300"
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

	<fieldset class="space-y-4">
		<legend class="text-lg font-semibold text-stone-900">Favorites and history</legend>
		<div>
			<label for="areas" class="block text-sm font-medium text-stone-800">
				Favorite areas (comma separated)
			</label>
			<input
				id="areas"
				type="text"
				placeholder="Living room, Kitchen"
				class="mt-1 w-full rounded-md border-stone-300"
				bind:value={areasText}
				aria-invalid={errors['areas'] ? 'true' : undefined}
				aria-describedby={errors['areas'] ? 'areas-error' : undefined}
			/>
			{@render fieldError('areas')}
		</div>
		<div class="grid gap-2 sm:grid-cols-4">
			{#each INITIAL_DOMAINS as domain (domain)}
				<label class="flex items-center gap-2 text-sm">
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
		<label class="flex items-center gap-2 text-sm">
			<input type="checkbox" bind:checked={draft.history.enabled} />
			Keep text chat history in this browser
		</label>
		<p class="text-sm text-stone-600">
			Text messages are stored unencrypted. Turning history off keeps existing messages until you
			delete them in Settings. Tool activity is not restored.
		</p>
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				bind:checked={draft.history.retainTranscripts}
				disabled={!draft.history.enabled}
			/>
			Also keep full voice transcripts (planned)
		</label>
	</fieldset>

	{#if errors['form']}
		<p class="text-sm text-red-700" role="alert">{errors['form']}</p>
	{/if}
	{#if Object.keys(errors).length > 0}
		<p class="text-sm text-red-700" role="alert">Please fix the highlighted fields.</p>
	{/if}

	<button
		type="submit"
		class="rounded-md bg-stone-900 px-4 py-2 font-medium text-white hover:bg-stone-700 focus-visible:outline-2 focus-visible:outline-offset-2"
	>
		{submitLabel}
	</button>
</form>
