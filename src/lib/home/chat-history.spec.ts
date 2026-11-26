import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { liveSessionRequestSchema } from '$lib/live/protocol';
import {
	CHAT_SESSION_PREFIX,
	LEGACY_CHAT_HISTORY_KEY,
	clearChatHistory,
	deleteLegacyHistory,
	loadSessions,
	restoreSession,
	textSnapshot,
	liveContextInput,
	writeSession,
	type ChatSession
} from './chat-history';

function storage() {
	const values = new Map<string, string>();
	return {
		get length() {
			return values.size;
		},
		key: (index: number) => [...values.keys()][index] ?? null,
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
		removeItem: (key: string) => void values.delete(key)
	};
}

const date = '2026-11-23T12:00:00.000Z';

describe('chat session storage', () => {
	it('loads voice action cards saved before the label field was introduced without changing storage', () => {
		const store = storage();
		const key = `${CHAT_SESSION_PREFIX}legacy-voice`;
		const raw = JSON.stringify({
			version: 1,
			id: 'legacy-voice',
			createdAt: date,
			updatedAt: date,
			messages: [
				{
					id: 'old-card',
					role: 'assistant',
					metadata: {
						source: 'action',
						actionCardId: 'old-call',
						actionCard: {
							id: 'old-call',
							kind: 'change',
							summary: 'Turn on the light',
							status: 'done',
							output: 'Done'
						}
					},
					parts: [{ type: 'text', text: 'Turn on the light' }]
				}
			],
			interruptedTools: false
		});
		store.setItem(key, raw);

		const [session] = loadSessions(store);
		expect(session.messages[0].metadata).toMatchObject({
			source: 'action',
			actionCard: {
				label: 'Home Assistant tool',
				summary: 'Turn on the light',
				status: 'done',
				output: 'Done'
			}
		});
		expect(store.getItem(key)).toBe(raw);
		writeSession(store, session, raw);
		expect(loadSessions(store)[0]).toEqual(session);
	});

	it('marks unfinished voice cards interrupted only when restoring a conversation', () => {
		const makeCard = (
			id: string,
			kind: 'read' | 'change',
			status: 'running' | 'waiting-confirmation' | 'done'
		): ChatSession['messages'][number] => ({
			id,
			role: 'assistant',
			metadata: {
				source: 'action',
				actionCardId: id,
				actionCard: { id, kind, label: id, summary: id, status }
			},
			parts: [{ type: 'text', text: id }]
		});
		const session: ChatSession = {
			version: 1,
			id: 'session-restore',
			createdAt: date,
			updatedAt: date,
			messages: [
				makeCard('read', 'read', 'running'),
				makeCard('change', 'change', 'waiting-confirmation'),
				makeCard('finished', 'change', 'done')
			],
			interruptedTools: false
		};
		const store = storage();
		writeSession(store, session, null);
		const loaded = loadSessions(store)[0];
		expect(loaded).toEqual(session);
		const restored = restoreSession(loaded);
		expect(
			restored.messages.map((message) =>
				message.metadata?.source === 'action' ? message.metadata.actionCard.status : undefined
			)
		).toEqual(['interrupted', 'interrupted', 'done']);
		expect(restored.interruptedTools).toBe(true);
		expect(loadSessions(store)[0]).toEqual(session);
		expect(restoreSession({ ...session, messages: [session.messages[0]] }).interruptedTools).toBe(
			false
		);
	});

	it('bounds live context by message count and text size', () => {
		const messages: UIMessage[] = Array.from({ length: 130 }, (_, index) => ({
			id: String(index),
			role: index % 2 === 0 ? 'user' : 'assistant',
			parts: [{ type: 'text', text: `Message ${index}` }]
		}));
		expect(liveContextInput(messages)).toHaveLength(128);

		const large: UIMessage[] = [
			{
				id: 'large',
				role: 'user',
				parts: [{ type: 'text', text: 'x'.repeat(8193) }]
			}
		];
		const context = liveContextInput(large);
		expect(context).toHaveLength(1);
		expect(context[0].text).toHaveLength(4096);
		expect(context[0].text).toEqual('x'.repeat(4096));
		const twoLarge = liveContextInput([
			{ id: 'older', role: 'user', parts: [{ type: 'text', text: 'a'.repeat(5000) }] },
			{ id: 'newer', role: 'assistant', parts: [{ type: 'text', text: 'b'.repeat(5000) }] }
		]);
		expect(twoLarge.map((item) => item.text.length)).toEqual([4096, 4096]);
		expect(
			liveSessionRequestSchema.safeParse({
				sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n',
				input: twoLarge
			}).success
		).toBe(true);
	});

	it('seeds only conversational text, not voice action-card placeholders', () => {
		const messages: UIMessage[] = [
			{ id: 'user', role: 'user', parts: [{ type: 'text', text: 'Turn on the light' }] },
			{
				id: 'card',
				role: 'assistant',
				metadata: {
					source: 'action',
					actionCardId: 'call',
					actionCard: {
						id: 'call',
						kind: 'change',
						label: 'HassTurnOn',
						summary: 'Turn on the light',
						status: 'done',
						output: 'result'
					}
				},
				parts: [{ type: 'text', text: 'Turn on the light' }]
			},
			{ id: 'reply', role: 'assistant', parts: [{ type: 'text', text: 'The light is on.' }] }
		];
		expect(liveContextInput(messages)).toEqual([
			{ role: 'user', text: 'Turn on the light' },
			{ role: 'assistant', text: 'The light is on.' }
		]);
	});
	it('stores only text and marks pending approvals as interrupted', () => {
		const messages: UIMessage[] = [
			{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Turn on the light' }] },
			{
				id: '2',
				role: 'assistant',
				parts: [
					{
						type: 'dynamic-tool',
						toolName: 'HassTurnOn',
						toolCallId: 'call-1',
						state: 'approval-requested',
						input: { token: 'sensitive' },
						approval: { id: 'signed-approval' }
					}
				]
			}
		];
		const snapshot = textSnapshot(messages, false);
		expect(snapshot).toEqual({ messages: [messages[0]], interruptedTools: true });
		expect(JSON.stringify(snapshot)).not.toContain('signed-approval');
		expect(JSON.stringify(snapshot)).not.toContain('sensitive');
	});

	it('preserves the voice source marker in text snapshots and stored sessions', () => {
		const messages: UIMessage[] = [
			{
				id: 'voice-1',
				role: 'user',
				metadata: { source: 'voice', voiceTurnId: 'user-1000' },
				parts: [{ type: 'text', text: 'Turn on the kitchen light.' }]
			}
		];
		const snapshot = textSnapshot(messages, false);
		expect(snapshot.messages[0].metadata).toEqual({
			source: 'voice',
			voiceTurnId: 'user-1000'
		});

		const store = storage();
		const session: ChatSession = {
			version: 1,
			id: 'session-voice',
			createdAt: date,
			updatedAt: date,
			messages: snapshot.messages,
			interruptedTools: false
		};
		writeSession(store, session, null);
		const metadata = loadSessions(store)[0].messages[0].metadata;
		expect(metadata?.source === 'voice' ? metadata.voiceTurnId : undefined).toBe('user-1000');
	});

	it('keeps sessions independent, rejects stale writes and clears only history', () => {
		const store = storage();
		const session: ChatSession = {
			version: 1,
			id: 'session-1',
			createdAt: date,
			updatedAt: date,
			messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] }],
			interruptedTools: false
		};
		store.setItem(LEGACY_CHAT_HISTORY_KEY, 'old');
		store.setItem('home-agent.settings.v1', 'settings');
		deleteLegacyHistory(store);
		expect(store.getItem(LEGACY_CHAT_HISTORY_KEY)).toBeNull();
		const original = writeSession(store, session, null);
		writeSession(store, { ...session, id: 'session-2' }, null);
		expect(loadSessions(store)).toHaveLength(2);
		expect(() => writeSession(store, session, null)).toThrow(/changed/);
		expect(store.getItem(CHAT_SESSION_PREFIX + session.id)).toBe(original);
		clearChatHistory(store);
		expect(loadSessions(store)).toEqual([]);
		expect(store.getItem('home-agent.settings.v1')).toBe('settings');
	});

	it('rejects invalid stored sessions without overwriting them', () => {
		const store = storage();
		store.setItem(CHAT_SESSION_PREFIX + 'bad', '{broken');
		expect(() => loadSessions(store)).toThrow();
		expect(store.getItem(CHAT_SESSION_PREFIX + 'bad')).toBe('{broken');
	});
});
