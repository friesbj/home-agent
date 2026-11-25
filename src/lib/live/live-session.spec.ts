import { afterEach, describe, expect, it, vi } from 'vitest';
import type { VoiceStageState } from '$lib/components/VoiceStage.svelte';
import type { LiveTranscriptTurn } from './events';
import { LiveSessionController, waitForIceGathering, type LiveRuntime } from './live-session';
import type { LiveToolResponse } from './protocol';

class MockPeerConnection extends EventTarget {
	iceGatheringState: RTCIceGatheringState = 'gathering';

	finishGathering() {
		this.iceGatheringState = 'complete';
		this.dispatchEvent(new Event('icegatheringstatechange'));
	}
}

afterEach(() => {
	vi.useRealTimers();
});

describe('waitForIceGathering', () => {
	it('resolves immediately when gathering has already completed', async () => {
		const peer = new MockPeerConnection();
		peer.iceGatheringState = 'complete';

		await expect(waitForIceGathering(peer, new AbortController().signal)).resolves.toBeUndefined();
	});

	it('waits for the complete ICE candidate set before resolving', async () => {
		const peer = new MockPeerConnection();
		const result = waitForIceGathering(peer, new AbortController().signal, 1000);

		peer.finishGathering();
		await expect(result).resolves.toBeUndefined();
	});

	it('rejects if ICE gathering times out or the session is cancelled', async () => {
		vi.useFakeTimers();
		const peer = new MockPeerConnection();
		const timedOut = waitForIceGathering(peer, new AbortController().signal, 50);
		const timeoutExpectation = expect(timedOut).rejects.toThrow(
			'Timed out while gathering network candidates.'
		);
		await vi.advanceTimersByTimeAsync(50);
		await timeoutExpectation;

		const abortController = new AbortController();
		const cancelled = waitForIceGathering(peer, abortController.signal, 1000);
		const cancellationExpectation = expect(cancelled).rejects.toThrow(
			'WebRTC setup was cancelled.'
		);
		abortController.abort();
		await cancellationExpectation;
	});
});

type ToolRequestBody = {
	sessionId: string;
	callId: string;
	name: string;
	arguments: string;
	mcp: { url: string; transport: string };
	approval?: { token: string; approved: boolean };
};

interface SetupOptions {
	getUserMedia?: LiveRuntime['getUserMedia'];
	permission?: PermissionState | 'unknown';
	/** Answer of the session endpoint when it should fail. */
	sessionFailure?: () => Response;
	onTranscript?: (turns: LiveTranscriptTurn[]) => void;
	tool?: (body: ToolRequestBody) => LiveToolResponse | Promise<LiveToolResponse>;
}

const SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111';

describe('LiveSessionController', () => {
	function setup(options: SetupOptions = {}) {
		const track = { enabled: true, stop: vi.fn() } as unknown as MediaStreamTrack;
		const stream = {
			getAudioTracks: () => [track],
			getTracks: () => [track]
		} as unknown as MediaStream;
		let sampleValue = 128;
		const send = vi.fn<(data: string) => void>();
		const channel = {
			readyState: 'open',
			onmessage: null,
			onerror: null,
			onclose: null,
			send,
			close: vi.fn()
		} as unknown as RTCDataChannel;
		const peerMock = {
			iceGatheringState: 'complete',
			localDescription: { type: 'offer', sdp: SDP },
			connectionState: 'connected',
			createDataChannel: vi.fn(() => channel),
			addTrack: vi.fn(),
			createOffer: vi.fn(async () => ({ type: 'offer' as const, sdp: SDP })),
			setLocalDescription: vi.fn(async () => {}),
			setRemoteDescription: vi.fn(async () => {}),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			close: vi.fn(),
			ontrack: null as ((event: Pick<RTCTrackEvent, 'streams' | 'track'>) => void) | null,
			onconnectionstatechange: null as RTCPeerConnection['onconnectionstatechange']
		};
		const peer = peerMock as unknown as RTCPeerConnection;
		const analyser = {
			fftSize: 512,
			// 128 is silence, as in the 8-bit scale the levels in these tests are written in.
			getFloatTimeDomainData: vi.fn<(samples: Float32Array) => void>((samples) =>
				samples.fill((sampleValue - 128) / 128)
			),
			connect: vi.fn(),
			disconnect: vi.fn()
		} as unknown as AnalyserNode;
		const source = {
			connect: vi.fn(),
			disconnect: vi.fn()
		} as unknown as MediaStreamAudioSourceNode;
		const gain = {
			gain: { value: 1 },
			connect: vi.fn(),
			disconnect: vi.fn()
		} as unknown as GainNode;
		const audioContext = {
			state: 'running',
			destination: {},
			resume: vi.fn(async () => {}),
			createAnalyser: vi.fn(() => analyser),
			createMediaStreamSource: vi.fn(() => source),
			createGain: vi.fn(() => gain),
			close: vi.fn(async () => {})
		} as unknown as AudioContext;
		const visibilityTarget = Object.assign(new EventTarget(), { hidden: false });
		let frameCallback: FrameRequestCallback | undefined;
		const toolRequests: { body: ToolRequestBody; headers: Headers }[] = [];
		const fetcher = vi.fn<typeof fetch>(async (input, init) => {
			if (input === '/api/live/tool') {
				const body = JSON.parse(String(init?.body)) as ToolRequestBody;
				toolRequests.push({ body, headers: new Headers(init?.headers) });
				if (!options.tool) return new Response(null, { status: 500 });
				return Response.json(await options.tool(body));
			}
			if (options.sessionFailure) return options.sessionFailure();
			return Response.json({
				session: { id: 'live_test_id' },
				transport: { type: 'webrtc', sdp: SDP }
			});
		});
		const runtime: LiveRuntime = {
			getUserMedia: options.getUserMedia ?? vi.fn(async () => stream),
			queryMicrophonePermission: async () => options.permission ?? 'granted',
			createPeerConnection: () => peer,
			createAudioContext: () => audioContext,
			fetcher,
			requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
				frameCallback = callback;
				return 1;
			}),
			cancelAnimationFrame: vi.fn(),
			document: visibilityTarget as LiveRuntime['document']
		};
		const states: VoiceStageState[] = [];
		const onInterrupted = vi.fn();
		const controller = new LiveSessionController({
			onState: (state) => states.push(state),
			getConfiguration: () => ({
				apiKey: 'browser-test-key',
				backendModel: 'gpt-6-astra',
				voice: 'marin',
				mcp: {
					url: 'https://ha.example.com/api/mcp',
					transport: 'streamable-http',
					token: 'mcp-test-token'
				}
			}),
			onTranscript: options.onTranscript,
			onInterrupted,
			runtime
		});
		const audio = { srcObject: null, play: vi.fn(async () => {}) } as unknown as HTMLAudioElement;
		const emit = (event: Record<string, unknown>) =>
			channel.onmessage?.(new MessageEvent('message', { data: JSON.stringify(event) }));

		return {
			controller,
			states,
			track,
			peer,
			peerMock,
			fetcher,
			audio,
			audioContext,
			stream,
			toolRequests,
			onInterrupted,
			emit,
			/** Client events sent on the data channel, in order. */
			sent: () => send.mock.calls.map(([data]) => JSON.parse(data) as Record<string, unknown>),
			async connect() {
				const starting = controller.start(audio);
				await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());
				emit({ type: 'session.started' });
				await starting;
			},
			/** Emits a nested Responses event of the delegated backend response. */
			backend(event: Record<string, unknown>) {
				emit({ type: 'response.event', delegation_id: 'delegation_1', event });
			},
			functionCall(callId: string, name: string, args: Record<string, unknown>) {
				this.backend({
					type: 'response.output_item.done',
					item: { type: 'function_call', call_id: callId, name, arguments: JSON.stringify(args) }
				});
			},
			setSampleValue(value: number) {
				sampleValue = value;
			},
			runAudioFrame(time = 0) {
				const callback = frameCallback;
				frameCallback = undefined;
				callback?.(time);
			},
			setHidden(hidden: boolean) {
				visibilityTarget.hidden = hidden;
				visibilityTarget.dispatchEvent(new Event('visibilitychange'));
			}
		};
	}

	it('posts the gathered offer to the same-origin server and waits for session.started', async () => {
		const { controller, states, peer, peerMock, fetcher, audio, emit } = setup();
		const starting = controller.start(audio);
		await vi.waitFor(() => expect(peer.setRemoteDescription).toHaveBeenCalledOnce());

		// The provider's reference flow adds the microphone before creating the event channel.
		expect(peerMock.addTrack.mock.invocationCallOrder[0]).toBeLessThan(
			peerMock.createDataChannel.mock.invocationCallOrder[0]
		);

		const [url, init] = fetcher.mock.calls[0];
		expect(url).toBe('/api/live/session');
		expect(JSON.parse(String(init?.body))).toEqual({
			sdp: SDP,
			backendModel: 'gpt-6-astra',
			voice: 'marin',
			mcp: { url: 'https://ha.example.com/api/mcp', transport: 'streamable-http' }
		});
		const headers = new Headers(init?.headers);
		expect(headers.get('x-openai-api-key')).toBe('browser-test-key');
		expect(headers.get('x-mcp-token')).toBe('mcp-test-token');
		expect(states.at(-1)).toMatchObject({ kind: 'connecting', microphoneOn: true });

		emit({ type: 'session.started' });
		await starting;
		expect(states.at(-1)).toMatchObject({ kind: 'connected', listening: true });
	});

	it('mutes the outgoing microphone track and closes cleanly after session.closed', async () => {
		const onTranscript = vi.fn<(turns: LiveTranscriptTurn[]) => void>();
		const context = setup({ onTranscript });
		const { controller, states, track, peer, audio, emit } = context;
		await context.connect();
		emit({
			type: 'session.input_transcript.delta',
			start_ms: 1000,
			end_ms: 1200,
			delta: 'Turn on the light.'
		});
		emit({
			type: 'session.output_transcript.delta',
			start_ms: 1100,
			end_ms: 1300,
			delta: 'The light is on.'
		});

		controller.toggleMicrophone();
		expect(track.enabled).toBe(false);
		expect(states.at(-1)).toMatchObject({ kind: 'connected', microphoneOn: false });
		controller.toggleMicrophone();
		expect(track.enabled).toBe(true);

		const ending = controller.end();
		expect(context.sent()).toEqual([{ type: 'session.close' }]);
		// The microphone stops immediately, not only once the server confirms the shutdown.
		expect(track.enabled).toBe(false);
		expect(states.at(-1)).toMatchObject({ kind: 'connected', microphoneOn: false, closing: true });
		controller.toggleMicrophone();
		expect(track.enabled).toBe(false);

		emit({ type: 'session.closed', reason: 'close_requested' });
		await ending;
		expect(track.stop).toHaveBeenCalledOnce();
		expect(peer.close).toHaveBeenCalledOnce();
		expect(audio.srcObject).toBeNull();
		expect(states.at(-1)).toEqual({ kind: 'ready' });
		expect(onTranscript).toHaveBeenCalledOnce();
		expect(onTranscript).toHaveBeenCalledWith([
			{ role: 'user', startMs: 1000, endMs: 1200, text: 'Turn on the light.' },
			{ role: 'assistant', startMs: 1100, endMs: 1300, text: 'The light is on.' }
		]);
	});

	it('shares one shutdown between repeated end requests', async () => {
		vi.useFakeTimers();
		const context = setup();
		await context.connect();

		const first = context.controller.end();
		const second = context.controller.end();
		context.emit({ type: 'session.closed' });
		await Promise.all([first, second]);
		expect(context.sent()).toEqual([{ type: 'session.close' }]);

		// No leftover shutdown timer may tear down a later session.
		await vi.advanceTimersByTimeAsync(20_000);
		expect(context.states.at(-1)).toEqual({ kind: 'ready' });
		expect(context.peer.close).toHaveBeenCalledOnce();
	});

	it('opens on the screen that fits the microphone permission', async () => {
		const prepared = async (permission: PermissionState | 'unknown') => {
			const { controller, states } = setup({ permission });
			return { canStart: await controller.prepare(), state: states.at(-1) };
		};

		expect(await prepared('granted')).toEqual({ canStart: true, state: { kind: 'ready' } });
		expect(await prepared('prompt')).toEqual({
			canStart: false,
			state: { kind: 'needs-microphone', blocked: false }
		});
		expect(await prepared('unknown')).toEqual({
			canStart: false,
			state: { kind: 'needs-microphone', blocked: false }
		});
		expect(await prepared('denied')).toEqual({
			canStart: false,
			state: { kind: 'needs-microphone', blocked: true }
		});
	});

	it('tells a refused microphone from a dismissed prompt without creating a peer connection', async () => {
		const denied = Object.assign(new Error('permission denied'), { name: 'NotAllowedError' });
		const refuse = (permission: PermissionState) =>
			setup({ permission, getUserMedia: vi.fn(async () => Promise.reject(denied)) });

		const blocked = refuse('denied');
		await blocked.controller.start(blocked.audio);
		expect(blocked.states.at(-1)).toEqual({ kind: 'needs-microphone', blocked: true });
		expect(blocked.peer.createDataChannel).not.toHaveBeenCalled();
		expect(blocked.audioContext.close).toHaveBeenCalledOnce();

		const dismissed = refuse('prompt');
		await dismissed.controller.start(dismissed.audio);
		expect(dismissed.states.at(-1)).toEqual({ kind: 'needs-microphone', blocked: false });
	});

	it('names a failed start differently from a lost connection', async () => {
		const context = setup({
			sessionFailure: () =>
				Response.json({ message: 'No OpenAI API key is configured.' }, { status: 400 })
		});

		await context.controller.start(context.audio);

		expect(context.states.at(-1)).toEqual({
			kind: 'error',
			title: 'Could not connect',
			message: 'No OpenAI API key is configured.'
		});
		expect(context.track.stop).toHaveBeenCalledOnce();
	});

	it('stops a microphone stream that resolves after startup was cancelled', async () => {
		let resolveStream!: (stream: MediaStream) => void;
		const getUserMedia = vi.fn(
			() =>
				new Promise<MediaStream>((resolve) => {
					resolveStream = resolve;
				})
		);
		const { controller, track, stream, peer, audio } = setup({ getUserMedia });

		const starting = controller.start(audio);
		await vi.waitFor(() => expect(getUserMedia).toHaveBeenCalledOnce());
		expect(getUserMedia).toHaveBeenCalledWith({
			audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
		});
		await controller.end();
		resolveStream(stream);
		await starting;

		expect(track.stop).toHaveBeenCalledOnce();
		expect(peer.createDataChannel).not.toHaveBeenCalled();
	});

	it('keeps the session open on error events and ends it on session.closed', async () => {
		const context = setup();
		await context.connect();

		context.emit({
			type: 'error',
			error: { type: 'invalid_request_error', code: 'responses_validation_failed' }
		});
		expect(context.states.at(-1)).toMatchObject({
			kind: 'connected',
			notice:
				'The assistant reported a problem (responses_validation_failed). The last request may be incomplete.'
		});
		expect(context.peer.close).not.toHaveBeenCalled();

		context.emit({ type: 'session.closed', reason: 'expired' });
		expect(context.states.at(-1)).toEqual({
			kind: 'error',
			message: 'The session reached its time limit. Start a new conversation to continue.'
		});
		expect(context.peer.close).toHaveBeenCalledOnce();
	});

	it('surfaces transcript persistence failures after an otherwise clean close', async () => {
		const context = setup({
			onTranscript: () => {
				throw new Error('local storage failure details');
			}
		});
		await context.connect();
		context.emit({
			type: 'session.input_transcript.delta',
			start_ms: 1000,
			end_ms: 1500,
			delta: 'Is the door locked?'
		});

		const ending = context.controller.end();
		context.emit({ type: 'session.closed' });
		await ending;

		expect(context.states.at(-1)).toEqual({
			kind: 'error',
			message: 'The voice transcript could not be added to chat history.'
		});
	});

	it('follows the output level without flickering during speech pauses', async () => {
		const context = setup();
		const { peerMock, setSampleValue, runAudioFrame } = context;
		const speaking = () => {
			const state = context.states.at(-1);
			return state?.kind === 'connected' && state.speaking;
		};
		await context.connect();

		peerMock.ontrack?.({ streams: [{} as MediaStream], track: {} as MediaStreamTrack });
		setSampleValue(132);
		runAudioFrame(0);
		expect(speaking()).toBe(true);

		// A quieter level keeps an ongoing utterance alive but would not have started one.
		setSampleValue(130);
		runAudioFrame(100);
		expect(speaking()).toBe(true);

		// Silence between words: the state holds, and ends only after the pause lasted.
		setSampleValue(128);
		runAudioFrame(200);
		runAudioFrame(899);
		expect(speaking()).toBe(true);
		runAudioFrame(900);
		expect(speaking()).toBe(false);

		setSampleValue(130);
		runAudioFrame(1000);
		expect(speaking()).toBe(false);
	});

	it('exposes a smoothed audio level for the orb driven by real sound', async () => {
		const context = setup();
		const { peerMock, setSampleValue, runAudioFrame, controller } = context;
		await context.connect();
		peerMock.ontrack?.({ streams: [{} as MediaStream], track: {} as MediaStreamTrack });

		expect(controller.audioLevel).toBe(0);
		setSampleValue(160);
		for (let t = 0; t < 12; t++) runAudioFrame(t * 16);
		const peak = controller.audioLevel;
		expect(peak).toBeGreaterThan(0);

		setSampleValue(128);
		for (let t = 12; t < 80; t++) runAudioFrame(t * 16);
		expect(controller.audioLevel).toBeLessThan(peak);
	});

	it('hints at a silent microphone until sound was measured once', async () => {
		const context = setup();
		const notice = () => {
			const state = context.states.at(-1);
			return state?.kind === 'connected' ? state.notice : 'not connected';
		};
		await context.connect();

		context.runAudioFrame(0);
		context.runAudioFrame(7_999);
		expect(notice()).toBeUndefined();
		context.runAudioFrame(8_000);
		expect(notice()).toContain('Little or no sound is arriving from your microphone.');

		context.setSampleValue(140);
		context.runAudioFrame(8_100);
		expect(notice()).toBeUndefined();

		// A pause later in the conversation is not a microphone problem.
		context.setSampleValue(128);
		context.runAudioFrame(60_000);
		expect(notice()).toBeUndefined();
	});

	it('keeps the conversation running when the output level meter is unavailable', async () => {
		const context = setup();
		vi.mocked(context.audioContext.createAnalyser).mockImplementation(() => {
			throw new Error('unsupported');
		});
		await context.connect();

		context.peerMock.ontrack?.({ streams: [{} as MediaStream], track: {} as MediaStreamTrack });

		expect(context.states.at(-1)).toMatchObject({ kind: 'connected', speaking: false });
		expect(context.audio.play).toHaveBeenCalledOnce();
		expect(context.peer.close).not.toHaveBeenCalled();
	});

	it('ends a connected session after the tab remains hidden for 60 seconds', async () => {
		vi.useFakeTimers();
		const context = setup();
		await context.connect();

		context.setHidden(true);
		await vi.advanceTimersByTimeAsync(59_000);
		expect(context.sent()).toEqual([]);
		await vi.advanceTimersByTimeAsync(1000);
		expect(context.sent()).toEqual([{ type: 'session.close' }]);
		context.emit({ type: 'session.closed' });
		await vi.waitFor(() => expect(context.states.at(-1)).toEqual({ kind: 'ready' }));
	});

	it('retains transcript turns when the server does not confirm shutdown', async () => {
		vi.useFakeTimers();
		const onTranscript = vi.fn<(turns: LiveTranscriptTurn[]) => void>();
		const context = setup({ onTranscript });
		await context.connect();
		context.emit({
			type: 'session.input_transcript.delta',
			start_ms: 1000,
			end_ms: 1500,
			delta: 'Is the door locked?'
		});

		const ending = context.controller.end();
		await vi.advanceTimersByTimeAsync(15_000);
		await ending;

		expect(context.states.at(-1)).toEqual({
			kind: 'error',
			message: 'The server did not confirm session shutdown.'
		});
		expect(onTranscript).toHaveBeenCalledWith([
			{ role: 'user', startMs: 1000, endMs: 1500, text: 'Is the door locked?' }
		]);
	});

	it('runs a delegated read through the server and continues the backend response', async () => {
		const context = setup({
			tool: () => ({ status: 'completed', outcome: 'executed', output: 'Kitchen Light: on' })
		});
		await context.connect();

		context.functionCall('call_1', 'GetLiveContext', {});
		expect(context.states.at(-1)).toMatchObject({
			thinking: true,
			activity: { kind: 'read', target: 'Home status' }
		});
		context.backend({ type: 'response.completed' });

		await vi.waitFor(() => expect(context.sent()).toHaveLength(2));
		expect(context.sent()).toEqual([
			{
				type: 'response.item.create',
				event_id: expect.any(String),
				item: { type: 'function_call_output', call_id: 'call_1', output: 'Kitchen Light: on' }
			},
			{ type: 'response.create', event_id: expect.any(String) }
		]);
		const [{ body, headers }] = context.toolRequests;
		expect(body).toEqual({
			sessionId: 'live_test_id',
			callId: 'call_1',
			name: 'GetLiveContext',
			arguments: '{}',
			mcp: { url: 'https://ha.example.com/api/mcp', transport: 'streamable-http' }
		});
		expect(headers.get('x-mcp-token')).toBe('mcp-test-token');
		expect(context.states.at(-1)).toMatchObject({ thinking: false, activity: undefined });
	});

	it('holds a change until the user approves the server-issued confirmation', async () => {
		const context = setup({
			tool: (body) =>
				body.approval
					? { status: 'completed', outcome: 'executed', output: 'Done.' }
					: {
							status: 'confirmation-required',
							confirmation: {
								token: 'signed-token',
								summary: 'Turn on / activate: name "Kitchen Light" (light)',
								targets: ['Kitchen Light'],
								expiresAt: 1
							}
						}
		});
		await context.connect();

		context.functionCall('call_1', 'HassTurnOn', { name: 'Kitchen Light', domain: ['light'] });
		context.backend({ type: 'response.completed' });
		await vi.waitFor(() =>
			expect(context.states.at(-1)).toMatchObject({
				thinking: true,
				confirmation: {
					summary: 'Turn on / activate: name "Kitchen Light" (light)',
					targets: ['Kitchen Light']
				}
			})
		);
		// Only the spoken announcement was sent; the backend has no result yet.
		expect(context.sent()).toEqual([
			expect.objectContaining({ type: 'session.commentary.append', delegation_id: null })
		]);

		context.controller.respondToConfirmation(true);
		await vi.waitFor(() => expect(context.sent()).toHaveLength(3));
		expect(context.toolRequests[1].body.approval).toEqual({
			token: 'signed-token',
			approved: true
		});
		expect(context.sent().slice(1)).toEqual([
			expect.objectContaining({
				type: 'response.item.create',
				item: { type: 'function_call_output', call_id: 'call_1', output: 'Done.' }
			}),
			expect.objectContaining({ type: 'response.create' })
		]);
		expect(context.states.at(-1)).toMatchObject({ confirmation: undefined });
		expect(context.onInterrupted).not.toHaveBeenCalled();
	});

	it('abandons a pending confirmation when the session ends and reports the interruption', async () => {
		const context = setup({
			tool: () => ({
				status: 'confirmation-required',
				confirmation: { token: 'signed-token', summary: 'Turn on', targets: [], expiresAt: 1 }
			})
		});
		await context.connect();
		context.functionCall('call_1', 'HassTurnOn', { name: 'Kitchen Light', domain: ['light'] });
		await vi.waitFor(() =>
			expect(context.states.at(-1)).toMatchObject({ confirmation: { summary: 'Turn on' } })
		);

		const ending = context.controller.end();
		expect(context.states.at(-1)).toMatchObject({ closing: true, confirmation: undefined });
		context.controller.respondToConfirmation(true);
		context.emit({ type: 'session.closed' });
		await ending;

		expect(context.onInterrupted).toHaveBeenCalledOnce();
		expect(context.toolRequests).toHaveLength(1);
		expect(context.sent().map((event) => event.type)).toEqual([
			'session.commentary.append',
			'session.close'
		]);
	});
});
