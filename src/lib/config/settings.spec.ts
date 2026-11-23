import { describe, expect, it } from 'vitest';
import {
	STORAGE_KEYS,
	clearAllAppData,
	defaultSettings,
	getSecretStatus,
	loadConfirmationPolicy,
	loadSecrets,
	loadSettings,
	requiresConfirmation,
	saveSecrets,
	saveSettings,
	settingsSchema,
	type ConfirmationPolicy
} from './settings';

function memoryStorage(initial: Record<string, string> = {}) {
	const map = new Map(Object.entries(initial));
	return {
		get length() {
			return map.size;
		},
		key: (index: number) => [...map.keys()][index] ?? null,
		getItem: (key: string) => map.get(key) ?? null,
		setItem: (key: string, value: string) => void map.set(key, value),
		removeItem: (key: string) => void map.delete(key),
		map
	};
}

describe('browser settings storage', () => {
	it('round-trips settings in a versioned envelope', () => {
		const storage = memoryStorage();
		const settings = defaultSettings();
		settings.mcp.url = 'https://mcp.example.com/mcp';
		saveSettings(storage, settings);

		expect(JSON.parse(storage.map.get(STORAGE_KEYS.settings)!).version).toBe(1);
		expect(loadSettings(storage).mcp.url).toBe('https://mcp.example.com/mcp');
	});

	it('falls back to defaults for corrupt, unknown-version, or invalid data', () => {
		for (const raw of ['{oops', '{"version":2,"data":{}}', '{"version":1,"data":{"mcp":5}}']) {
			const storage = memoryStorage({ [STORAGE_KEYS.settings]: raw });
			expect(loadSettings(storage)).toEqual(defaultSettings());
		}
	});

	it('defaults to confirming every mutation', () => {
		expect(loadConfirmationPolicy(memoryStorage()).mode).toBe('all');
	});

	it('keeps settings stored before the profile existed and validates the display name', () => {
		const stored = {
			version: 1,
			data: { onboardingCompleted: true, mcp: { url: 'https://a.b/mcp' } }
		};
		const loaded = loadSettings(memoryStorage({ [STORAGE_KEYS.settings]: JSON.stringify(stored) }));
		expect(loaded.mcp.url).toBe('https://a.b/mcp');
		expect(loaded.profile.displayName).toBe('');
		expect(settingsSchema.parse({ profile: { displayName: '  Alex ' } }).profile.displayName).toBe(
			'Alex'
		);
		expect(settingsSchema.safeParse({ profile: { displayName: 'x'.repeat(41) } }).success).toBe(
			false
		);
	});

	it('drops empty secrets and removes the key when none remain', () => {
		const storage = memoryStorage();
		saveSecrets(storage, { openaiApiKey: 'sk-test', mcpToken: '' });
		expect(loadSecrets(storage)).toEqual({ openaiApiKey: 'sk-test' });
		expect(getSecretStatus(loadSecrets(storage))).toEqual({
			openaiApiKey: 'stored',
			mcpToken: 'missing',
			homeAssistantToken: 'missing'
		});

		saveSecrets(storage, {});
		expect(storage.map.has(STORAGE_KEYS.secrets)).toBe(false);
	});

	it('clears only application-owned keys', () => {
		const storage = memoryStorage({
			'home-agent.settings.v0': 'old',
			[STORAGE_KEYS.secrets]: 'x',
			'other-app': 'keep'
		});
		clearAllAppData(storage);
		expect([...storage.map.keys()]).toEqual(['other-app']);
	});
});

describe('requiresConfirmation', () => {
	const policy = (overrides: Partial<ConfirmationPolicy>): ConfirmationPolicy => ({
		mode: 'all',
		domains: [],
		acknowledgedNoConfirmationRisk: false,
		...overrides
	});

	it('applies each mode', () => {
		expect(requiresConfirmation(policy({ mode: 'all' }), 'light')).toBe(true);
		expect(requiresConfirmation(policy({ mode: 'high-risk' }), 'light')).toBe(false);
		expect(requiresConfirmation(policy({ mode: 'high-risk' }), 'lock')).toBe(true);
		expect(requiresConfirmation(policy({ mode: 'custom', domains: ['climate'] }), 'climate')).toBe(
			true
		);
		expect(requiresConfirmation(policy({ mode: 'custom', domains: ['climate'] }), 'light')).toBe(
			false
		);
	});

	it('only disables confirmation after explicit acknowledgement', () => {
		expect(requiresConfirmation(policy({ mode: 'none' }), 'light')).toBe(true);
		expect(
			requiresConfirmation(policy({ mode: 'none', acknowledgedNoConfirmationRisk: true }), 'light')
		).toBe(false);
	});
});
