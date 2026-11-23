import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import {
	CHAT_HISTORY_KEY,
	clearChatHistory,
	loadChatHistory,
	saveChatHistory
} from './chat-history';

function storage() {
	const values = new Map<string, string>();
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => void values.set(key, value),
		removeItem: (key: string) => void values.delete(key)
	};
}

describe('chat history', () => {
	it('stores text only and never restores pending tool approvals', () => {
		const store = storage();
		const messages: UIMessage[] = [
			{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Turn on the light' }] },
			{
				id: '2',
				role: 'assistant',
				parts: [
					{ type: 'text', text: 'Please confirm.' },
					{
						type: 'dynamic-tool',
						toolName: 'HassTurnOn',
						toolCallId: 'call-1',
						state: 'approval-requested',
						input: { domain: 'light', token: 'sensitive' },
						approval: { id: 'signed-approval' }
					}
				]
			}
		];
		saveChatHistory(store, messages, false);
		expect(loadChatHistory(store)).toEqual({
			version: 1,
			messages: [
				{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Turn on the light' }] },
				{ id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Please confirm.' }] }
			],
			interruptedTools: true
		});
		expect(store.getItem(CHAT_HISTORY_KEY)).not.toContain('signed-approval');
		expect(store.getItem(CHAT_HISTORY_KEY)).not.toContain('sensitive');
		clearChatHistory(store);
		expect(loadChatHistory(store)).toBeNull();
	});

	it('rejects invalid, unknown-version, and duplicate-id data without changing it', () => {
		const store = storage();
		for (const raw of [
			'{',
			'{"version":2,"messages":[],"interruptedTools":false}',
			JSON.stringify({
				version: 1,
				messages: [
					{ id: '1', role: 'user', parts: [{ type: 'text', text: 'a' }] },
					{ id: '1', role: 'assistant', parts: [{ type: 'text', text: 'b' }] }
				],
				interruptedTools: false
			})
		]) {
			store.setItem(CHAT_HISTORY_KEY, raw);
			expect(() => loadChatHistory(store)).toThrow();
			expect(store.getItem(CHAT_HISTORY_KEY)).toBe(raw);
		}
	});
});
