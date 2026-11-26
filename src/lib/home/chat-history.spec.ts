import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
	CHAT_SESSION_PREFIX,
	LEGACY_CHAT_HISTORY_KEY,
	clearChatHistory,
	deleteLegacyHistory,
	loadSessions,
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
