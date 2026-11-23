<script lang="ts">
	import { onMount } from 'svelte';
	import { getToolOrDynamicToolName, isToolUIPart } from 'ai';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { textSnapshot } from '$lib/home/chat-history';
	import { getChatSessionManager } from '$lib/home/chat-session.svelte';
	import MarkdownMessage from './MarkdownMessage.svelte';
	import ToolCallCard from './ToolCallCard.svelte';

	const suggestions = [
		'Which lights are on right now?',
		'What is the temperature in the living room?',
		'Turn off all lights in the kitchen.'
	];

	let input = $state('');
	const manager = getChatSessionManager();
	const chat = $derived(manager.chat);
	let switching = $state(false);
	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	onMount(() => {
		void manager.initialize();
		manager.refresh();
		return () => {
			void manager.cancelForNavigation();
		};
	});

	$effect(() => {
		if (
			!appConfig.settings.history.enabled ||
			!manager.available ||
			!manager.initialized ||
			switching
		)
			return;
		const snapshot = textSnapshot(chat.messages, manager.interruptedTools);
		void manager.persist(snapshot.messages, snapshot.interruptedTools);
	});

	async function selectSession(id: string) {
		if (id === manager.id || switching) return;
		switching = true;
		try {
			const selected = manager.sessions.find((session) => session.id === id);
			if (id !== 'new' && !selected) throw new Error('Chat session no longer exists.');
			await manager.switchTo(selected);
			input = '';
		} catch {
			manager.error = 'Could not open this conversation. Check browser storage and try again.';
		} finally {
			switching = false;
		}
	}

	function send(text: string) {
		const value = text.trim();
		if (!value || busy || switching) return;
		manager.interruptedTools = false;
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
		if (switching) return;
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
	{#if appConfig.settings.history.enabled}
		<div class="flex shrink-0 items-center gap-2 border-b border-stone-200 p-3">
			<label for="chat-session" class="text-sm font-medium text-stone-700">Conversation</label>
			<select
				id="chat-session"
				class="min-w-0 flex-1 rounded-md border-stone-300 text-sm"
				value={manager.id}
				disabled={switching || !manager.available}
				onchange={(event) => selectSession(event.currentTarget.value)}
			>
				{#if !manager.sessions.some((session) => session.id === manager.id)}
					<option value={manager.id}>New conversation</option>
				{/if}
				{#each manager.sessions as session (session.id)}
					<option value={session.id}
						>{session.messages
							.find((message) => message.role === 'user')
							?.parts[0]?.text.slice(0, 60) || 'Conversation'} · {new Date(
							session.updatedAt
						).toLocaleString()}</option
					>
				{/each}
			</select>
			<button
				type="button"
				class="rounded-md border border-stone-300 px-3 py-1 text-sm hover:bg-stone-100"
				disabled={switching}
				onclick={() => selectSession('new')}>New chat</button
			>
		</div>
	{/if}
	<div {@attach autoscroll} class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
		{#if manager.error}
			<p class="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800" role="alert">
				{manager.error}
			</p>
		{/if}
		{#if manager.interruptedTools}
			<p class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
				A previous response or tool action was interrupted or awaiting confirmation. Its outcome is
				unknown; check Home Assistant before trying again.
			</p>
		{/if}
		{#if manager.notice}
			<p
				class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
				role="status"
			>
				{manager.notice}
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
						{#if message.role === 'user'}
							<p class="rounded-lg bg-stone-900 px-3 py-2 whitespace-pre-wrap text-white">
								{part.text}
							</p>
						{:else}
							<MarkdownMessage text={part.text} />
						{/if}
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
			class="min-w-0 flex-1 resize-none rounded-md border-stone-300"
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
