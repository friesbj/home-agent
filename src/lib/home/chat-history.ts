import { isToolUIPart, type UIMessage } from 'ai';
import { z } from 'zod';
import { STORAGE_PREFIX } from '$lib/config/settings';
import type { LiveToolCard } from '$lib/live/tool-calls';

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
			metadata: z
				.union([
					z.object({
						source: z.literal('voice'),
						voiceTurnId: z.string().min(1).max(128)
					}),
					z.object({
						source: z.literal('action'),
						actionCardId: z.string().min(1).max(128),
						actionCard: z.object({
							id: z.string(),
							kind: z.enum(['read', 'change']),
							// Early M3a cards were saved before tool labels were recorded.
							label: z.string().default('Home Assistant tool'),
							summary: z.string(),
							status: z.enum([
								'running',
								'waiting-confirmation',
								'done',
								'denied',
								'failed',
								'interrupted'
							]),
							output: z.string().optional()
						})
					})
				])
				.optional(),
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

/** A restored conversation cannot resume the Live calls owned by its original browser page. */
export function restoreSession(session: ChatSession): ChatSession {
	let interruptedTools = session.interruptedTools;
	const messages = session.messages.map((message) => {
		const metadata = message.metadata;
		if (
			metadata?.source !== 'action' ||
			(metadata.actionCard.status !== 'running' &&
				metadata.actionCard.status !== 'waiting-confirmation')
		)
			return message;
		if (metadata.actionCard.kind === 'change') interruptedTools = true;
		return {
			...message,
			metadata: {
				...metadata,
				actionCard: { ...metadata.actionCard, status: 'interrupted' as const }
			}
		};
	});
	return { ...session, messages, interruptedTools };
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
		if (parts.length) {
			const metadata = message.metadata as
				| { source?: 'voice'; voiceTurnId?: string }
				| { source?: 'action'; actionCardId?: string; actionCard?: LiveToolCard }
				| undefined;
			textMessages.push({
				id: message.id,
				role: message.role,
				...(metadata?.source === 'voice' && metadata.voiceTurnId
					? { metadata: { source: 'voice', voiceTurnId: metadata.voiceTurnId } }
					: metadata?.source === 'action' && metadata.actionCardId && metadata.actionCard
						? {
								metadata: {
									source: 'action',
									actionCardId: metadata.actionCardId,
									actionCard: metadata.actionCard
								}
							}
						: {}),
				parts
			});
		}
	}
	return { messages: textMessages, interruptedTools };
}

export function liveContextInput(messages: UIMessage[]) {
	const snapshot = textSnapshot(messages, false).messages;
	const result: { role: 'user' | 'assistant'; text: string }[] = [];
	let characters = 0;
	for (const message of [...snapshot].reverse()) {
		if (result.length >= 128) break;
		if (message.metadata?.source === 'action') continue;
		const text = message.parts
			.map((part) => part.text)
			.join('\n')
			.trim();
		if (!text) continue;
		const remaining = 8192 - characters;
		if (remaining <= 0) break;
		const bounded = text.slice(-Math.min(4096, remaining)).trim();
		if (!bounded) continue;
		result.push({ role: message.role, text: bounded });
		characters += bounded.length;
	}
	return result.reverse();
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
