import { MCP_TOKEN_HEADER, OPENAI_KEY_HEADER } from '$lib/config/headers';
import type { ConfirmationPolicy } from '$lib/config/settings';
import type { McpTarget } from '$lib/home/api';
import { audioRms } from './audio-level';
import {
	parseLiveServerEvent,
	readBackendEvent,
	reduceLiveTranscript,
	initialLiveTranscriptState,
	type LiveFunctionCall,
	type LiveTranscriptTurn
} from './events';
import {
	liveSessionResponseSchema,
	liveToolResponseSchema,
	type LiveToolResponse
} from './protocol';
import { LiveToolCoordinator, type LiveToolApproval, type LiveToolCard } from './tool-calls';
import type { VoiceStageState } from '$lib/components/VoiceStage.svelte';
import type { VoiceActivityMonitor } from './voice-activity';

const STARTUP_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 15_000;
const HIDDEN_SESSION_TIMEOUT_MS = 60_000;
const IDLE_SPEECH_TIMEOUT_MS = 60_000;
const VOICE_MONITOR_STARTUP_TIMEOUT_MS = 15_000;
const TOOL_TIMEOUT_MS = 60_000;
const MICROPHONE_SOUND_LEVEL = 0.01;
const MICROPHONE_QUIET_MS = 8_000;
const SPEAKING_START_LEVEL = 0.025;
const SPEAKING_STAY_LEVEL = 0.012;
/** Audio RMS treated as a full-strength orb pulse; speech peaks well above this. */
const ORB_LEVEL_FULL = 0.25;
const ORB_LEVEL_SMOOTHING = 0.25;
/** Speech pauses between words and sentences; the Speaking state must not flicker with them. */
const SPEAKING_HOLD_MS = 800;
const DEBUG_INTERVAL_MS = 3_000;
const TRANSCRIPT_NOT_SAVED = 'The voice transcript could not be added to chat history.';
const OUTPUT_MONITOR_UNAVAILABLE =
	'Assistant audio activity could not be monitored. The conversation may end while audio is playing.';
const SPEECH_MONITOR_UNAVAILABLE =
	'Local speech detection is unavailable. The inactivity timeout is disabled; use End to finish the conversation.';
const SPEECH_MONITOR_LOADING =
	'Loading local speech detection. The inactivity timeout starts when it is ready.';
const MICROPHONE_QUIET =
	'Little or no sound is arriving from your microphone. Check the input device and its level in your browser and system settings.';

export interface LiveConfiguration {
	apiKey?: string;
	backendModel: string;
	voice: string;
	input?: { role: 'user' | 'assistant'; text: string }[];
	/** Home Assistant MCP connection for delegated tools; without it the session has no tools. */
	mcp?: McpTarget | null;
	confirmation?: ConfirmationPolicy;
}

export interface LiveRuntime {
	getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
	createPeerConnection: () => RTCPeerConnection;
	createAudioContext: () => AudioContext;
	createVoiceActivityMonitor: (
		stream: MediaStream,
		context: AudioContext,
		onSpeech: () => void,
		onFailure: () => void
	) => Promise<VoiceActivityMonitor>;
	fetcher: typeof fetch;
	requestAnimationFrame: typeof requestAnimationFrame;
	cancelAnimationFrame: typeof cancelAnimationFrame;
	document: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'>;
	/** The microphone permission, or `unknown` where the browser cannot report it. */
	queryMicrophonePermission: () => Promise<PermissionState | 'unknown'>;
	/** Development diagnostics: event types and transport statistics, never transcript text. */
	debug?: (message: string, detail?: unknown) => void;
}

interface LevelMeter {
	level: () => number;
	dispose: () => void;
}

export interface LiveSessionOptions {
	onState: (state: VoiceStageState) => void;
	getConfiguration: () => LiveConfiguration;
	onAutoEnd?: (reason: 'idle' | 'hidden' | 'expired') => void;
	onToolCards?: (cards: LiveToolCard[]) => void;
	/** Receives the session's transcript turns as they grow and once more at shutdown. */
	onTranscript?: (turns: LiveTranscriptTurn[]) => void;
	/** Called when a session ends while a device change was running or awaiting confirmation. */
	onInterrupted?: () => void;
	runtime?: LiveRuntime;
}

function browserRuntime(): LiveRuntime {
	return {
		getUserMedia: (constraints) => {
			if (!navigator.mediaDevices?.getUserMedia) {
				throw new Error('This browser cannot access a microphone.');
			}
			return navigator.mediaDevices.getUserMedia(constraints);
		},
		createPeerConnection: () => new RTCPeerConnection(),
		createAudioContext: () => new AudioContext(),
		createVoiceActivityMonitor: async (...args) => {
			const { createVoiceActivityMonitor } = await import('./voice-activity');
			return createVoiceActivityMonitor(...args);
		},
		// Window functions throw "Illegal invocation" when called as methods of another object.
		fetcher: (input, init) => fetch(input, init),
		requestAnimationFrame: (callback) => requestAnimationFrame(callback),
		cancelAnimationFrame: (handle) => cancelAnimationFrame(handle),
		document,
		queryMicrophonePermission: async () => {
			try {
				const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
				return status.state;
			} catch {
				return 'unknown';
			}
		},
		debug: import.meta.env.DEV
			? (message, detail) => console.debug('[live]', message, detail ?? '')
			: undefined
	};
}

export function waitForIceGathering(
	peer: Pick<RTCPeerConnection, 'iceGatheringState' | 'addEventListener' | 'removeEventListener'>,
	signal: AbortSignal,
	timeoutMs = STARTUP_TIMEOUT_MS
): Promise<void> {
	if (signal.aborted) return Promise.reject(new Error('WebRTC setup was cancelled.'));
	if (peer.iceGatheringState === 'complete') return Promise.resolve();

	return new Promise((resolve, reject) => {
		const finish = (error?: Error) => {
			clearTimeout(timeout);
			peer.removeEventListener('icegatheringstatechange', onStateChange);
			signal.removeEventListener('abort', onAbort);
			if (error) reject(error);
			else resolve();
		};
		const onStateChange = () => {
			if (peer.iceGatheringState === 'complete') finish();
		};
		const onAbort = () => finish(new Error('WebRTC setup was cancelled.'));
		const timeout = setTimeout(
			() => finish(new Error('Timed out while gathering network candidates.')),
			timeoutMs
		);

		peer.addEventListener('icegatheringstatechange', onStateChange);
		signal.addEventListener('abort', onAbort, { once: true });
		onStateChange();
	});
}

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : 'Could not start a Live conversation.';
}

async function getEndpointError(response: Response): Promise<string> {
	try {
		const payload: unknown = await response.json();
		if (typeof payload === 'object' && payload !== null) {
			const body = payload as Record<string, unknown>;
			if (typeof body.message === 'string') return body.message;
			if (typeof body.error === 'string') return body.error;
		}
	} catch {
		return 'Could not start a Live conversation.';
	}
	return 'Could not start a Live conversation.';
}

function closedMessage(reason: unknown): string {
	if (reason === 'expired') {
		return 'The session reached its time limit. Start a new conversation to continue.';
	}
	if (reason === 'content') return 'The session was ended by a safety filter.';
	return 'The Live session ended unexpectedly.';
}

/** The negotiated media sections without addresses, ICE credentials, or fingerprints. */
function describeMedia(sdp: string): string[] {
	return sdp
		.split(/\r?\n/)
		.filter((line) =>
			/^(m=|a=(mid|rtpmap|sendrecv|sendonly|recvonly|inactive|bundle-only)\b)/.test(line)
		);
}

export class LiveSessionController {
	#runtime?: LiveRuntime;
	#onState: LiveSessionOptions['onState'];
	#onTranscript: LiveSessionOptions['onTranscript'];
	#onInterrupted: LiveSessionOptions['onInterrupted'];
	#onAutoEnd: LiveSessionOptions['onAutoEnd'];
	#onToolCards: LiveSessionOptions['onToolCards'];
	#getConfiguration: LiveSessionOptions['getConfiguration'];
	#state: VoiceStageState = { kind: 'needs-microphone' };
	#peer?: RTCPeerConnection;
	#channel?: RTCDataChannel;
	#stream?: MediaStream;
	#audio?: HTMLAudioElement;
	#audioContext?: AudioContext;
	#outputMeter?: LevelMeter;
	#inputMeter?: LevelMeter;
	#voiceMonitor?: VoiceActivityMonitor;
	#voiceMonitorState: 'loading' | 'ready' | 'failed' = 'loading';
	#voiceMonitorTimer?: ReturnType<typeof setTimeout>;
	#meterFrame?: number;
	#abort?: AbortController;
	#closeTimer?: ReturnType<typeof setTimeout>;
	#hiddenTimer?: ReturnType<typeof setTimeout>;
	#idleTimer?: ReturnType<typeof setTimeout>;
	#lastIdleActivity = 0;
	#statsTimer?: ReturnType<typeof setInterval>;
	#visibilityHandler?: () => void;
	#resolveStarted?: () => void;
	#resolveClosed?: () => void;
	#endPromise?: Promise<void>;
	#tools?: LiveToolCoordinator;
	#sessionId?: string;
	#notice?: string;
	#generation = 0;
	#connected = false;
	#ending = false;
	#transcriptSaved = false;
	#transcriptSaveFailed = false;
	#microphoneOn = true;
	#speaking = false;
	#outputMonitorUnavailable = false;
	/** Sound was measured on the microphone at least once in this session. */
	#microphoneHeard = false;
	#microphoneQuiet = false;
	#quietSince?: number;
	#outputSoundAt?: number;
	#inputPeak = 0;
	/** Smoothed activity level (0..1) that drives the orb; the loud side of the conversation. */
	#level = 0;
	#transcript = initialLiveTranscriptState;
	#transcriptSessionId = '';

	constructor(options: LiveSessionOptions) {
		this.#onState = options.onState;
		this.#onTranscript = options.onTranscript;
		this.#onInterrupted = options.onInterrupted;
		this.#onAutoEnd = options.onAutoEnd;
		this.#onToolCards = options.onToolCards;
		this.#getConfiguration = options.getConfiguration;
		this.#runtime = options.runtime;
	}

	get #browser(): LiveRuntime {
		return (this.#runtime ??= browserRuntime());
	}

	/** Smoothed audio activity level (0..1) for the orb; 0 when no sound is flowing. */
	get audioLevel(): number {
		return this.#level;
	}

	/**
	 * Shows the screen that fits the microphone permission before a conversation: ready, the
	 * first-use setup, or the blocked notice. Returns whether a conversation can start unprompted.
	 */
	async prepare(): Promise<boolean> {
		if (this.#endPromise) await this.#endPromise;
		const idle = () => this.#state.kind !== 'connecting' && !this.#connected;
		if (!idle()) return false;
		const permission = await this.#browser.queryMicrophonePermission();
		if (!idle()) return false;
		if (permission === 'granted') {
			return true;
		}
		this.#setState({ kind: 'needs-microphone', blocked: permission === 'denied' });
		return false;
	}

	async start(audio: HTMLAudioElement) {
		if (this.#state.kind === 'connecting' || this.#connected) return;
		const generation = ++this.#generation;
		this.#transcriptSessionId = crypto.randomUUID();
		this.#transcript = initialLiveTranscriptState;
		this.#transcriptSaved = false;
		this.#transcriptSaveFailed = false;
		this.#microphoneOn = true;
		this.#speaking = false;
		this.#ending = false;
		this.#notice = undefined;
		this.#setState({ kind: 'connecting', microphoneOn: false });

		let stream: MediaStream;
		try {
			this.#audioContext = this.#browser.createAudioContext();
			void this.#audioContext.resume().catch(() => {
				if (generation === this.#generation) {
					this.#fail('Audio output is unavailable. Check your browser audio settings and retry.');
				}
			});
			// Requested explicitly: browsers differ in which processing `audio: true` turns on, and a
			// quiet microphone without gain control may stay below the provider's speech detection.
			stream = await this.#browser.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
			});
		} catch (error) {
			if (generation !== this.#generation) return;
			this.#releaseResources();
			const released = this.#generation;
			const name = error instanceof Error ? error.name : '';
			if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
				// A dismissed prompt can be asked again; anything else needs the browser's settings.
				const permission = await this.#browser.queryMicrophonePermission();
				if (released !== this.#generation) return;
				this.#setState({ kind: 'needs-microphone', blocked: permission !== 'prompt' });
			} else {
				this.#setState({
					kind: 'error',
					title: 'Could not connect',
					message:
						name === 'NotFoundError'
							? 'No microphone was found. Connect one and try again.'
							: getErrorMessage(error)
				});
			}
			return;
		}

		// Startup was cancelled while the permission prompt was open.
		if (generation !== this.#generation) {
			stream.getTracks().forEach((track) => track.stop());
			return;
		}

		this.#stream = stream;
		this.#setState({ kind: 'connecting', microphoneOn: true });
		this.#audio = audio;
		this.#startMeter('input', stream);
		void this.#startVoiceMonitor(stream, this.#audioContext, generation);
		this.#abort = new AbortController();
		const signal = AbortSignal.any([this.#abort.signal, AbortSignal.timeout(STARTUP_TIMEOUT_MS)]);

		try {
			const configuration = this.#getConfiguration();
			const peer = this.#browser.createPeerConnection();
			this.#peer = peer;
			// As in the provider's reference flow: microphone tracks first, then the event channel.
			for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
			const channel = peer.createDataChannel('oai-events');
			this.#channel = channel;

			let resolveStarted!: () => void;
			const started = new Promise<void>((resolve) => {
				resolveStarted = resolve;
			});
			this.#resolveStarted = resolveStarted;

			channel.onmessage = ({ data }) => this.#handleMessage(data);
			// While closing, the provider tears the channel down itself; only `session.closed` counts.
			channel.onerror = () => {
				if (!this.#ending) this.#fail('The Live event channel encountered an error.');
			};
			channel.onclose = () => {
				if (!this.#ending) {
					this.#fail('The Live event channel closed unexpectedly.');
				}
			};
			peer.ontrack = ({ streams, track }) => {
				const output = this.#audio;
				if (!output) return;
				const remoteStream = streams[0] ?? new MediaStream([track]);
				output.srcObject = remoteStream;
				this.#startMeter('output', remoteStream);
				const playbackGeneration = this.#generation;
				void output.play().catch(() => {
					if (playbackGeneration === this.#generation) {
						this.#fail(
							'Audio playback was blocked by the browser. Check audio settings and retry.'
						);
					}
				});
			};
			peer.onconnectionstatechange = () => {
				if (
					(peer.connectionState === 'failed' || peer.connectionState === 'closed') &&
					!this.#ending
				) {
					this.#fail('The WebRTC connection was lost.');
				}
			};

			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);
			await waitForIceGathering(peer, signal);
			if (signal.aborted) throw new Error('Live connection setup timed out.');

			const sdp = peer.localDescription?.sdp;
			if (!sdp) throw new Error('The browser did not create an SDP offer.');

			const { mcp } = configuration;
			const headers = new Headers({ 'Content-Type': 'application/json' });
			if (configuration.apiKey) headers.set(OPENAI_KEY_HEADER, configuration.apiKey);
			if (mcp?.token) headers.set(MCP_TOKEN_HEADER, mcp.token);
			const response = await this.#browser.fetcher('/api/live/session', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					sdp,
					backendModel: configuration.backendModel,
					voice: configuration.voice,
					input: configuration.input ?? [],
					mcp: mcp ? { url: mcp.url, transport: mcp.transport } : undefined
				}),
				signal
			});
			if (!response.ok) throw new Error(await getEndpointError(response));

			const payload: unknown = await response.json();
			const parsed = liveSessionResponseSchema.safeParse(payload);
			if (!parsed.success) throw new Error('The server returned an invalid Live session answer.');

			this.#sessionId = parsed.data.session.id;
			this.#browser.debug?.('offer media', describeMedia(sdp));
			this.#browser.debug?.('answer media', describeMedia(parsed.data.transport.sdp));
			this.#tools = new LiveToolCoordinator({
				send: (event) => this.#send(event),
				execute: (call, approval, toolSignal) => this.#executeTool(call, approval, toolSignal),
				onChange: () => {
					this.#syncIdleTimer();
					if (this.#connected) this.#publishConnected();
					this.#onToolCards?.(this.#tools?.cards ?? []);
				}
			});

			await peer.setRemoteDescription({ type: 'answer', sdp: parsed.data.transport.sdp });
			let onAbort!: () => void;
			const aborted = new Promise<never>((_, reject) => {
				onAbort = () => reject(new Error('Live connection setup timed out.'));
				if (signal.aborted) onAbort();
				else signal.addEventListener('abort', onAbort, { once: true });
			});
			try {
				await Promise.race([started, aborted]);
			} finally {
				signal.removeEventListener('abort', onAbort);
			}
			if (generation !== this.#generation) return;
			this.#watchTabVisibility();
			this.#debugTransport(peer);
		} catch (error) {
			if (generation !== this.#generation) return;
			if (this.#state.kind === 'error' || this.#state.kind === 'needs-microphone') return;
			const message = signal.aborted
				? 'Connection timed out. Check your network and try again.'
				: getErrorMessage(error);
			this.#fail(message);
		}
	}

	toggleMicrophone() {
		const track = this.#stream?.getAudioTracks()[0];
		if (!track || !this.#connected || this.#ending) return;
		track.enabled = !track.enabled;
		this.#microphoneOn = track.enabled;
		this.#publishConnected();
	}

	async #startVoiceMonitor(stream: MediaStream, context: AudioContext, generation: number) {
		const fail = () => {
			if (generation !== this.#generation) return;
			this.#voiceMonitorState = 'failed';
			this.#syncIdleTimer();
			if (this.#connected) this.#publishConnected();
		};
		this.#voiceMonitorTimer = setTimeout(fail, VOICE_MONITOR_STARTUP_TIMEOUT_MS);
		try {
			const monitor = await this.#browser.createVoiceActivityMonitor(
				stream,
				context,
				() => {
					if (
						generation === this.#generation &&
						this.#connected &&
						this.#microphoneOn &&
						!this.#ending
					) {
						this.#touchIdleTimer();
					}
				},
				fail
			);
			if (generation !== this.#generation || this.#voiceMonitorState === 'failed') {
				await monitor.dispose();
				return;
			}
			this.#voiceMonitor = monitor;
			this.#voiceMonitorState = 'ready';
			this.#syncIdleTimer();
			if (this.#connected) this.#publishConnected();
		} catch {
			fail();
		} finally {
			if (generation === this.#generation && this.#voiceMonitorTimer) {
				clearTimeout(this.#voiceMonitorTimer);
				this.#voiceMonitorTimer = undefined;
			}
		}
	}

	/** Answers the confirmation that is currently shown on the stage. */
	respondToConfirmation(approved: boolean) {
		if (this.#connected && !this.#ending) {
			this.#tools?.respond(approved);
			this.#touchIdleTimer();
		}
	}

	/** Ends the session. Repeated calls while it is closing share the same shutdown. */
	end(): Promise<void> {
		this.#endPromise ??= this.#end().finally(() => {
			this.#endPromise = undefined;
		});
		return this.#endPromise;
	}

	/** Releases the microphone immediately while provider shutdown continues in the background. */
	leave() {
		for (const track of this.#stream?.getTracks() ?? []) {
			track.enabled = false;
			track.stop();
		}
		this.#microphoneOn = false;
		this.#stream = undefined;
		if (this.#connected) this.#publishConnected();
	}

	async #end() {
		if (!this.#connected) {
			this.#abort?.abort();
			this.#releaseResources();
			this.#setState({ kind: 'needs-microphone' });
			return;
		}
		if (!this.#channel || this.#channel.readyState !== 'open') {
			const message = this.#saveTranscript()
				? 'The session ended before shutdown could be confirmed.'
				: TRANSCRIPT_NOT_SAVED;
			this.#releaseResources();
			this.#setState({ kind: 'error', message });
			return;
		}

		// A response waiting for a tool result cannot continue once closing starts.
		this.#ending = true;
		this.#cancelTools();
		for (const track of this.#stream?.getAudioTracks() ?? []) {
			track.enabled = false;
		}
		this.#microphoneOn = false;
		this.#publishConnected();

		const closed = new Promise<void>((resolve) => {
			this.#resolveClosed = resolve;
		});
		try {
			this.#channel.send(JSON.stringify({ type: 'session.close' }));
			await Promise.race([
				closed,
				new Promise<never>((_, reject) => {
					this.#closeTimer = setTimeout(
						() => reject(new Error('The server did not confirm session shutdown.')),
						CLOSE_TIMEOUT_MS
					);
				})
			]);
			const transcriptSaved = this.#saveTranscript();
			this.#releaseResources();
			this.#setState(
				transcriptSaved
					? { kind: 'needs-microphone' }
					: { kind: 'error', message: TRANSCRIPT_NOT_SAVED }
			);
		} catch (error) {
			const message = this.#saveTranscript() ? getErrorMessage(error) : TRANSCRIPT_NOT_SAVED;
			this.#releaseResources();
			this.#setState({ kind: 'error', message });
		}
	}

	#handleMessage(data: unknown) {
		let event;
		try {
			event = parseLiveServerEvent(data);
		} catch {
			this.#fail('The Live session sent an invalid event.');
			return;
		}

		const nested = event.type === 'response.event' ? event.event : undefined;
		this.#browser.debug?.(
			'event',
			nested && typeof nested === 'object' && 'type' in nested
				? `response.event/${String(nested.type)}`
				: event.type
		);

		if (event.type === 'session.started') {
			this.#connected = true;
			this.#resolveStarted?.();
			this.#touchIdleTimer();
			this.#publishConnected();
			return;
		}
		if (event.type === 'session.closed') {
			this.#resolveClosed?.();
			if (!this.#ending && event.reason === 'expired') {
				if (!this.#saveTranscript()) {
					this.#fail(TRANSCRIPT_NOT_SAVED);
					return;
				}
				this.#releaseResources();
				this.#setState({ kind: 'needs-microphone' });
				this.#onAutoEnd?.('expired');
			} else if (!this.#ending) this.#fail(closedMessage(event.reason));
			return;
		}
		if (event.type === 'error') {
			// Rejected commands and moderation notices leave the session open; `session.closed` ends it.
			this.#browser.debug?.('error event', event.error);
			const code =
				typeof event.error === 'object' && event.error !== null && 'code' in event.error
					? event.error.code
					: undefined;
			this.#notice = `The assistant reported a problem${
				typeof code === 'string' && /^[\w.-]{1,80}$/.test(code) ? ` (${code})` : ''
			}. The last request may be incomplete.`;
			if (this.#connected) this.#publishConnected();
			return;
		}

		if (event.type === 'session.input_transcript.delta') this.#notice = undefined;
		this.#transcript = reduceLiveTranscript(this.#transcript, event);
		if (
			event.type === 'session.input_transcript.delta' ||
			event.type === 'session.output_transcript.delta'
		) {
			this.#touchIdleTimer();
			try {
				this.#publishTranscriptTurns();
			} catch {
				// Live fragments must not break event handling. Shutdown still reports persistence failure.
				this.#transcriptSaveFailed = true;
			}
		}
		const backendEvent = readBackendEvent(event);
		if (backendEvent && !this.#ending) this.#tools?.handle(backendEvent);
		this.#syncIdleTimer();
		if (this.#connected) this.#publishConnected();
	}

	#publishConnected() {
		this.#setState({
			kind: 'connected',
			microphoneOn: this.#microphoneOn,
			listening: this.#microphoneOn,
			speaking: this.#speaking,
			thinking: this.#transcript.thinking || (this.#tools?.busy ?? false),
			heardText: this.#transcript.heardText,
			spokenText: this.#transcript.spokenText,
			activity: this.#tools?.activity,
			confirmation: this.#tools?.confirmation,
			notice:
				(this.#voiceMonitorState === 'failed'
					? SPEECH_MONITOR_UNAVAILABLE
					: this.#voiceMonitorState === 'loading'
						? SPEECH_MONITOR_LOADING
						: undefined) ??
				this.#notice ??
				(this.#outputMonitorUnavailable
					? OUTPUT_MONITOR_UNAVAILABLE
					: this.#microphoneQuiet
						? MICROPHONE_QUIET
						: undefined),
			closing: this.#ending
		});
	}

	#touchIdleTimer() {
		this.#lastIdleActivity = Date.now();
		this.#syncIdleTimer();
	}

	#syncIdleTimer() {
		if (
			!this.#connected ||
			this.#ending ||
			this.#voiceMonitorState !== 'ready' ||
			this.#browser.document.hidden ||
			this.#transcript.thinking ||
			this.#tools?.busy
		) {
			if (this.#idleTimer) clearTimeout(this.#idleTimer);
			this.#idleTimer = undefined;
			return;
		}
		if (this.#idleTimer) return;
		this.#lastIdleActivity = Date.now();
		this.#scheduleIdleTimer(IDLE_SPEECH_TIMEOUT_MS);
	}

	#scheduleIdleTimer(delay: number) {
		this.#idleTimer = setTimeout(() => {
			this.#idleTimer = undefined;
			const remaining = IDLE_SPEECH_TIMEOUT_MS - (Date.now() - this.#lastIdleActivity);
			if (remaining > 0) this.#scheduleIdleTimer(remaining);
			else this.#autoEnd('idle');
		}, delay);
	}

	#autoEnd(reason: 'idle' | 'hidden') {
		this.leave();
		void this.end();
		this.#onAutoEnd?.(reason);
	}

	#send(event: Record<string, unknown>) {
		if (this.#channel?.readyState !== 'open') return;
		try {
			this.#channel.send(JSON.stringify(event));
		} catch {
			// The channel is closing; its close handler reports the failure.
		}
	}

	async #executeTool(
		call: LiveFunctionCall,
		approval: LiveToolApproval | undefined,
		signal: AbortSignal
	): Promise<LiveToolResponse> {
		const { mcp, confirmation } = this.#getConfiguration();
		if (!mcp || !this.#sessionId) {
			return {
				status: 'completed',
				outcome: 'failed',
				output: 'No Home Assistant connection is configured.'
			};
		}
		const headers = new Headers({ 'Content-Type': 'application/json' });
		if (mcp.token) headers.set(MCP_TOKEN_HEADER, mcp.token);
		const response = await this.#browser.fetcher('/api/live/tool', {
			method: 'POST',
			headers,
			body: JSON.stringify({
				sessionId: this.#sessionId,
				callId: call.callId,
				name: call.name,
				arguments: call.arguments,
				mcp: { url: mcp.url, transport: mcp.transport },
				confirmation,
				approval
			}),
			signal: AbortSignal.any([signal, AbortSignal.timeout(TOOL_TIMEOUT_MS)])
		});
		if (!response.ok) throw new Error('The tool request failed.');
		return liveToolResponseSchema.parse(await response.json());
	}

	#cancelTools() {
		const interrupted = this.#tools?.cancel() ?? false;
		this.#tools = undefined;
		if (interrupted) this.#onInterrupted?.();
	}

	#watchTabVisibility() {
		this.#visibilityHandler = () => {
			if (this.#hiddenTimer) clearTimeout(this.#hiddenTimer);
			this.#hiddenTimer = this.#browser.document.hidden
				? setTimeout(() => {
						this.#autoEnd('hidden');
					}, HIDDEN_SESSION_TIMEOUT_MS)
				: undefined;
			this.#syncIdleTimer();
		};
		this.#browser.document.addEventListener('visibilitychange', this.#visibilityHandler);
		this.#visibilityHandler();
	}

	#fail(message: string) {
		this.#abort?.abort();
		const finalMessage = this.#saveTranscript() ? message : TRANSCRIPT_NOT_SAVED;
		const beforeConnected = !this.#connected;
		this.#releaseResources();
		this.#setState({
			kind: 'error',
			message: finalMessage,
			...(beforeConnected ? { title: 'Could not connect' } : {})
		});
	}

	#saveTranscript() {
		if (!this.#connected) return true;
		if (this.#transcriptSaved) return !this.#transcriptSaveFailed;
		this.#transcriptSaved = true;
		try {
			this.#publishTranscriptTurns();
			return true;
		} catch {
			this.#transcriptSaveFailed = true;
			return false;
		}
	}

	#publishTranscriptTurns() {
		const turns = this.#transcript.turns
			.filter((turn) => turn.text.trim().length > 0)
			.sort((left, right) => (left.startMs ?? 0) - (right.startMs ?? 0))
			.map((turn) => ({ ...turn, id: `${this.#transcriptSessionId}:${turn.id}` }));
		if (turns.length) this.#onTranscript?.(turns);
	}

	#createMeter(stream: MediaStream): LevelMeter {
		const context = this.#audioContext;
		if (!context) throw new Error('Audio level monitoring is unavailable.');
		const source = context.createMediaStreamSource(stream);
		const analyser = context.createAnalyser();
		const sink = context.createGain();
		// Measured only: the silent sink keeps the graph running without playing the stream.
		sink.gain.value = 0;
		analyser.fftSize = 512;
		source.connect(analyser);
		analyser.connect(sink);
		sink.connect(context.destination);
		const samples = new Float32Array(analyser.fftSize);
		return {
			level: () => {
				// Float samples: 8-bit data rounds a quiet microphone to silence.
				analyser.getFloatTimeDomainData(samples);
				return audioRms(samples);
			},
			dispose: () => {
				source.disconnect();
				analyser.disconnect();
				sink.disconnect();
			}
		};
	}

	#startMeter(kind: 'input' | 'output', stream: MediaStream) {
		try {
			if (kind === 'input') this.#inputMeter ??= this.#createMeter(stream);
			else this.#outputMeter ??= this.#createMeter(stream);
		} catch {
			if (kind === 'output') {
				this.#outputMonitorUnavailable = true;
				if (this.#connected) this.#publishConnected();
			}
			return;
		}
		this.#meterFrame ??= this.#browser.requestAnimationFrame(this.#measure);
	}

	#measure = (time: number) => {
		let changed = false;
		const outputLevel = this.#outputMeter?.level() ?? 0;
		if (this.#outputMeter) {
			if (outputLevel >= (this.#speaking ? SPEAKING_STAY_LEVEL : SPEAKING_START_LEVEL)) {
				this.#outputSoundAt = time;
				if (this.#connected && !this.#ending) this.#touchIdleTimer();
			}
			const speaking =
				this.#outputSoundAt !== undefined && time - this.#outputSoundAt < SPEAKING_HOLD_MS;
			if (speaking !== this.#speaking) {
				this.#speaking = speaking;
				changed = true;
			}
		}
		const inputLevel = this.#inputMeter?.level() ?? 0;
		this.#inputPeak = Math.max(this.#inputPeak, inputLevel);
		// The orb follows whichever side is making sound, so it reacts to real audio.
		const active = this.#speaking ? outputLevel : this.#microphoneOn ? inputLevel : 0;
		this.#level += (Math.min(1, active / ORB_LEVEL_FULL) - this.#level) * ORB_LEVEL_SMOOTHING;
		// Until sound was measured once, tell the user when the microphone delivers none.
		if (this.#inputMeter && this.#connected && !this.#microphoneHeard) {
			let quiet = false;
			if (!this.#microphoneOn) {
				this.#quietSince = undefined;
			} else if (inputLevel >= MICROPHONE_SOUND_LEVEL) {
				this.#microphoneHeard = true;
			} else {
				this.#quietSince ??= time;
				quiet = time - this.#quietSince >= MICROPHONE_QUIET_MS;
			}
			if (quiet !== this.#microphoneQuiet) {
				this.#microphoneQuiet = quiet;
				changed = true;
			}
		}
		if (changed && this.#connected) this.#publishConnected();
		this.#meterFrame = this.#browser.requestAnimationFrame(this.#measure);
	};

	/**
	 * Development aid: every few seconds, the loudest microphone level since the last report and
	 * how much audio left the browser. The level is the reliable reading: speech peaks well above
	 * 0.02, while the byte rate barely differs between speech and silence in some browsers.
	 */
	#debugTransport(peer: RTCPeerConnection) {
		const debug = this.#browser.debug;
		if (!debug) return;
		let sentBytes = 0;
		this.#statsTimer = setInterval(() => {
			const track = this.#stream?.getAudioTracks()[0];
			const microphonePeak = Number(this.#inputPeak.toFixed(4));
			this.#inputPeak = 0;
			void peer
				.getStats()
				.then((stats) => {
					let bytes: number | undefined;
					stats.forEach((report: Record<string, unknown>) => {
						if (report.kind === 'audio' && report.type === 'outbound-rtp') {
							bytes = Number(report.bytesSent);
						}
					});
					debug('audio', {
						microphonePeak: this.#inputMeter ? microphonePeak : 'no meter',
						microphone: track
							? `${track.readyState}${track.enabled ? '' : ', off'}${track.muted ? ', muted' : ''}`
							: 'none',
						sentBytesPerSecond:
							bytes === undefined
								? 'unknown'
								: Math.round((bytes - sentBytes) / (DEBUG_INTERVAL_MS / 1000))
					});
					if (bytes !== undefined) sentBytes = bytes;
				})
				.catch(() => undefined);
		}, DEBUG_INTERVAL_MS);
	}

	#releaseResources() {
		this.#cancelTools();
		if (this.#closeTimer) clearTimeout(this.#closeTimer);
		if (this.#hiddenTimer) clearTimeout(this.#hiddenTimer);
		if (this.#idleTimer) clearTimeout(this.#idleTimer);
		if (this.#voiceMonitorTimer) clearTimeout(this.#voiceMonitorTimer);
		if (this.#statsTimer) clearInterval(this.#statsTimer);
		if (this.#visibilityHandler) {
			this.#browser.document.removeEventListener('visibilitychange', this.#visibilityHandler);
		}
		if (this.#meterFrame !== undefined) this.#browser.cancelAnimationFrame(this.#meterFrame);
		this.#outputMeter?.dispose();
		this.#inputMeter?.dispose();
		if (this.#voiceMonitor) {
			void this.#voiceMonitor.dispose().catch(() => {
				this.#browser.debug?.('Could not release local speech detection.');
			});
		}
		if (this.#audioContext && this.#audioContext.state !== 'closed') {
			const closeGeneration = this.#generation + 1;
			void this.#audioContext.close().catch(() => {
				if (this.#generation === closeGeneration && this.#state.kind === 'needs-microphone') {
					this.#setState({ kind: 'error', message: 'Could not release the audio monitor.' });
				}
			});
		}

		if (this.#channel) {
			this.#channel.onmessage = null;
			this.#channel.onclose = null;
			this.#channel.onerror = null;
			if (this.#channel.readyState !== 'closed') this.#channel.close();
		}
		if (this.#peer) {
			this.#peer.ontrack = null;
			this.#peer.onconnectionstatechange = null;
			this.#peer.close();
		}
		this.#stream?.getTracks().forEach((track) => track.stop());
		if (this.#audio) this.#audio.srcObject = null;

		this.#channel = undefined;
		this.#peer = undefined;
		this.#stream = undefined;
		this.#audio = undefined;
		this.#audioContext = undefined;
		this.#outputMeter = undefined;
		this.#inputMeter = undefined;
		this.#voiceMonitor = undefined;
		this.#voiceMonitorState = 'loading';
		this.#voiceMonitorTimer = undefined;
		this.#meterFrame = undefined;
		this.#statsTimer = undefined;
		this.#microphoneHeard = false;
		this.#microphoneQuiet = false;
		this.#quietSince = undefined;
		this.#outputSoundAt = undefined;
		this.#outputMonitorUnavailable = false;
		this.#inputPeak = 0;
		this.#level = 0;
		this.#abort = undefined;
		this.#visibilityHandler = undefined;
		this.#hiddenTimer = undefined;
		this.#idleTimer = undefined;
		this.#lastIdleActivity = 0;
		this.#closeTimer = undefined;
		this.#sessionId = undefined;
		this.#notice = undefined;
		this.#transcript = initialLiveTranscriptState;
		this.#connected = false;
		this.#ending = false;
		this.#speaking = false;
		this.#generation += 1;
		this.#resolveStarted = undefined;
		this.#resolveClosed = undefined;
	}

	#setState(state: VoiceStageState) {
		this.#state = state;
		this.#onState(state);
	}
}
