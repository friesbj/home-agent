import { z } from 'zod';
import type { McpUrlPolicy } from '$lib/config/mcp-url';

const PLACEHOLDER_VALUES = new Set(['', 'your_openai_api_key', 'changeme']);

const optionalSecret = z
	.string()
	.optional()
	.transform((value) => {
		const trimmed = value?.trim() ?? '';
		return PLACEHOLDER_VALUES.has(trimmed) ? undefined : trimmed;
	});

function booleanFlag(defaultValue: boolean) {
	return z
		.enum(['true', 'false', '1', '0', ''])
		.optional()
		.transform((value) =>
			value === undefined || value === '' ? defaultValue : value === 'true' || value === '1'
		);
}

function positiveInt(defaultValue: number, max: number) {
	return z
		.string()
		.optional()
		.transform((value) =>
			value === undefined || value.trim() === '' ? defaultValue : Number(value)
		)
		.pipe(z.number().int().positive().max(max));
}

function createSchema(dev: boolean) {
	return z.object({
		OPENAI_API_KEY: optionalSecret,
		OPENAI_TEXT_MODEL: z
			.string()
			.optional()
			.transform((value) => value?.trim() || 'gpt-6-astra')
			.pipe(z.string().regex(/^[a-z0-9][a-z0-9._-]{0,63}$/i)),
		MCP_ALLOW_PRIVATE_HOSTS: booleanFlag(dev),
		MCP_ALLOW_INSECURE_HTTP: booleanFlag(dev),
		ALLOWED_ORIGINS: z
			.string()
			.optional()
			.transform((value) =>
				(value ?? '')
					.split(',')
					.map((origin) => origin.trim())
					.filter(Boolean)
			)
			.pipe(z.array(z.url({ protocol: /^https?$/ }))),
		RATE_LIMIT_MAX_REQUESTS: positiveInt(30, 10_000),
		RATE_LIMIT_WINDOW_MS: positiveInt(60_000, 3_600_000),
		REQUEST_TIMEOUT_MS: positiveInt(60_000, 600_000),
		MAX_REQUEST_BODY_BYTES: positiveInt(1_000_000, 20_000_000)
	});
}

export interface ServerEnv {
	openaiApiKey?: string;
	textModel: string;
	mcpUrlPolicy: McpUrlPolicy;
	allowedOrigins: string[];
	rateLimit: { maxRequests: number; windowMs: number };
	requestTimeoutMs: number;
	maxRequestBodyBytes: number;
}

export class ServerEnvError extends Error {
	constructor(public readonly issues: string[]) {
		super(`Invalid server configuration:\n- ${issues.join('\n- ')}`);
		this.name = 'ServerEnvError';
	}
}

/** Parses raw environment variables. Error messages name variables but never echo their values. */
export function parseServerEnv(
	raw: Record<string, string | undefined>,
	{ dev }: { dev: boolean }
): ServerEnv {
	const result = createSchema(dev).safeParse(raw);
	if (!result.success) {
		throw new ServerEnvError(
			result.error.issues.map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
		);
	}
	const env = result.data;
	return {
		openaiApiKey: env.OPENAI_API_KEY,
		textModel: env.OPENAI_TEXT_MODEL,
		mcpUrlPolicy: {
			allowPrivateHosts: env.MCP_ALLOW_PRIVATE_HOSTS,
			allowInsecureHttp: env.MCP_ALLOW_INSECURE_HTTP
		},
		allowedOrigins: env.ALLOWED_ORIGINS.map((origin) => new URL(origin).origin),
		rateLimit: { maxRequests: env.RATE_LIMIT_MAX_REQUESTS, windowMs: env.RATE_LIMIT_WINDOW_MS },
		requestTimeoutMs: env.REQUEST_TIMEOUT_MS,
		maxRequestBodyBytes: env.MAX_REQUEST_BODY_BYTES
	};
}
