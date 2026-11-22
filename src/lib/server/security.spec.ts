import { describe, expect, it } from 'vitest';
import { ServerEnvError, parseServerEnv } from './env-schema';
import { FixedWindowRateLimiter } from './rate-limit';
import { checkApiRequest } from './request-guard';

describe('parseServerEnv', () => {
	it('applies environment-dependent defaults and ignores placeholder keys', () => {
		const prod = parseServerEnv({ OPENAI_API_KEY: 'your_openai_api_key' }, { dev: false });
		expect(prod.openaiApiKey).toBeUndefined();
		expect(prod.mcpUrlPolicy).toEqual({ allowPrivateHosts: false, allowInsecureHttp: false });
		expect(parseServerEnv({}, { dev: true }).mcpUrlPolicy.allowInsecureHttp).toBe(true);
	});

	it('parses explicit values', () => {
		const env = parseServerEnv(
			{
				MCP_ALLOW_PRIVATE_HOSTS: 'true',
				ALLOWED_ORIGINS: 'https://a.example.com/, https://b.example.com',
				RATE_LIMIT_MAX_REQUESTS: '5'
			},
			{ dev: false }
		);
		expect(env.mcpUrlPolicy.allowPrivateHosts).toBe(true);
		expect(env.allowedOrigins).toEqual(['https://a.example.com', 'https://b.example.com']);
		expect(env.rateLimit.maxRequests).toBe(5);
	});

	it('reports invalid variables without echoing secret values', () => {
		try {
			parseServerEnv(
				{
					OPENAI_API_KEY: 'sk-secret',
					RATE_LIMIT_MAX_REQUESTS: 'many',
					MCP_ALLOW_INSECURE_HTTP: 'yes'
				},
				{ dev: false }
			);
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(ServerEnvError);
			const message = (error as Error).message;
			expect(message).toContain('RATE_LIMIT_MAX_REQUESTS');
			expect(message).toContain('MCP_ALLOW_INSECURE_HTTP');
			expect(message).not.toContain('sk-secret');
		}
	});
});

describe('FixedWindowRateLimiter', () => {
	it('limits per key and resets after the window', () => {
		let now = 0;
		const limiter = new FixedWindowRateLimiter(2, 1000, () => now);
		expect(limiter.check('a').allowed).toBe(true);
		expect(limiter.check('a').allowed).toBe(true);
		expect(limiter.check('a')).toMatchObject({ allowed: false, retryAfterSeconds: 1 });
		expect(limiter.check('b').allowed).toBe(true);
		now = 1000;
		expect(limiter.check('a').allowed).toBe(true);
	});
});

describe('checkApiRequest', () => {
	const url = new URL('https://app.example.com/api/chat');
	const options = { allowedOrigins: ['https://trusted.example.com'], maxRequestBodyBytes: 10 };
	const post = (headers: Record<string, string>) =>
		new Request(url, { method: 'POST', headers, body: '{}' });

	it('allows same-origin, configured origins, and safe methods', () => {
		expect(checkApiRequest(post({ origin: url.origin }), url, options)).toBeNull();
		expect(
			checkApiRequest(post({ origin: 'https://trusted.example.com' }), url, options)
		).toBeNull();
		expect(checkApiRequest(new Request(url), url, options)).toBeNull();
	});

	it('rejects missing or foreign origins and oversized bodies', () => {
		expect(checkApiRequest(post({}), url, options)?.status).toBe(403);
		expect(checkApiRequest(post({ origin: 'https://evil.example' }), url, options)?.status).toBe(
			403
		);
		expect(
			checkApiRequest(post({ origin: url.origin, 'content-length': '11' }), url, options)?.status
		).toBe(413);
	});
});
