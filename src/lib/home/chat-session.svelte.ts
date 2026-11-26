import { Chat } from '@ai-sdk/svelte';
import {
	DefaultChatTransport,
	lastAssistantMessageIsCompleteWithApprovalResponses,
	type UIMessage
} from 'ai';
import { appConfig } from '$lib/config/app-config.svelte';
import { loadSettings, STORAGE_KEYS } from '$lib/config/settings';
import type { LiveTranscriptTurn } from '$lib/live/events';
import type { LiveToolCard } from '$lib/live/tool-calls';
import { credentialHeaders, savedMcpTarget } from './api';
import {
	CHAT_SESSION_PREFIX,
	clearChatHistory,
	deleteLegacyHistory,
	loadSessions,
	sessionKey,
	textSnapshot,
	liveContextInput as buildLiveContextInput,
	writeSession,
	type ChatSession
} from './chat-history';

function createChat(messages: UIMessage[] = []) {
	return new Chat({
		messages,
		transport: new DefaultChatTransport({
			api: '/api/chat',
			headers: () => credentialHeaders(savedMcpTarget()),
			body: () => {
				const target = savedMcpTarget();
				return {
					model: appConfig.settings.models.textModel,
					confirmation: appConfig.confirmation,
					mcp: target ? { url: target.url, transport: target.transport } : undefined
				};
			}
		}),
		sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses
	});
}

function newSessionId() {
	return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');
}

async function withHistoryLock<T>(callback: () => T, allowUnlocked = false): Promise<T> {
	if (!navigator.locks) {
		if (allowUnlocked) return callback();
		throw new Error('Browser storage locking is unavailable.');
	}
	return navigator.locks.request('home-agent.chat-sessions', callback);
}

class ChatSessionManager {
	chat = $state.raw(createChat());
	id = $state<string>(newSessionId());
	createdAt = new Date().toISOString();
	interruptedTools = $state(false);
	sessions = $state<ChatSession[]>([]);
	error = $state('');
	notice = $state('');
	available = $state(true);
	expected: string | null = null;
	generation = 0;
	initialized = $state(false);
	/** True while a session switch is in progress; no message may be sent meanwhile. */
	switching = $state(false);

	get busy() {
		return this.chat.status === 'submitted' || this.chat.status === 'streaming';
	}

	get awaitingApproval() {
		return (this.chat.messages.at(-1)?.parts ?? []).some(
			(part) => 'state' in part && part.state === 'approval-requested'
		);
	}

	/** Why a shortcut cannot be sent right now, or an empty string when it can. */
	get shortcutBlockedReason() {
		if (this.switching) return 'Opening a conversation…';
		if (this.awaitingApproval) return 'Answer the pending confirmation first.';
		if (this.busy) return 'Wait for the current response to finish.';
		return '';
	}

	/** Sends a shortcut request through the regular chat path, including server-side confirmation. */
	submitShortcut(text: string) {
		const value = text.trim();
		if (!value || this.shortcutBlockedReason) return false;
		this.interruptedTools = false;
		void this.chat.sendMessage({ text: value });
		return true;
	}

	/** Adds or updates voice turns in the active chat; persistence is handled separately. */
	appendVoiceTranscript(turns: LiveTranscriptTurn[]) {
		const messages = [...this.chat.messages];
		for (const turn of turns) {
			if (!turn.text.trim()) continue;
			const voiceTurnId =
				turn.id ?? `${turn.role}-${turn.startMs ?? turn.endMs ?? crypto.randomUUID()}`;
			const existingIndex = messages.findIndex(
				(message) =>
					(message.metadata as { voiceTurnId?: string } | undefined)?.voiceTurnId === voiceTurnId
			);
			if (existingIndex >= 0) {
				messages[existingIndex] = {
					...messages[existingIndex],
					parts: [{ type: 'text', text: turn.text }]
				};
			} else {
				messages.push({
					id: crypto.randomUUID(),
					role: turn.role,
					metadata: { source: 'voice', voiceTurnId },
					parts: [{ type: 'text', text: turn.text }]
				});
			}
		}
		this.chat.messages = messages;
	}

	appendLiveToolCards(cards: LiveToolCard[]) {
		const messages = [...this.chat.messages];
		for (const card of cards) {
			const existingIndex = messages.findIndex(
				(message) =>
					(message.metadata as { actionCardId?: string } | undefined)?.actionCardId === card.id
			);
			const metadata = { source: 'action' as const, actionCardId: card.id, actionCard: card };
			if (existingIndex >= 0) {
				messages[existingIndex] = {
					...messages[existingIndex],
					metadata,
					parts: [{ type: 'text', text: card.summary || card.label }]
				};
			} else {
				messages.push({
					id: crypto.randomUUID(),
					role: 'assistant',
					metadata,
					parts: [{ type: 'text', text: card.summary || card.label }]
				});
			}
		}
		this.chat.messages = messages;
	}

	/** Recent text messages, bounded for provider context and server validation. */
	liveContextInput() {
		return buildLiveContextInput(this.chat.messages);
	}

	async initialize() {
		if (this.initialized) return;
		this.initialized = true;
		try {
			await withHistoryLock(() => deleteLegacyHistory(localStorage), true);
			if (!navigator.locks) throw new Error('Browser storage locking is unavailable.');
			this.refresh();
		} catch {
			this.available = false;
			this.error =
				'Chat history could not be initialized. Check browser storage and use HTTPS or localhost.';
		}
		window.addEventListener('storage', (event) => {
			if (event.storageArea !== localStorage) return;
			if (
				event.key === STORAGE_KEYS.settings ||
				event.key === null ||
				event.key === sessionKey(this.id)
			) {
				this.available = false;
				if (event.key === STORAGE_KEYS.settings || event.key === null) this.sessions = [];
				this.error =
					'History or settings changed in another tab. Reload before saving chat history.';
			}
			if (event.key === null || event.key?.startsWith(CHAT_SESSION_PREFIX)) this.refresh();
		});
	}

	refresh() {
		try {
			this.sessions = loadSessions(localStorage);
		} catch {
			this.available = false;
			this.error =
				'Chat history could not be loaded. It will not be overwritten. Check browser storage or clear chat history in Settings.';
		}
	}

	async persist(messages: UIMessage[], interruptedTools: boolean, generation = this.generation) {
		if (!this.available || messages.length === 0) return;
		const snapshot = textSnapshot(messages, interruptedTools);
		if (snapshot.messages.length === 0) return;
		try {
			await withHistoryLock(() => {
				const settings = loadSettings(localStorage);
				if (generation !== this.generation || !this.available || !settings.onboardingCompleted)
					return;
				const session: ChatSession = {
					version: 1,
					id: this.id,
					createdAt: this.createdAt,
					updatedAt: new Date().toISOString(),
					...snapshot
				};
				this.expected = writeSession(localStorage, session, this.expected);
				this.refresh();
			});
		} catch {
			this.available = false;
			this.error =
				'Chat history could not be saved or was changed in another tab. Reload or check browser storage.';
		}
	}

	async switchTo(session?: ChatSession) {
		const oldChat = this.chat;
		const snapshot = textSnapshot(
			oldChat.messages,
			this.interruptedTools || oldChat.status === 'streaming' || oldChat.status === 'submitted'
		);
		this.generation++;
		await oldChat.stop();
		await this.persist(snapshot.messages, snapshot.interruptedTools);
		this.generation++;
		if (session) {
			await withHistoryLock(() => {
				const current = loadSessions(localStorage).find((item) => item.id === session.id);
				if (!current) throw new Error('Chat session no longer exists.');
				this.id = current.id;
				this.createdAt = current.createdAt;
				this.expected = localStorage.getItem(sessionKey(current.id));
				this.interruptedTools = current.interruptedTools;
				this.chat = createChat(current.messages);
			});
		} else {
			this.id = newSessionId();
			this.createdAt = new Date().toISOString();
			this.expected = null;
			this.interruptedTools = false;
			this.chat = createChat();
		}
		this.notice = snapshot.interruptedTools
			? 'The previous response was interrupted. Check Home Assistant before retrying an action; its outcome may be unknown.'
			: '';
	}

	async cancelForNavigation() {
		const oldChat = this.chat;
		const snapshot = textSnapshot(
			oldChat.messages,
			this.interruptedTools || oldChat.status === 'streaming' || oldChat.status === 'submitted'
		);
		if (!snapshot.interruptedTools) return;
		const generation = ++this.generation;
		this.interruptedTools = snapshot.interruptedTools;
		this.chat = createChat(snapshot.messages);
		const stopped = oldChat.stop();
		await this.persist(snapshot.messages, snapshot.interruptedTools, generation);
		await stopped;
	}

	async clear(afterClear?: () => void) {
		this.generation++;
		await this.chat.stop();
		await withHistoryLock(() => {
			clearChatHistory(localStorage);
			afterClear?.();
		}, true);
		this.id = newSessionId();
		this.createdAt = new Date().toISOString();
		this.expected = null;
		this.interruptedTools = false;
		this.chat = createChat();
		this.sessions = [];
		this.available = Boolean(navigator.locks);
		this.error = this.available
			? ''
			: 'Chat history could not be initialized. Check browser storage and use HTTPS or localhost.';
		this.notice = '';
	}
}

let manager: ChatSessionManager | undefined;
export function getChatSessionManager() {
	return (manager ??= new ChatSessionManager());
}

export async function clearStoredChatHistory() {
	if (manager) await manager.clear();
	else await withHistoryLock(() => clearChatHistory(localStorage), true);
}

export async function resetApplicationData() {
	if (manager) await manager.clear(() => appConfig.resetAll());
	else await withHistoryLock(() => appConfig.resetAll(), true);
}
