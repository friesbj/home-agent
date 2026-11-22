import { describe, expect, it } from 'vitest';
import { classifyHost, validateMcpUrl } from './mcp-url';

const strict = { allowInsecureHttp: false, allowPrivateHosts: false };
const dev = { allowInsecureHttp: true, allowPrivateHosts: true };

describe('validateMcpUrl', () => {
	it('accepts public https URLs and normalizes them', () => {
		const result = validateMcpUrl('  https://MCP.example.com/mcp ', strict);
		expect(result.ok && result.url.href).toBe('https://mcp.example.com/mcp');
	});

	it.each([
		['', 'Enter the MCP server address'],
		['not a url', 'valid absolute URL'],
		['ftp://mcp.example.com', 'Only http'],
		['https://user:pass@mcp.example.com', 'credentials'],
		['https://mcp.example.com/#x', 'fragment'],
		['http://mcp.example.com', 'Use https']
	])('rejects %j', (input, message) => {
		const result = validateMcpUrl(input, strict);
		expect(result.ok).toBe(false);
		expect(!result.ok && result.error).toContain(message);
	});

	it.each([
		'http://localhost:8123',
		'https://127.0.0.1',
		'https://2130706433',
		'https://[::1]',
		'https://[::ffff:192.168.1.2]',
		'https://192.168.1.10',
		'https://10.0.0.1',
		'https://homeassistant.local',
		'https://homeassistant'
	])('blocks private host %s unless allowed', (input) => {
		expect(validateMcpUrl(input, strict).ok).toBe(false);
		expect(validateMcpUrl(input, dev).ok).toBe(true);
	});

	it.each(['https://169.254.169.254/latest', 'https://[fe80::1]', 'http://0.0.0.0'])(
		'always blocks link-local/unspecified %s',
		(input) => {
			expect(validateMcpUrl(input, dev).ok).toBe(false);
		}
	);
});

describe('classifyHost', () => {
	it('classifies common address forms', () => {
		expect(classifyHost('172.16.0.1')).toBe('private');
		expect(classifyHost('172.32.0.1')).toBe('public');
		expect(classifyHost('[fd00::1]')).toBe('private');
		expect(classifyHost('app.localhost')).toBe('loopback');
		expect(classifyHost('example.com')).toBe('public');
	});
});
