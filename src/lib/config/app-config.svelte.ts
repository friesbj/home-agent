import { browser } from '$app/environment';
import {
	clearAllAppData,
	defaultConfirmationPolicy,
	defaultSettings,
	getSecretStatus,
	loadConfirmationPolicy,
	loadSecrets,
	loadSettings,
	saveConfirmationPolicy,
	saveSecrets,
	saveSettings,
	type ConfirmationPolicy,
	type SecretName,
	type Secrets,
	type Settings
} from './settings';

/** Reactive view of the browser-stored configuration. Secrets are only exposed via `getSecret`. */
class AppConfig {
	settings = $state<Settings>(defaultSettings());
	confirmation = $state<ConfirmationPolicy>(defaultConfirmationPolicy());
	#secrets = $state<Secrets>({});

	secretStatus = $derived(getSecretStatus(this.#secrets));

	constructor() {
		this.reload();
	}

	reload() {
		if (!browser) return;
		this.settings = loadSettings(localStorage);
		this.confirmation = loadConfirmationPolicy(localStorage);
		this.#secrets = loadSecrets(localStorage);
	}

	getSecret(name: SecretName): string | undefined {
		return this.#secrets[name];
	}

	/** Persists settings and policy. Secret entries that are empty strings are left unchanged. */
	save(update: { settings: Settings; confirmation: ConfirmationPolicy; secrets?: Secrets }) {
		const secrets = { ...this.#secrets };
		for (const [name, value] of Object.entries(update.secrets ?? {})) {
			if (value) secrets[name as SecretName] = value;
		}
		saveSettings(localStorage, update.settings);
		saveConfirmationPolicy(localStorage, update.confirmation);
		saveSecrets(localStorage, secrets);
		this.reload();
	}

	deleteSecret(name: SecretName) {
		const secrets = { ...this.#secrets };
		delete secrets[name];
		saveSecrets(localStorage, secrets);
		this.reload();
	}

	/** Restores preferences to defaults while keeping the MCP connection, credentials, and onboarding state. */
	resetPreferences() {
		const defaults = defaultSettings();
		saveSettings(localStorage, {
			...defaults,
			onboardingCompleted: this.settings.onboardingCompleted,
			mcp: this.settings.mcp,
			homeAssistant: this.settings.homeAssistant
		});
		saveConfirmationPolicy(localStorage, defaultConfirmationPolicy());
		this.reload();
	}

	/** Removes every stored setting, preference, history entry, and credential. */
	resetAll() {
		clearAllAppData(localStorage);
		clearAllAppData(sessionStorage);
		this.reload();
	}
}

export const appConfig = new AppConfig();
