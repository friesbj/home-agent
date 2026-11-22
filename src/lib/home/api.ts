import { MCP_TOKEN_HEADER, OPENAI_KEY_HEADER } from '$lib/config/headers';
import { appConfig } from '$lib/config/app-config.svelte';
import type { DiscoveryResult, HomeState } from './types';

export interface McpTarget {
	url: string;
	transport: 'streamable-http' | 'sse';
	token?: string;
}

/** The saved MCP connection, or `null` when onboarding has not configured one. */
export function savedMcpTarget(): McpTarget | null {
	const { mcp } = appConfig.settings;
	if (!mcp.url) return null;
	return {
		url: mcp.url,
		transport: mcp.transport,
		token: mcp.authType === 'bearer' ? appConfig.getSecret('mcpToken') : undefined
	};
}

export function credentialHeaders(target: McpTarget | null): Record<string, string> {
	const headers: Record<string, string> = {};
	const openaiKey = appConfig.getSecret('openaiApiKey');
	if (openaiKey) headers[OPENAI_KEY_HEADER] = openaiKey;
	if (target?.token) headers[MCP_TOKEN_HEADER] = target.token;
	return headers;
}

export class ApiError extends Error {}

async function postJson<T>(path: string, target: McpTarget, signal?: AbortSignal): Promise<T> {
	const response = await fetch(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...credentialHeaders(target) },
		body: JSON.stringify({ mcp: { url: target.url, transport: target.transport } }),
		signal
	});
	if (!response.ok) {
		const body = (await response.json().catch(() => null)) as {
			message?: string;
			error?: string;
		} | null;
		throw new ApiError(body?.message ?? body?.error ?? `Request failed (${response.status}).`);
	}
	return (await response.json()) as T;
}

export function discoverTools(target: McpTarget, signal?: AbortSignal) {
	return postJson<DiscoveryResult>('/api/mcp/discover', target, signal);
}

export function fetchHomeState(target: McpTarget, signal?: AbortSignal) {
	return postJson<HomeState>('/api/home/state', target, signal);
}
