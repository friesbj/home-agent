import * as ort from 'onnxruntime-web/wasm';
import { Silero } from '@ricky0123/vad-web/dist/models/silero';
import modelUrl from '@ricky0123/vad-web/dist/silero_vad_v5.onnx?url';
import workletUrl from '@ricky0123/vad-web/dist/vad.worklet.bundle.min.js?url&no-inline';
import wasmUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm?url';
import wasmModuleUrl from '../../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.mjs?url';

const SPEECH_THRESHOLD = 0.3;
const FRAME_TIMEOUT_MS = 5_000;

export interface VoiceActivityMonitor {
	dispose(): Promise<void>;
}

/**
 * Detects speech locally from the existing microphone. Audio frames are discarded after
 * inference; unlike the package's segment collector, this never accumulates an utterance.
 */
export async function createVoiceActivityMonitor(
	stream: MediaStream,
	context: AudioContext,
	onSpeech: () => void,
	onFailure: () => void
): Promise<VoiceActivityMonitor> {
	ort.env.wasm.numThreads = 1;
	ort.env.wasm.wasmPaths = {
		mjs: new URL(wasmModuleUrl, window.location.href).href,
		wasm: new URL(wasmUrl, window.location.href).href
	};
	const model = await Silero.new(ort, async () => {
		const response = await fetch(modelUrl);
		if (!response.ok) throw new Error('Could not load local speech detection model.');
		return response.arrayBuffer();
	});

	let source: MediaStreamAudioSourceNode | undefined;
	let worklet: AudioWorkletNode | undefined;
	let sink: GainNode | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let stopped = false;
	let inference: Promise<void> | undefined;
	const fail = () => {
		if (stopped) return;
		stopped = true;
		if (timer) clearTimeout(timer);
		onFailure();
	};
	try {
		await context.audioWorklet.addModule(workletUrl);
		source = context.createMediaStreamSource(stream);
		worklet = new AudioWorkletNode(context, 'vad-helper-worklet', {
			processorOptions: { frameSamples: 512 }
		});
		sink = context.createGain();
		sink.gain.value = 0;
		source.connect(worklet);
		worklet.connect(sink);
		sink.connect(context.destination);
		const checkFrames = () => {
			if (timer) clearTimeout(timer);
			timer = setTimeout(() => {
				if (document.hidden || !stream.getAudioTracks().some((track) => track.enabled))
					checkFrames();
				else fail();
			}, FRAME_TIMEOUT_MS);
		};
		worklet.onprocessorerror = fail;
		worklet.port.onmessage = ({ data }: MessageEvent<unknown>) => {
			if (
				stopped ||
				inference ||
				typeof data !== 'object' ||
				data === null ||
				!('message' in data) ||
				data.message !== 'AUDIO_FRAME' ||
				!('data' in data) ||
				!(data.data instanceof ArrayBuffer)
			)
				return;
			inference = model
				.process(new Float32Array(data.data))
				.then(({ isSpeech }) => {
					if (stopped) return;
					checkFrames();
					if (isSpeech >= SPEECH_THRESHOLD) onSpeech();
				})
				.catch(fail)
				.finally(() => {
					inference = undefined;
				});
		};
		checkFrames();
	} catch (error) {
		source?.disconnect();
		worklet?.disconnect();
		sink?.disconnect();
		await model.release();
		throw error;
	}

	return {
		async dispose() {
			stopped = true;
			if (timer) clearTimeout(timer);
			if (worklet) {
				worklet.port.onmessage = null;
				worklet.onprocessorerror = null;
				worklet.port.postMessage('SPEECH_STOP');
				worklet.disconnect();
			}
			source?.disconnect();
			sink?.disconnect();
			await inference;
			await model.release();
		}
	};
}
