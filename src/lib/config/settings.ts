import { z } from 'zod';
import { secretStatus, type SecretStatus } from '$lib/security/redact';
import { DEFAULT_VOICE_ENTRY, VOICE_API_NAMES, VOICE_CATALOG } from './voices';

export const STORAGE_PREFIX = 'home-agent.';

export const STORAGE_KEYS = {
	settings: `${STORAGE_PREFIX}settings.v1`,
	confirmationPolicy: `${STORAGE_PREFIX}confirmation-policy.v1`,
	secrets: `${STORAGE_PREFIX}secrets.v1`
} as const;

export const LIVE_MODEL = 'gpt-live-1.1';
export const DEFAULT_TEXT_MODEL = 'gpt-6-astra';
export const DEFAULT_BACKEND_MODEL = 'gpt-6-astra';
export const DEFAULT_VOICE = DEFAULT_VOICE_ENTRY.apiName;
export const VOICE_SUGGESTIONS = VOICE_API_NAMES;
export { VOICE_CATALOG };

export const MODEL_SUGGESTIONS = ['gpt-6-astra', 'gpt-6-luna', 'gpt-6-sol'] as const;

/** Home Assistant domains in the initial allowlist (see AGENTS.md). */
export const INITIAL_DOMAINS = ['light', 'climate', 'scene', 'script'] as const;
export const HIGH_RISK_DOMAINS = ['lock', 'alarm_control_panel', 'cover', 'valve'] as const;
export const CONFIRMABLE_DOMAINS = [...INITIAL_DOMAINS, ...HIGH_RISK_DOMAINS] as const;

export const MCP_TRANSPORTS = ['streamable-http', 'sse'] as const;
export const MCP_AUTH_TYPES = ['none', 'bearer'] as const;
export const CONFIRMATION_MODES = ['all', 'high-risk', 'custom', 'none'] as const;

const modelId = z
	.string()
	.trim()
	.regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i, 'Use a model identifier such as gpt-6-astra.');

const optionalUrl = z
	.string()
	.trim()
	.refine((value) => value === '' || URL.canParse(value), 'Enter a valid URL or leave it empty.');

const domainList = z.array(z.string().trim().min(1).max(64)).max(64);

export const settingsSchema = z.object({
	onboardingCompleted: z.boolean().default(false),
	profile: z
		.object({ displayName: z.string().trim().max(40, 'Use at most 40 characters.').default('') })
		.prefault({}),
	mcp: z
		.object({
			url: z.string().trim().max(2048).default(''),
			transport: z.enum(MCP_TRANSPORTS).default('streamable-http'),
			displayName: z.string().trim().max(80).default(''),
			// The Home Assistant MCP integration requires a long-lived access token.
			authType: z.enum(MCP_AUTH_TYPES).default('bearer')
		})
		.prefault({}),
	homeAssistant: z.object({ baseUrl: optionalUrl.default('') }).prefault({}),
	models: z
		.object({
			liveModel: z.literal(LIVE_MODEL).default(LIVE_MODEL),
			voice: z.enum(VOICE_API_NAMES).default(DEFAULT_VOICE),
			backendModel: modelId.default(DEFAULT_BACKEND_MODEL),
			textModel: modelId.default(DEFAULT_TEXT_MODEL)
		})
		.prefault({}),
	favorites: z
		.object({
			areas: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
			domains: domainList.default([])
		})
		.prefault({})
});

export const confirmationPolicySchema = z.object({
	mode: z.enum(CONFIRMATION_MODES).default('all'),
	/** Domains requiring confirmation when `mode` is `custom`. */
	domains: domainList.default([...CONFIRMABLE_DOMAINS]),
	/** Explicit acknowledgement required for `mode: 'none'`. */
	acknowledgedNoConfirmationRisk: z.boolean().default(false)
});

export const secretsSchema = z.object({
	openaiApiKey: z.string().trim().max(512).optional(),
	mcpToken: z.string().trim().max(4096).optional(),
	homeAssistantToken: z.string().trim().max(4096).optional()
});

export type Settings = z.infer<typeof settingsSchema>;
export type ConfirmationPolicy = z.infer<typeof confirmationPolicySchema>;
export type Secrets = z.infer<typeof secretsSchema>;
export type SecretName = keyof Secrets;
export type SecretStatusMap = Record<SecretName, SecretStatus>;

export const SECRET_LABELS: Record<SecretName, string> = {
	openaiApiKey: 'OpenAI API key',
	mcpToken: 'MCP bearer token',
	homeAssistantToken: 'Home Assistant access token'
};

export function defaultSettings(): Settings {
	return settingsSchema.parse({});
}

export function defaultConfirmationPolicy(): ConfirmationPolicy {
	return confirmationPolicySchema.parse({});
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

interface Envelope {
	version: 1;
	data: unknown;
}

function readVersioned<T>(storage: StorageLike, key: string, schema: z.ZodType<T>): T {
	const fallback = schema.parse({});
	const raw = storage.getItem(key);
	if (!raw) return fallback;
	try {
		const envelope = JSON.parse(raw) as Envelope;
		if (envelope?.version !== 1) return fallback;
		const result = schema.safeParse(envelope.data);
		return result.success ? result.data : fallback;
	} catch {
		return fallback;
	}
}

function writeVersioned<T>(storage: StorageLike, key: string, schema: z.ZodType<T>, value: T) {
	const data = schema.parse(value);
	storage.setItem(key, JSON.stringify({ version: 1, data } satisfies Envelope));
}

export function loadSettings(storage: StorageLike): Settings {
	const storedSettingsSchema = settingsSchema.extend({
		models: settingsSchema.shape.models
			.unwrap()
			.extend({
				voice: z.enum(VOICE_API_NAMES).default(DEFAULT_VOICE).catch(DEFAULT_VOICE)
			})
			.prefault({})
	});
	return readVersioned(storage, STORAGE_KEYS.settings, storedSettingsSchema);
}

export function saveSettings(storage: StorageLike, settings: Settings) {
	writeVersioned(storage, STORAGE_KEYS.settings, settingsSchema, settings);
}

export function loadConfirmationPolicy(storage: StorageLike): ConfirmationPolicy {
	return readVersioned(storage, STORAGE_KEYS.confirmationPolicy, confirmationPolicySchema);
}

export function saveConfirmationPolicy(storage: StorageLike, policy: ConfirmationPolicy) {
	writeVersioned(storage, STORAGE_KEYS.confirmationPolicy, confirmationPolicySchema, policy);
}

export function loadSecrets(storage: StorageLike): Secrets {
	const secrets = readVersioned(storage, STORAGE_KEYS.secrets, secretsSchema);
	return Object.fromEntries(Object.entries(secrets).filter(([, value]) => value)) as Secrets;
}

export function saveSecrets(storage: StorageLike, secrets: Secrets) {
	const filtered = Object.fromEntries(Object.entries(secrets).filter(([, value]) => value));
	if (Object.keys(filtered).length === 0) storage.removeItem(STORAGE_KEYS.secrets);
	else writeVersioned(storage, STORAGE_KEYS.secrets, secretsSchema, filtered);
}

export function getSecretStatus(secrets: Secrets): SecretStatusMap {
	return {
		openaiApiKey: secretStatus(secrets.openaiApiKey),
		mcpToken: secretStatus(secrets.mcpToken),
		homeAssistantToken: secretStatus(secrets.homeAssistantToken)
	};
}

/** Removes every key owned by this application, including keys from older versions. */
export function clearAllAppData(storage: StorageLike) {
	const keys: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
	}
	for (const key of keys) storage.removeItem(key);
}

/** Whether a mutating action in `domain` requires confirmation under the browser preference. */
export function requiresConfirmation(policy: ConfirmationPolicy, domain: string): boolean {
	switch (policy.mode) {
		case 'all':
			return true;
		case 'high-risk':
			return (HIGH_RISK_DOMAINS as readonly string[]).includes(domain);
		case 'custom':
			return policy.domains.includes(domain);
		case 'none':
			// Without explicit acknowledgement, fall back to the safe default.
			return !policy.acknowledgedNoConfirmationRisk;
	}
}
