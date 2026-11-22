import { describe, expect, it, vi } from 'vitest';
import { assertMcpUrlAllowed, createPinnedFetch, McpGatewayError } from './url-guard';

const strict = { allowInsecureHttp: false, allowPrivateHosts: false };
const resolvesTo = (address: string, family = 4) => vi.fn(async () => [{ address, family }]);

describe('assertMcpUrlAllowed', () => {
	it('accepts hostnames resolving to public addresses', async () => {
		const url = await assertMcpUrlAllowed(
			'https://ha.example.com/api/mcp',
			strict,
			resolvesTo('93.184.216.34')
		);
		expect(url.href).toBe('https://ha.example.com/api/mcp');
	});

	it('rejects hostnames resolving to private, loopback, or link-local addresses', async () => {
		for (const [address, family] of [
			['192.168.1.5', 4],
			['127.0.0.1', 4],
			['::1', 6],
			['169.254.169.254', 4]
		] as const) {
			await expect(
				assertMcpUrlAllowed('https://ha.example.com', strict, resolvesTo(address, family))
			).rejects.toBeInstanceOf(McpGatewayError);
		}
	});

	it('never allows link-local targets even when private hosts are allowed', async () => {
		const lenient = { allowInsecureHttp: true, allowPrivateHosts: true };
		await expect(
			assertMcpUrlAllowed('https://ha.example.com', lenient, resolvesTo('169.254.169.254'))
		).rejects.toThrow(/forbidden/);
		await expect(
			assertMcpUrlAllowed('http://ha.example.com', lenient, resolvesTo('192.168.1.5'))
		).resolves.toBeInstanceOf(URL);
	});

	it('reports resolution failures and skips DNS for IP literals', async () => {
		const failing = vi.fn(async () => {
			throw new Error('ENOTFOUND');
		});
		await expect(
			assertMcpUrlAllowed('https://missing.example.com', strict, failing)
		).rejects.toThrow(/could not be resolved/);
		const lookup = vi.fn();
		await assertMcpUrlAllowed('https://93.184.216.34', strict, lookup);
		expect(lookup).not.toHaveBeenCalled();
	});
});

describe('createPinnedFetch', () => {
	it('only fetches the pinned origin and disables redirects', async () => {
		const baseFetch = vi.fn(async () => new Response('ok'));
		const pinned = createPinnedFetch('https://ha.example.com', baseFetch as typeof fetch);

		await pinned('https://ha.example.com/api/mcp', { method: 'POST' });
		expect(baseFetch).toHaveBeenCalledWith('https://ha.example.com/api/mcp', {
			method: 'POST',
			redirect: 'error'
		});

		await expect(pinned('http://169.254.169.254/latest')).rejects.toBeInstanceOf(McpGatewayError);
		expect(baseFetch).toHaveBeenCalledTimes(1);
	});
});
