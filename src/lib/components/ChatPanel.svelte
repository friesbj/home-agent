<script lang="ts">
	import { onMount } from 'svelte';
	import { Chat } from '@ai-sdk/svelte';
	import {
		DefaultChatTransport,
		getToolOrDynamicToolName,
		isToolUIPart,
		lastAssistantMessageIsCompleteWithApprovalResponses
	} from 'ai';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { loadSettings, STORAGE_KEYS } from '$lib/config/settings';
	import { credentialHeaders, savedMcpTarget } from '$lib/home/api';
	import { CHAT_HISTORY_KEY, loadChatHistory, saveChatHistory } from '$lib/home/chat-history';
	import ToolCallCard from './ToolCallCard.svelte';

	const suggestions = [
		'Which lights are on right now?',
		'What is the temperature in the living room?',
		'Turn off all lights in the kitchen.'
	];

	let input = $state('');
	let historyError = $state('');
	let interruptedTools = $state(false);
	let historyAvailable = $state(true);
	let initialMessages;
	if (appConfig.settings.history.enabled) {
		try {
			const history = loadChatHistory(localStorage);
			initialMessages = history?.messages;
			interruptedTools = history?.interruptedTools ?? false;
		} catch {
			historyAvailable = false;
			historyError =
				'Chat history could not be loaded. It will not be overwritten. Check browser storage or clear chat history in Settings.';
		}
	}

	const chat = new Chat({
		messages: initialMessages,
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

	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	onMount(() => {
		function handleStorage(event: StorageEvent) {
			if (
				event.storageArea === localStorage &&
				(event.key === STORAGE_KEYS.settings ||
					event.key === CHAT_HISTORY_KEY ||
					event.key === null)
			) {
				historyAvailable = false;
				historyError =
					'History or settings changed in another tab. Reload before saving chat history.';
			}
		}
		window.addEventListener('storage', handleStorage);
		return () => window.removeEventListener('storage', handleStorage);
	});

	$effect(() => {
		if (!appConfig.settings.history.enabled || !historyAvailable) return;
		const messages = $state.snapshot(chat.messages);
		try {
			if (!loadSettings(localStorage).history.enabled) return;
			saveChatHistory(localStorage, messages, interruptedTools);
			historyError = '';
		} catch {
			historyError = 'Chat history could not be saved. Check browser storage or available space.';
		}
	});

	function send(text: string) {
		const value = text.trim();
		if (!value || busy) return;
		interruptedTools = false;
		chat.sendMessage({ text: value });
		input = '';
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		send(input);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
			event.preventDefault();
			send(input);
		}
	}

	function respond(approvalId: string, approved: boolean) {
		chat.addToolApprovalResponse({
			id: approvalId,
			approved,
			reason: approved ? undefined : 'The user denied this action.'
		});
	}

	/** Keeps the latest message in view while streaming. */
	function autoscroll(node: HTMLElement) {
		void chat.messages.length;
		void chat.messages.at(-1)?.parts.length;
		node.scrollTo({ top: node.scrollHeight });
	}
</script>

<section
	class="flex h-full min-h-0 flex-col rounded-lg border border-stone-200 bg-white"
	aria-label="Chat"
>
	<div {@attach autoscroll} class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
		{#if historyError}
			<p class="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
				{historyError}
			</p>
		{/if}
		{#if interruptedTools}
			<p class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
				A previous tool action was interrupted or awaiting confirmation. Its outcome is unknown;
				check Home Assistant before trying again.
			</p>
		{/if}
		{#if chat.messages.length === 0}
			<div class="space-y-3 text-stone-600">
				<p>Ask about your home or tell me what to change.</p>
				<ul class="flex flex-wrap gap-2">
					{#each suggestions as suggestion (suggestion)}
						<li>
							<button
								type="button"
								class="rounded-full border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
								onclick={() => send(suggestion)}
							>
								{suggestion}
							</button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		{#each chat.messages as message (message.id)}
			<article
				class="space-y-2 {message.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[95%]'}"
				aria-label={message.role === 'user' ? 'You' : 'Assistant'}
			>
				{#each message.parts as part, partIndex (partIndex)}
					{#if part.type === 'text' && part.text}
						<p
							class="rounded-lg px-3 py-2 whitespace-pre-wrap {message.role === 'user'
								? 'bg-stone-900 text-white'
								: 'bg-stone-100 text-stone-900'}"
						>
							{part.text}
						</p>
					{:else if isToolUIPart(part)}
						<ToolCallCard {part} toolName={getToolOrDynamicToolName(part)} onrespond={respond} />
					{/if}
				{/each}
			</article>
		{/each}

		{#if chat.status === 'submitted'}
			<p class="text-sm text-stone-500">Thinking…</p>
		{/if}
		{#if chat.error}
			<div class="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
				<p>{chat.error.message || 'Something went wrong.'}</p>
				<button type="button" class="mt-2 underline" onclick={() => chat.regenerate()}>
					Try again
				</button>
			</div>
		{/if}
	</div>

	<form class="flex shrink-0 items-end gap-2 border-t border-stone-200 p-3" onsubmit={handleSubmit}>
		<label for="chat-input" class="sr-only">Message</label>
		<textarea
			id="chat-input"
			rows="2"
			class="flex-1 resize-none rounded-md border-stone-300"
			placeholder="Message Home Agent…"
			bind:value={input}
			onkeydown={handleKeydown}
		></textarea>
		{#if busy}
			<button
				type="button"
				class="rounded-md border border-stone-300 px-4 py-2 hover:bg-stone-100"
				onclick={() => chat.stop()}
			>
				Stop
			</button>
		{:else}
			<button
				type="submit"
				class="rounded-md bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
				disabled={!input.trim()}
			>
				Send
			</button>
		{/if}
	</form>
</section>
