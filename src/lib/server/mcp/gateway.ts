import { createMCPClient, type MCPClient, type ListToolsResult } from '@ai-sdk/mcp';
import type { Tool, ToolSet } from 'ai';
import type { McpUrlPolicy } from '$lib/config/mcp-url';
import type { DiscoveryResult, HomeState } from '$lib/home/types';
import { redactSecrets } from '$lib/security/redact';
import { baseToolName, classifyToolName, evaluateToolCall } from '$lib/home/ha-policy';
import { extractLiveContextText, groupByArea, parseLiveContext } from './live-context';
import {
	assertMcpUrlAllowed,
	createPinnedFetch,
	McpGatewayError,
	type HostLookup
} from './url-guard';

export { McpGatewayError };

export interface McpConnectionRequest {
	url: string;
	transport: 'streamable-http' | 'sse';
	token?: string;
}

export interface GatewayOptions {
	policy: McpUrlPolicy;
	timeoutMs: number;
	signal?: AbortSignal;
	lookup?: HostLookup;
	createClient?: (config: Parameters<typeof createMCPClient>[0]) => Promise<GatewayClient>;
}

export type GatewayClient = Pick<
	MCPClient,
	'listTools' | 'callTool' | 'toolsFromDefinitions' | 'close' | 'serverInfo'
>;

const MAX_TEXT_LENGTH = 8_000;

/** Redacts secret-looking fields and truncates oversized text before results reach the model/UI. */
export function sanitizeToolResult<T>(result: T): T {
	const redacted = redactSecrets(result) as T & { content?: unknown };
	if (Array.isArray(redacted?.content)) {
		redacted.content = redacted.content.map((part: { type?: string; text?: string }) =>
			part?.type === 'text' && typeof part.text === 'string' && part.text.length > MAX_TEXT_LENGTH
				? { ...part, text: `${part.text.slice(0, MAX_TEXT_LENGTH)}\n[truncated]` }
				: part
		);
	}
	return redacted;
}

function describeConnectionError(error: unknown): string {
	const message = error instanceof Error ? error.message : '';
	if (/\b401\b|\b403\b|unauthori[sz]ed|forbidden/i.test(message)) {
		return 'The MCP server rejected the credentials. Check the access token.';
	}
	if (/abort|timeout|timed out/i.test(message)) return 'The MCP server did not respond in time.';
	if (/redirect/i.test(message))
		return 'The MCP server responded with a redirect, which is not allowed.';
	return 'Could not connect to the MCP server. Check the address, transport, and token.';
}

export class HomeAssistantGateway {
	#definitions: ListToolsResult | undefined;
	#closed = false;

	constructor(
		private readonly client: GatewayClient,
		private readonly timeoutMs: number
	) {}

	private async definitions(): Promise<ListToolsResult> {
		this.#definitions ??= await this.client.listTools({ options: { timeout: this.timeoutMs } });
		return this.#definitions;
	}

	async discover(): Promise<DiscoveryResult> {
		const { tools } = await this.definitions();
		const info = this.client.serverInfo as { name?: string; version?: string } | undefined;
		return {
			serverName: info?.name,
			serverVersion: info?.version,
			tools: tools.map((tool) => ({
				name: tool.name,
				title: tool.title ?? tool.annotations?.title,
				description: tool.description?.slice(0, 300),
				kind: classifyToolName(tool.name)
			}))
		};
	}

	/** AI SDK tools for allowlisted MCP tools. Execution re-checks the policy for every call. */
	async createTools({ allowMutations }: { allowMutations: boolean }): Promise<ToolSet> {
		const definitions = await this.definitions();
		const isExposed = (name: string) => {
			const kind = classifyToolName(name);
			return kind === 'read' || (kind === 'mutation' && allowMutations);
		};
		const allowed = {
			...definitions,
			tools: definitions.tools.filter((tool) => isExposed(tool.name))
		};
		const mcpTools = this.client.toolsFromDefinitions(allowed);
		const tools: ToolSet = {};
		for (const [name, mcpTool] of Object.entries(mcpTools)) {
			tools[name] = {
				...mcpTool,
				execute: async (input: unknown, options: Parameters<typeof mcpTool.execute>[1]) => {
					const evaluation = evaluateToolCall(name, input);
					if (evaluation.kind === 'blocked') throw new McpGatewayError(evaluation.reason, 403);
					if (evaluation.kind === 'mutation' && !allowMutations) {
						throw new McpGatewayError('Device changes are disabled on this server.', 403);
					}
					return sanitizeToolResult(await mcpTool.execute(input, options));
				}
			} as Tool;
		}
		return tools;
	}

	async liveContext(): Promise<HomeState> {
		const { tools } = await this.definitions();
		const tool = tools.find((candidate) => baseToolName(candidate.name) === 'GetLiveContext');
		if (!tool) {
			throw new McpGatewayError(
				'The MCP server does not offer GetLiveContext. Enable the "Device control" tools in Home Assistant.',
				422
			);
		}
		const result = await this.client.callTool({
			name: tool.name,
			arguments: {},
			options: { timeout: this.timeoutMs }
		});
		if ('isError' in result && result.isError) {
			throw new McpGatewayError('Home Assistant could not provide the current state.', 502);
		}
		const text = extractLiveContextText('content' in result ? result.content : undefined);
		return {
			areas: groupByArea(parseLiveContext(text)),
			fetchedAt: new Date().toISOString()
		};
	}

	async close() {
		if (this.#closed) return;
		this.#closed = true;
		await this.client.close().catch(() => undefined);
	}
}

export async function connectHomeAssistant(
	request: McpConnectionRequest,
	options: GatewayOptions
): Promise<HomeAssistantGateway> {
	const url = await assertMcpUrlAllowed(request.url, options.policy, options.lookup);
	const createClient = options.createClient ?? createMCPClient;
	try {
		const client = await createClient({
			transport: {
				type: request.transport === 'sse' ? 'sse' : 'http',
				url: url.href,
				headers: request.token ? { Authorization: `Bearer ${request.token}` } : undefined,
				redirect: 'error',
				fetch: createPinnedFetch(url.origin)
			},
			clientName: 'home-agent',
			initializationOptions: { signal: options.signal, timeout: options.timeoutMs },
			onUncaughtError: () => undefined
		});
		return new HomeAssistantGateway(client, options.timeoutMs);
	} catch (error) {
		if (error instanceof McpGatewayError) throw error;
		throw new McpGatewayError(describeConnectionError(error));
	}
}
