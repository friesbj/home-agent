import { describe, expect, it } from 'vitest';
import { REDACTED, redactSecrets } from './redact';

describe('redactSecrets', () => {
	it('redacts sensitive keys at any depth without mutating the input', () => {
		const input = {
			mcp: { url: 'https://mcp.example.com', token: 'abc' },
			headers: [{ Authorization: 'Bearer abc' }],
			openaiApiKey: 'sk-123',
			emptyPassword: ''
		};
		expect(redactSecrets(input)).toEqual({
			mcp: { url: 'https://mcp.example.com', token: REDACTED },
			headers: [{ Authorization: REDACTED }],
			openaiApiKey: REDACTED,
			emptyPassword: ''
		});
		expect(input.mcp.token).toBe('abc');
	});
});
