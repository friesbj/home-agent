import { lookup as dnsLookup } from 'node:dns/promises';
import { classifyHost, validateMcpUrl, type McpUrlPolicy } from '$lib/config/mcp-url';

export type HostLookup = (hostname: string) => Promise<{ address: string; family: number }[]>;

const defaultLookup: HostLookup = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/** Error whose message is safe to show to users. */
export class McpGatewayError extends Error {
	constructor(
		message: string,
		public readonly status = 502
	) {
		super(message);
		this.name = 'McpGatewayError';
	}
}

function isIpLiteral(hostname: string) {
	return hostname.startsWith('[') || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}

/**
 * Validates an MCP URL against the deployment policy, including the addresses the hostname
 * resolves to. Prevents using the gateway to reach link-local (cloud metadata) or, unless
 * allowed, private/loopback networks.
 */
export async function assertMcpUrlAllowed(
	raw: string,
	policy: McpUrlPolicy,
	lookup: HostLookup = defaultLookup
): Promise<URL> {
	const result = validateMcpUrl(raw, policy);
	if (!result.ok) throw new McpGatewayError(result.error, 400);
	const { url } = result;
	if (isIpLiteral(url.hostname)) return url;

	let addresses: { address: string; family: number }[];
	try {
		addresses = await lookup(url.hostname);
	} catch {
		throw new McpGatewayError('The MCP server hostname could not be resolved.', 502);
	}
	if (addresses.length === 0) {
		throw new McpGatewayError('The MCP server hostname could not be resolved.', 502);
	}

	for (const { address, family } of addresses) {
		const hostClass = classifyHost(family === 6 ? `[${address}]` : address);
		if (hostClass === 'link-local' || hostClass === 'unspecified') {
			throw new McpGatewayError('The MCP server resolves to a forbidden address.', 400);
		}
		if (hostClass !== 'public' && !policy.allowPrivateHosts) {
			throw new McpGatewayError(
				'The MCP server resolves to a private-network address, which this deployment does not allow.',
				400
			);
		}
	}
	return url;
}

/**
 * Fetch wrapper that only talks to the validated origin and never follows redirects.
 * Guards against SSE `endpoint` events or redirects pointing to other hosts.
 */
export function createPinnedFetch(origin: string, baseFetch: typeof fetch = fetch): typeof fetch {
	return (input, init) => {
		const target = new URL(input instanceof Request ? input.url : String(input));
		if (target.origin !== origin) {
			return Promise.reject(
				new McpGatewayError('The MCP server tried to redirect to another host.')
			);
		}
		return baseFetch(input, { ...init, redirect: 'error' });
	};
}
