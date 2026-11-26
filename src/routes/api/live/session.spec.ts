import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { MCP_TOKEN_HEADER, OPENAI_KEY_HEADER } from '$lib/config/headers';
import {
	FAKE_MCP_TOKEN,
	startFakeHaMcpServer,
	type FakeMcpServer
} from '$lib/server/mcp/fake-ha-mcp-server';
import { POST } from './session/+server';

vi.mock('$lib/server/env', () => ({
	getServerEnv: () => ({
		openaiApiKey: undefined,
		requestTimeoutMs: 1000,
		mcpUrlPolicy: { allowInsecureHttp: true, allowPrivateHosts: true },
		mcpTimeoutMs: 5000,
		allowMutations: true
	})
}));

const offer = 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
const sessionResponse = {
	session: { id: 'live_session_id' },
	transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' }
};

function request(body: unknown, apiKey = 'browser-test-key', mcpToken?: string) {
	const headers = new Headers({ 'Content-Type': 'application/json' });
	if (apiKey) headers.set(OPENAI_KEY_HEADER, apiKey);
	if (mcpToken) headers.set(MCP_TOKEN_HEADER, mcpToken);
	return {
		request: new Request('http://localhost/api/live/session', {
			method: 'POST',
			headers,
			body: JSON.stringify(body)
		}),
		locals: { requestId: 'live-test-request' }
	} as Parameters<typeof POST>[0];
}

describe('POST /api/live/session', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('returns only the validated session id and SDP answer', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => Response.json(sessionResponse));
		vi.stubGlobal('fetch', fetcher);

		const response = await POST(
			request({ sdp: offer, backendModel: 'gpt-6-astra', voice: 'gleam' })
		);

		expect(response.status).toBe(201);
		expect(await response.json()).toEqual(sessionResponse);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('authorization')).toBe(
			'Bearer browser-test-key'
		);
		const forwarded = JSON.parse(String(fetcher.mock.calls[0][1]?.body)) as {
			transport: { sdp: string };
		};
		expect(forwarded.transport.sdp).toBe(offer);
	});

	it('names the rejected setting to the browser and keeps the provider message in the log', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn<typeof fetch>(async () =>
				Response.json(
					{
						error: {
							code: 'model_not_found',
							param: 'session.delegation.responses.model',
							message: 'The model does not exist or you do not have access to it.'
						}
					},
					{ status: 400 }
				)
			)
		);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

		await expect(POST(request({ sdp: offer }))).rejects.toMatchObject({
			status: 502,
			body: {
				message:
					'OpenAI rejected the voice session settings (session.delegation.responses.model, model_not_found). Check the voice and backend model in Settings (request live-test-request).'
			}
		});
		expect(JSON.parse(String(warn.mock.calls[0][0]))).toMatchObject({
			event: 'live.session.failed',
			status: 400,
			providerCode: 'model_not_found',
			providerMessage: 'The model does not exist or you do not have access to it.',
			toolCount: 0
		});
		warn.mockRestore();
	});

	it('returns safe errors when OpenAI rejects the credential', async () => {
		const fetcher = vi.fn<typeof fetch>(
			async () => new Response('provider detail must not reach the browser', { status: 401 })
		);
		vi.stubGlobal('fetch', fetcher);

		await expect(POST(request({ sdp: offer }))).rejects.toMatchObject({
			status: 502,
			body: {
				message: 'OpenAI rejected the configured API key. Check your credentials in Settings.'
			}
		});
	});

	it('rejects invalid offers before contacting OpenAI', async () => {
		const fetcher = vi.fn<typeof fetch>();
		vi.stubGlobal('fetch', fetcher);

		await expect(POST(request({ sdp: 'not-an-offer' }))).rejects.toMatchObject({ status: 400 });
		expect(fetcher).not.toHaveBeenCalled();
	});

	describe('with a Home Assistant MCP connection', () => {
		let server: FakeMcpServer;
		beforeAll(async () => {
			server = await startFakeHaMcpServer();
		});
		afterAll(() => server.close());

		/** Answers OpenAI requests and lets the MCP connection reach the fake server. */
		function stubOpenAi() {
			const realFetch = globalThis.fetch;
			const openAiRequests: string[] = [];
			vi.stubGlobal('fetch', ((input, init) => {
				if (!String(input).startsWith('https://api.openai.com/')) return realFetch(input, init);
				openAiRequests.push(String(init?.body));
				return Promise.resolve(Response.json(sessionResponse));
			}) satisfies typeof fetch);
			return openAiRequests;
		}

		const backend = (body: string) =>
			(
				JSON.parse(body) as {
					session: {
						delegation: {
							responses: {
								instructions: string;
								tools?: { type: string; name: string }[];
								parallel_tool_calls?: boolean;
							};
						};
					};
				}
			).session.delegation.responses;

		it('registers only allowlisted tools as functions and keeps the MCP token out of the request', async () => {
			const openAiRequests = stubOpenAi();

			const response = await POST(
				request({ sdp: offer, mcp: { url: server.url } }, 'browser-test-key', FAKE_MCP_TOKEN)
			);

			expect(response.status).toBe(201);
			expect(backend(openAiRequests[0])).toMatchObject({
				tools: [
					{ type: 'function', name: 'GetLiveContext' },
					{ type: 'function', name: 'HassTurnOn' }
				],
				parallel_tool_calls: false
			});
			expect(openAiRequests[0]).not.toContain(FAKE_MCP_TOKEN);
			expect(openAiRequests[0]).not.toContain(server.url);
		});

		it('starts without tools and tells the backend when Home Assistant is unreachable', async () => {
			const openAiRequests = stubOpenAi();

			const response = await POST(
				request({ sdp: offer, mcp: { url: server.url } }, 'browser-test-key', 'wrong-token')
			);

			expect(response.status).toBe(201);
			const { tools, instructions } = backend(openAiRequests[0]);
			expect(tools).toBeUndefined();
			expect(instructions).toContain('Home Assistant is currently unreachable');
		});
	});
});
