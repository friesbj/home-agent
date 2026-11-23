import { isToolUIPart, type UIMessage } from 'ai';
import { z } from 'zod';
import { STORAGE_PREFIX } from '$lib/config/settings';

export const LEGACY_CHAT_HISTORY_KEY = `${STORAGE_PREFIX}chat-history.v1`;
export const CHAT_SESSION_PREFIX = `${STORAGE_PREFIX}chat-session.v1.`;
const sessionId = z.string().regex(/^[a-zA-Z0-9-]+$/);
const sessionSchema = z.object({
	version: z.literal(1),
	id: sessionId,
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	messages: z.array(
		z.object({
			id: z.string().min(1),
			role: z.enum(['user', 'assistant']),
			parts: z.array(z.object({ type: z.literal('text'), text: z.string() })).min(1)
		})
	),
	interruptedTools: z.boolean()
});

export type ChatSession = z.infer<typeof sessionSchema>;
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

export function sessionKey(id: string) {
	return CHAT_SESSION_PREFIX + sessionId.parse(id);
}

export function loadSessions(storage: HistoryStorage): ChatSession[] {
	const sessions: ChatSession[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (!key?.startsWith(CHAT_SESSION_PREFIX)) continue;
		const raw = storage.getItem(key);
		if (raw === null) continue;
		const session = sessionSchema.parse(JSON.parse(raw));
		if (
			sessionKey(session.id) !== key ||
			new Set(session.messages.map((message) => message.id)).size !== session.messages.length
		) {
			throw new Error('Invalid chat session.');
		}
		sessions.push(session);
	}
	return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function textSnapshot(messages: UIMessage[], interruptedTools: boolean) {
	const textMessages: ChatSession['messages'] = [];
	for (const message of messages) {
		if (message.role !== 'user' && message.role !== 'assistant') continue;
		const parts: ChatSession['messages'][number]['parts'] = [];
		for (const part of message.parts) {
			if (part.type === 'text' && part.text) parts.push({ type: 'text', text: part.text });
			if (
				isToolUIPart(part) &&
				(part.state === 'input-streaming' ||
					part.state === 'input-available' ||
					part.state === 'approval-requested' ||
					part.state === 'approval-responded')
			)
				interruptedTools = true;
		}
		if (parts.length) textMessages.push({ id: message.id, role: message.role, parts });
	}
	return { messages: textMessages, interruptedTools };
}

export function writeSession(
	storage: HistoryStorage,
	session: ChatSession,
	expected: string | null
) {
	const key = sessionKey(session.id);
	if (storage.getItem(key) !== expected) throw new Error('Chat session changed in another tab.');
	const raw = JSON.stringify(sessionSchema.parse(session));
	storage.setItem(key, raw);
	return raw;
}

export function deleteLegacyHistory(storage: HistoryStorage) {
	storage.removeItem(LEGACY_CHAT_HISTORY_KEY);
}

export function clearChatHistory(storage: HistoryStorage) {
	const keys: string[] = [];
	for (let index = 0; index < storage.length; index++) {
		const key = storage.key(index);
		if (key === LEGACY_CHAT_HISTORY_KEY || key?.startsWith(CHAT_SESSION_PREFIX)) keys.push(key);
	}
	for (const key of keys) storage.removeItem(key);
}
