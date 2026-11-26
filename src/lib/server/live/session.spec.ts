import { describe, expect, it, vi } from 'vitest';
import { liveSessionRequestSchema, LiveSessionError, provisionLiveSession } from './session';

const result = {
	session: { id: 'live_opaque_session_id' },
	transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' }
};

describe('provisionLiveSession', () => {
	it('accepts only bounded SDP offers and keeps them byte for byte', () => {
		const offer = 'v=0\r\ns=-\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n';
		// A trimmed offer loses its final line ending, which SDP requires.
		expect(liveSessionRequestSchema.parse({ sdp: offer }).sdp).toBe(offer);
		expect(liveSessionRequestSchema.safeParse({ sdp: 'not an SDP offer' }).success).toBe(false);
		expect(
			liveSessionRequestSchema.safeParse({ sdp: `v=0\r\n${'x'.repeat(64_000)}` }).success
		).toBe(false);
	});

	it('bounds session input by message count and character count', () => {
		const base = {
			sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
			input: [{ role: 'user', text: 'Hello' }]
		};
		expect(liveSessionRequestSchema.parse(base).input).toEqual(base.input);
		expect(
			liveSessionRequestSchema.safeParse({
				...base,
				input: Array.from({ length: 129 }, () => ({ role: 'user', text: 'Hello' }))
			}).success
		).toBe(false);
		expect(
			liveSessionRequestSchema.safeParse({
				...base,
				input: [
					{ role: 'user', text: 'x'.repeat(4096) },
					{ role: 'assistant', text: 'y'.repeat(4096) },
					{ role: 'user', text: 'z' }
				]
			}).success
		).toBe(false);
	});

	it('reports why the provider rejected a request, except for credential errors', async () => {
		const rejected = (status: number) =>
			provisionLiveSession({
				apiKey: 'test-key',
				sdp: 'offer',
				backendModel: 'gpt-6-astra',
				voice: 'gleam',
				timeoutMs: 1000,
				fetcher: async () =>
					Response.json(
						{
							error: {
								type: 'invalid_request_error',
								code: 'invalid_value',
								param: 'session.audio.output.voice',
								message: 'Unsupported voice. Key sk-proj-abcdefgh12345678 was used.',
								internal: 'not copied'
							}
						},
						{ status }
					)
			}).catch((error: unknown) => error);

		expect(await rejected(400)).toMatchObject({
			status: 400,
			rejection: {
				type: 'invalid_request_error',
				code: 'invalid_value',
				param: 'session.audio.output.voice',
				message: 'Unsupported voice. Key [redacted] was used.'
			}
		});
		expect(await rejected(401)).toMatchObject({ status: 401, rejection: undefined });
	});

	it('keeps API credentials on the server and configures separate Live and Responses models', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => Response.json(result));
		const created = await provisionLiveSession({
			apiKey: 'server-only-test-key',
			sdp: 'v=0\r\noffer',
			backendModel: 'gpt-6-astra',
			voice: 'nuri',
			input: [
				{ role: 'user', text: 'Turn on the kitchen light.' },
				{ role: 'assistant', text: 'The kitchen light is on.' }
			],
			timeoutMs: 1000,
			fetcher
		});

		expect(created).toEqual(result);
		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('https://api.openai.com/v1/live/sessions');
		expect(new Headers(init?.headers).get('authorization')).toBe('Bearer server-only-test-key');
		const body = JSON.parse(String(init?.body)) as {
			session: {
				model: string;
				audio: { output: { voice: string } };
				input: { type: string; role: string; content: unknown[] }[];
				delegation: { type: string; responses: { model: string } };
			};
			transport: { type: string; sdp: string };
		};
		expect(body.session).toMatchObject({
			model: 'gpt-live-1.1',
			audio: { output: { voice: 'nuri' } },
			input: [
				{
					type: 'message',
					role: 'user',
					content: [{ type: 'input_text', text: 'Turn on the kitchen light.' }]
				},
				{
					type: 'message',
					role: 'assistant',
					content: [{ type: 'output_text', text: 'The kitchen light is on.' }]
				}
			],
			delegation: { type: 'responses', responses: { model: 'gpt-6-astra' } }
		});
		expect(body.transport).toEqual({ type: 'webrtc', sdp: 'v=0\r\noffer' });
		expect(JSON.stringify(body)).not.toContain('server-only-test-key');
	});

	it('maps provider failures without returning their response body', async () => {
		const fetcher = vi.fn<typeof fetch>(
			async () => new Response('sensitive provider response', { status: 429 })
		);

		await expect(
			provisionLiveSession({
				apiKey: 'test-key',
				sdp: 'offer',
				backendModel: 'gpt-6-astra',
				voice: 'gleam',
				timeoutMs: 1000,
				fetcher
			})
		).rejects.toMatchObject({
			name: 'LiveSessionError',
			status: 429,
			message: 'OpenAI Live rejected the session request.'
		});
	});

	it('rejects malformed success payloads', async () => {
		const fetcher = vi.fn<typeof fetch>(async () => Response.json({ session: { id: 'live_id' } }));

		await expect(
			provisionLiveSession({
				apiKey: 'test-key',
				sdp: 'offer',
				backendModel: 'gpt-6-astra',
				voice: 'gleam',
				timeoutMs: 1000,
				fetcher
			})
		).rejects.toBeInstanceOf(LiveSessionError);
	});
});
