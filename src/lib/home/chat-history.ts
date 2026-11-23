import { isToolUIPart, type UIMessage } from 'ai';
import { z } from 'zod';
import { STORAGE_PREFIX } from '$lib/config/settings';

export const CHAT_HISTORY_KEY = `${STORAGE_PREFIX}chat-history.v1`;

const historySchema = z.object({
	version: z.literal(1),
	messages: z.array(
		z.object({
			id: z.string().min(1),
			role: z.enum(['user', 'assistant']),
			parts: z.array(z.object({ type: z.literal('text'), text: z.string() })).min(1)
		})
	),
	interruptedTools: z.boolean()
});

type History = z.infer<typeof historySchema>;
type HistoryStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function loadChatHistory(storage: HistoryStorage): History | null {
	const raw = storage.getItem(CHAT_HISTORY_KEY);
	if (raw === null) return null;
	const history = historySchema.parse(JSON.parse(raw));
	if (new Set(history.messages.map((message) => message.id)).size !== history.messages.length) {
		throw new Error('Chat history contains duplicate message IDs.');
	}
	return history;
}

export function saveChatHistory(
	storage: HistoryStorage,
	messages: UIMessage[],
	previouslyInterrupted: boolean
) {
	const textMessages: History['messages'] = [];
	let interruptedTools = previouslyInterrupted;
	for (const message of messages) {
		if (message.role !== 'user' && message.role !== 'assistant') continue;
		const parts: History['messages'][number]['parts'] = [];
		for (const part of message.parts) {
			if (part.type === 'text' && part.text) parts.push({ type: 'text', text: part.text });
			if (
				isToolUIPart(part) &&
				(part.state === 'input-streaming' ||
					part.state === 'input-available' ||
					part.state === 'approval-requested' ||
					part.state === 'approval-responded')
			) {
				interruptedTools = true;
			}
		}
		if (parts.length) textMessages.push({ id: message.id, role: message.role, parts });
	}
	storage.setItem(
		CHAT_HISTORY_KEY,
		JSON.stringify({ version: 1, messages: textMessages, interruptedTools } satisfies History)
	);
}

export function clearChatHistory(storage: HistoryStorage) {
	storage.removeItem(CHAT_HISTORY_KEY);
}
