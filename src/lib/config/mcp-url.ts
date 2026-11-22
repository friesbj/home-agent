export interface McpUrlPolicy {
	/** Permit plain `http:` URLs. Intended for local development or trusted private networks only. */
	allowInsecureHttp: boolean;
	/** Permit loopback and private-network (RFC 1918 / ULA / local DNS suffix) hosts. */
	allowPrivateHosts: boolean;
}

export type McpUrlResult = { ok: true; url: URL } | { ok: false; error: string };

export type HostClass = 'public' | 'loopback' | 'private' | 'link-local' | 'unspecified';

const PRIVATE_DNS_SUFFIXES = ['.local', '.lan', '.internal', '.home.arpa', '.localdomain'];

function parseIpv4(host: string): number[] | null {
	const parts = host.split('.');
	if (parts.length !== 4) return null;
	const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN));
	return octets.every((octet) => octet >= 0 && octet <= 255) ? octets : null;
}

function classifyIpv4([a, b]: number[]): HostClass {
	if (a === 0) return 'unspecified';
	if (a === 127) return 'loopback';
	if (a === 169 && b === 254) return 'link-local';
	if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return 'private';
	if (a === 100 && b >= 64 && b <= 127) return 'private';
	return 'public';
}

function classifyIpv6(host: string): HostClass {
	const address = host.toLowerCase();
	if (address === '::') return 'unspecified';
	if (address === '::1') return 'loopback';
	const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
	if (mapped) {
		const high = parseInt(mapped[1], 16);
		const low = parseInt(mapped[2], 16);
		return classifyIpv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
	}
	if (/^fe[89ab][0-9a-f]?:/.test(address)) return 'link-local';
	if (/^f[cd][0-9a-f]{0,2}:/.test(address)) return 'private';
	return 'public';
}

/** Classifies a URL hostname (as normalized by `URL`) without performing DNS resolution. */
export function classifyHost(hostname: string): HostClass {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	if (host.startsWith('[') && host.endsWith(']')) return classifyIpv6(host.slice(1, -1));
	const ipv4 = parseIpv4(host);
	if (ipv4) return classifyIpv4(ipv4);
	if (host === 'localhost' || host.endsWith('.localhost')) return 'loopback';
	if (!host.includes('.') || PRIVATE_DNS_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
		return 'private';
	}
	return 'public';
}

/**
 * Validates a user-supplied MCP server URL against the deployment policy.
 * DNS-based checks (hostnames resolving to private addresses) belong to the server-side MCP gateway.
 */
export function validateMcpUrl(raw: string, policy: McpUrlPolicy): McpUrlResult {
	const value = raw.trim();
	if (!value) return { ok: false, error: 'Enter the MCP server address.' };

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return {
			ok: false,
			error: 'Enter a valid absolute URL, for example https://mcp.example.com/mcp.'
		};
	}

	if (url.protocol !== 'https:' && url.protocol !== 'http:') {
		return { ok: false, error: 'Only http:// and https:// MCP addresses are supported.' };
	}
	if (url.username || url.password) {
		return {
			ok: false,
			error: 'Do not put credentials in the URL. Use the authentication fields instead.'
		};
	}
	if (url.hash) return { ok: false, error: 'The MCP address must not contain a #fragment.' };

	const hostClass = classifyHost(url.hostname);
	if (hostClass === 'link-local' || hostClass === 'unspecified') {
		return { ok: false, error: 'Link-local and unspecified addresses are never allowed.' };
	}
	if (hostClass !== 'public' && !policy.allowPrivateHosts) {
		return {
			ok: false,
			error: 'Local and private-network addresses are not allowed by this deployment.'
		};
	}
	if (url.protocol === 'http:' && !policy.allowInsecureHttp) {
		return { ok: false, error: 'Use https://. Plain http:// is disabled for this deployment.' };
	}

	return { ok: true, url };
}
