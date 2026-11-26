import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Voice mode against the real application server and the fake Home Assistant MCP server.
// Only OpenAI (the session endpoint) and the browser's microphone and WebRTC are faked.

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';
const TURN_ON_SUMMARY = 'Turn on / activate: name "Kitchen Light" (light)';
const INTERRUPTED = /A previous response or tool action was interrupted/;

type LiveEvent = Record<string, unknown>;

declare global {
	interface Window {
		__live: {
			sent: LiveEvent[];
			microphone?: MediaStreamTrack;
			emit: (event: LiveEvent) => void;
			setMicrophoneAudio: (audible: boolean) => void;
			setAssistantAudio: (audible: boolean) => void;
		};
	}
}

/**
 * Replaces the network peer; the data channel is driven by the test. The microphone and the
 * assistant's voice are real audio streams, so the browser's own audio pipeline runs.
 */
async function fakeMicrophoneAndWebRtc(page: Page) {
	await page.addInitScript(() => {
		type Listener = ((message: { data: string }) => void) | null;
		const channel = {
			readyState: 'open',
			onmessage: null as Listener,
			onerror: null,
			onclose: null,
			send(data: string) {
				const event = JSON.parse(data) as Record<string, unknown>;
				live.sent.push(event);
				if (event.type === 'session.close') {
					setTimeout(() => live.emit({ type: 'session.closed', reason: 'close_requested' }));
				}
			},
			close() {
				channel.readyState = 'closed';
			}
		};
		const live = {
			sent: [] as Record<string, unknown>[],
			microphone: undefined as MediaStreamTrack | undefined,
			emit: (event: Record<string, unknown>) =>
				channel.onmessage?.({ data: JSON.stringify(event) }),
			setMicrophoneAudio: (() => {}) as (audible: boolean) => void,
			setAssistantAudio: (() => {}) as (audible: boolean) => void
		};

		/** A real, initially silent audio stream whose tone the test can switch on. */
		function toneStream() {
			const context = new AudioContext();
			const tone = context.createOscillator();
			const volume = context.createGain();
			const destination = context.createMediaStreamDestination();
			volume.gain.value = 0;
			tone.connect(volume).connect(destination);
			tone.start();
			return {
				stream: destination.stream,
				setAudible: (audible: boolean) => {
					volume.gain.value = audible ? 1 : 0;
				}
			};
		}

		class FakePeerConnection extends EventTarget {
			iceGatheringState = 'complete';
			connectionState = 'connected';
			localDescription: unknown = null;
			ontrack: ((event: { streams: MediaStream[]; track: MediaStreamTrack }) => void) | null = null;
			onconnectionstatechange = null;
			createDataChannel() {
				channel.readyState = 'open';
				return channel;
			}
			addTrack() {}
			async createOffer() {
				return { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n' };
			}
			async setLocalDescription(description: unknown) {
				this.localDescription = description;
			}
			async setRemoteDescription() {
				setTimeout(() => {
					const assistant = toneStream();
					live.setAssistantAudio = assistant.setAudible;
					this.ontrack?.({
						streams: [assistant.stream],
						track: assistant.stream.getAudioTracks()[0]
					});
					live.emit({ type: 'session.started' });
				});
			}
			close() {}
		}

		Object.assign(window, { __live: live, RTCPeerConnection: FakePeerConnection });
		Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
			configurable: true,
			value: async () => {
				const microphone = toneStream();
				live.microphone = microphone.stream.getAudioTracks()[0];
				live.setMicrophoneAudio = microphone.setAudible;
				return microphone.stream;
			}
		});
	});
}

async function setup(page: Page) {
	const sessionRequests: { body: Record<string, unknown>; headers: Record<string, string> }[] = [];
	await fakeMicrophoneAndWebRtc(page);
	await page.route('**/api/live/session', (route) => {
		sessionRequests.push({
			body: route.request().postDataJSON(),
			headers: route.request().headers()
		});
		return route.fulfill({
			status: 201,
			json: { session: { id: 'live_e2e' }, transport: { type: 'webrtc', sdp: 'v=0\r\nanswer' } }
		});
	});

	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
	return sessionRequests;
}

const emit = (page: Page, event: LiveEvent) =>
	page.evaluate((liveEvent) => window.__live.emit(liveEvent), event);

/** Emits a nested Responses event of the delegated backend response. */
const backend = (page: Page, event: LiveEvent) =>
	emit(page, { type: 'response.event', delegation_id: 'delegation_1', event });

const functionCall = (page: Page, callId: string, name: string, args: object) =>
	backend(page, {
		type: 'response.output_item.done',
		item: { type: 'function_call', call_id: callId, name, arguments: JSON.stringify(args) }
	});

const sent = (page: Page) => page.evaluate(() => window.__live.sent);

async function toolOutput(page: Page, callId: string) {
	const item = (await sent(page))
		.map((event) => event.item as { call_id?: string; output?: string } | undefined)
		.find((candidate) => candidate?.call_id === callId);
	return item?.output;
}

async function audit(page: Page) {
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	return results.violations.map((violation) => `${violation.id}: ${violation.help}`);
}

/** Opens the stage from the Assistant header or, on a phone, from the navigation orb. */
async function openStage(page: Page) {
	const composer = page.locator('#start-voice');
	if (await composer.isVisible()) await composer.click();
	else await page.locator('#voice-orb').click();
	return page.getByRole('dialog', { name: 'Live conversation' });
}

test('voice runs a read and a confirmed change through the server and joins the chat', async ({
	page,
	context
}) => {
	// With the microphone already allowed, opening the stage connects without another step.
	await context.grantPermissions(['microphone']);
	const sessionRequests = await setup(page);
	const stage = await openStage(page);
	await expect(stage.getByRole('status')).toHaveText('Listening');
	await expect(stage.getByRole('button', { name: 'End', exact: true })).toBeFocused();
	await page.evaluate(() => window.__live.setMicrophoneAudio(true));

	expect(sessionRequests).toHaveLength(1);
	expect(sessionRequests[0].body.mcp).toEqual({ url: MCP_URL, transport: 'streamable-http' });
	expect(sessionRequests[0].headers['x-mcp-token']).toBe('e2e-mcp-token');
	expect(JSON.stringify(sessionRequests[0].body)).not.toContain('e2e-mcp-token');

	// The status follows the real level of the assistant's audio stream.
	await page.evaluate(() => window.__live.setAssistantAudio(true));
	await expect(stage.getByRole('status')).toHaveText('Speaking');
	await page.evaluate(() => window.__live.setAssistantAudio(false));
	await expect(stage.getByRole('status')).toHaveText('Listening');

	await emit(page, {
		type: 'session.input_transcript.delta',
		start_ms: 1000,
		end_ms: 2000,
		delta: 'Turn on the kitchen light.'
	});
	// Captions are off until the user asks for them.
	const caption = stage.getByText('Turn on the kitchen light.');
	await expect(caption).toBeHidden();
	await stage.getByRole('button', { name: 'Show captions' }).click();
	await expect(caption).toBeVisible();

	await emit(page, { type: 'session.delegation.created' });
	await expect(stage.getByRole('status')).toHaveText('Working on it…');
	await functionCall(page, 'call_read', 'GetLiveContext', {});
	await backend(page, { type: 'response.completed' });
	await expect.poll(() => toolOutput(page, 'call_read')).toContain('Kitchen Light');
	await expect.poll(async () => (await sent(page)).at(-1)?.type).toBe('response.create');

	await backend(page, { type: 'response.created' });
	await functionCall(page, 'call_change', 'HassTurnOn', {
		name: 'Kitchen Light',
		domain: ['light']
	});
	await backend(page, { type: 'response.completed' });
	const card = stage.getByRole('region', { name: 'Waiting for your confirmation' });
	await expect(card).toBeFocused();
	await expect(card.getByText(TURN_ON_SUMMARY)).toBeVisible();
	await expect(stage.getByRole('status')).toHaveText('Waiting for your confirmation');
	expect(await audit(page), 'voice stage with a pending confirmation').toEqual([]);
	// Nothing ran: the backend has no result, only the assistant was told to announce the wait.
	expect(await toolOutput(page, 'call_change')).toBeUndefined();
	expect((await sent(page)).at(-1)?.type).toBe('session.commentary.append');

	await card.getByRole('button', { name: 'Approve' }).click();
	await expect.poll(() => toolOutput(page, 'call_change')).toBe('{"success":true}');
	await expect.poll(async () => (await sent(page)).at(-1)?.type).toBe('response.create');
	await expect(card).toBeHidden();

	await emit(page, {
		type: 'session.output_transcript.delta',
		start_ms: 9000,
		end_ms: 10000,
		delta: 'The kitchen light is on.'
	});
	await stage.getByRole('button', { name: 'End', exact: true }).click();
	expect(await page.evaluate(() => window.__live.microphone?.readyState)).toBe('ended');
	await expect(stage).toBeHidden();
	await expect(page.locator('#start-voice')).toBeFocused();
	const chat = page.getByRole('region', { name: 'Chat' });
	await expect(chat.getByText('Turn on the kitchen light.', { exact: true })).toBeVisible();
	await expect(chat.getByText('The kitchen light is on.', { exact: true })).toBeVisible();
	// The voice turns are saved with the conversation, like typed messages.
	await expect(chat.getByLabel('Conversation')).toContainText('Turn on the kitchen light.');
	// Voice tool calls render as the same cards as text mode, not raw JSON.
	await expect(chat.getByText('HassTurnOn')).toBeVisible();
	await expect(chat.getByText('GetLiveContext')).toBeVisible();
	await expect(chat.getByText('Show result').first()).toBeVisible();
	await expect(chat.getByText(TURN_ON_SUMMARY, { exact: true })).toHaveCount(1);
	await expect(page.getByText(INTERRUPTED)).toBeHidden();
	const savedConversation = chat
		.getByLabel('Conversation')
		.locator('option', { hasText: 'Turn on the kitchen light.' });
	const savedId = await savedConversation.getAttribute('value');
	if (!savedId) throw new Error('Voice conversation was not saved.');
	await page.reload();
	await page.getByLabel('Conversation').selectOption(savedId);
	await expect(chat.getByText('Turn on the kitchen light.', { exact: true })).toBeVisible();
	await expect(chat.getByText('GetLiveContext')).toBeVisible();
	await expect(chat.getByText('HassTurnOn')).toBeVisible();
	await expect(chat.getByRole('button', { name: 'Approve' })).toHaveCount(0);
});

test('first use explains voice, and leaving abandons a pending confirmation', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await setup(page);

	// The microphone was never allowed: the stage opens on the setup screen instead of connecting.
	const stage = await openStage(page);
	await expect(stage.getByRole('status')).toHaveText('Microphone access needed');
	await expect(stage.getByText(/Voice\s+transcripts are stored unencrypted/)).toBeVisible();
	await expect(stage.getByText(/Gleam · Warm and conversational/)).toBeVisible();
	await expect(stage.getByRole('link', { name: 'Change in Settings' })).toBeVisible();
	const allow = stage.getByRole('button', { name: 'Allow microphone' });
	await expect(allow).toBeFocused();
	expect(await audit(page), 'first-use screen on a phone').toEqual([]);
	await allow.click();
	await expect(stage.getByRole('status')).toHaveText('Listening');
	expect(
		await page.evaluate(
			() =>
				document
					.getAnimations()
					.filter(
						(animation) => animation instanceof CSSAnimation && animation.playState === 'running'
					).length
		),
		'running animations with reduced motion'
	).toBe(0);

	// The microphone delivers silence: the stage says so, and stops once sound arrives.
	const hint = stage.getByText(/Little or no sound is arriving from your microphone/);
	await expect(hint).toBeVisible({ timeout: 15_000 });
	expect(await audit(page), 'voice stage with the microphone hint on a phone').toEqual([]);
	await page.evaluate(() => window.__live.setMicrophoneAudio(true));
	await expect(hint).toBeHidden();

	await stage.getByRole('button', { name: 'Turn microphone off' }).click();
	await expect(stage.getByText('Microphone off')).toBeVisible();
	expect(await page.evaluate(() => window.__live.microphone?.enabled)).toBe(false);

	await emit(page, {
		type: 'session.input_transcript.delta',
		start_ms: 1000,
		end_ms: 2000,
		delta: 'Turn on the kitchen light.'
	});
	await functionCall(page, 'call_change', 'HassTurnOn', {
		name: 'Kitchen Light',
		domain: ['light']
	});
	await expect(stage.getByRole('button', { name: 'Approve' })).toBeVisible();

	await page.keyboard.press('Escape');
	await expect(stage).toBeHidden();
	await expect(page.locator('#voice-orb')).toBeFocused();
	await expect(page.getByText(INTERRUPTED)).toBeVisible();
	await expect(
		page
			.getByRole('article', { name: 'You' })
			.getByText('Turn on the kitchen light.', { exact: true })
	).toBeVisible();
	expect(await toolOutput(page, 'call_change')).toBeUndefined();
	expect(await page.evaluate(() => window.__live.microphone?.readyState)).toBe('ended');
});

test('the stage fits a phone in landscape with the orb beside the controls', async ({ page }) => {
	await setup(page);
	await page.setViewportSize({ width: 844, height: 390 });
	const stage = await openStage(page);
	await stage.getByRole('button', { name: 'Allow microphone' }).click();
	await expect(stage.getByRole('status')).toHaveText('Listening');

	const orb = await stage.locator('.voice-orb').boundingBox();
	const status = await stage.getByRole('status').boundingBox();
	const end = await stage.getByRole('button', { name: 'End', exact: true }).boundingBox();
	if (!orb || !status || !end) throw new Error('The stage is not laid out.');
	expect(orb.x + orb.width).toBeLessThanOrEqual(status.x);
	expect(orb.x + orb.width).toBeLessThanOrEqual(end.x);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	).toBeLessThanOrEqual(0);
});
