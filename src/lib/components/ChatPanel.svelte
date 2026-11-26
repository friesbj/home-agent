<script lang="ts">
	import { onMount } from 'svelte';
	import { getToolOrDynamicToolName, isToolUIPart } from 'ai';
	import { textSnapshot } from '$lib/home/chat-history';
	import { getChatSessionManager } from '$lib/home/chat-session.svelte';
	import {
		CircleAlert,
		Mic,
		SendHorizontal,
		Square,
		SquarePen,
		TriangleAlert
	} from '@lucide/svelte';
	import AssistantOrb from './AssistantOrb.svelte';
	import MarkdownMessage from './MarkdownMessage.svelte';
	import ToolCallCard from './ToolCallCard.svelte';
	import ToolActionCard from './ToolActionCard.svelte';
	import { formatToolOutput } from '$lib/home/tool-output';
	import type { LiveToolCard } from '$lib/live/tool-calls';

	interface Props {
		onstartvoice?: () => void;
	}

	let { onstartvoice }: Props = $props();

	const LIVE_CARD_STATUS: Record<LiveToolCard['status'], { text: string; tone: string }> = {
		running: { text: 'Running…', tone: 'text-ink-muted' },
		'waiting-confirmation': { text: 'Waiting for your confirmation', tone: 'text-warning' },
		done: { text: 'Done', tone: 'text-success' },
		denied: { text: 'Not executed', tone: 'text-ink-muted' },
		failed: { text: 'Failed', tone: 'text-danger' },
		interrupted: { text: 'Interrupted, outcome unknown', tone: 'text-ink-muted' }
	};

	const suggestions = [
		'Which lights are on right now?',
		'What is the temperature in the living room?',
		'Turn off all lights in the kitchen.'
	];

	let input = $state('');
	const manager = getChatSessionManager();
	const chat = $derived(manager.chat);
	const busy = $derived(chat.status === 'submitted' || chat.status === 'streaming');

	onMount(() => {
		void manager.initialize();
		manager.refresh();
		return () => {
			void manager.cancelForNavigation();
		};
	});

	$effect(() => {
		if (!manager.available || !manager.initialized || manager.switching) return;
		const snapshot = textSnapshot(chat.messages, manager.interruptedTools);
		if (snapshot) void manager.persist(snapshot.messages, snapshot.interruptedTools);
	});

	async function selectSession(id: string) {
		if (id === manager.id || manager.switching) return;
		manager.switching = true;
		try {
			const selected = manager.sessions.find((session) => session.id === id);
			if (id !== 'new' && !selected) throw new Error('Chat session no longer exists.');
			await manager.switchTo(selected);
			input = '';
		} catch {
			manager.error = 'Could not open this conversation. Check browser storage and try again.';
		} finally {
			manager.switching = false;
		}
	}

	function send(text: string) {
		const value = text.trim();
		if (!value || busy || manager.switching) return;
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
		if (manager.switching) return;
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

<section class="flex h-full min-h-0 flex-col lg:rounded-card lg:surface-glass" aria-label="Chat">
	<div
		class="flex shrink-0 flex-wrap items-center gap-3 border-b border-white/10 p-2 max-lg:pl-14 lg:p-3"
	>
		{#if chat.messages.length > 0}
			<span class="max-lg:hidden"><AssistantOrb size="header" /></span>
		{/if}
		<label for="chat-session" class="sr-only">Conversation</label>
		<select
			id="chat-session"
			class="field min-h-11 min-w-32 flex-1 py-2 text-sm"
			value={manager.id}
			disabled={manager.switching || !manager.available}
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
			class="btn shrink-0 btn-secondary"
			disabled={manager.switching}
			onclick={() => selectSession('new')}
			><SquarePen size={16} aria-hidden="true" /> New chat</button
		>
	</div>
	<div
		{@attach autoscroll}
		class="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 max-lg:px-2"
		aria-live="polite"
	>
		{#if manager.error}
			<p class="notice notice-error" role="alert">
				<CircleAlert class="shrink-0 text-danger" size={20} aria-hidden="true" />
				<span>{manager.error}</span>
			</p>
		{/if}
		{#if manager.interruptedTools}
			<p class="notice notice-warning">
				<TriangleAlert class="shrink-0 text-warning" size={20} aria-hidden="true" />
				<span
					>A previous response or tool action was interrupted or awaiting confirmation. Its outcome
					is unknown; check Home Assistant before trying again.</span
				>
			</p>
		{/if}
		{#if manager.notice}
			<p class="notice notice-warning" role="status">
				<TriangleAlert class="shrink-0 text-warning" size={20} aria-hidden="true" />
				<span>{manager.notice}</span>
			</p>
		{/if}
		{#if chat.messages.length === 0}
			<div class="flex min-h-full flex-col items-center justify-center gap-5 py-2 text-center">
				{#if onstartvoice}
					<button
						type="button"
						class="rounded-full"
						aria-label="Start voice mode"
						disabled={Boolean(manager.shortcutBlockedReason)}
						onclick={onstartvoice}
					>
						<AssistantOrb size="hero" animated />
					</button>
				{:else}
					<AssistantOrb size="hero" animated />
				{/if}
				<div>
					<p class="text-xl font-semibold">How can I help at home?</p>
					<p class="mt-2 text-ink-muted">Ask about your home or tell me what to change.</p>
				</div>
				<ul class="flex flex-wrap justify-center gap-2">
					{#each suggestions as suggestion (suggestion)}
						<li>
							<button
								type="button"
								class="min-h-11 rounded-full border border-line-strong bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
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
				class={[
					'space-y-2',
					message.role === 'user' ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[95%]'
				]}
				aria-label={message.role === 'user' ? 'You' : 'Assistant'}
			>
				{#if (message.metadata as { source?: 'action'; actionCard?: LiveToolCard } | undefined)?.source === 'action'}
					{@const card = (message.metadata as { actionCard: LiveToolCard }).actionCard}
					<ToolActionCard
						kind={card.kind === 'change' ? 'mutation' : 'read'}
						label={card.label}
						summary={card.summary || undefined}
						statusText={LIVE_CARD_STATUS[card.status].text}
						statusTone={LIVE_CARD_STATUS[card.status].tone}
						highlight={card.status === 'waiting-confirmation'}
					>
						{#if card.status === 'failed' && card.output}
							<p class="mt-2 text-danger">{card.output}</p>
						{:else if card.status === 'denied' && card.output}
							<p class="mt-2 text-ink-muted">{card.output}</p>
						{:else if card.status === 'done' && card.output}
							<details class="mt-2">
								<summary
									class="inline-flex min-h-11 cursor-pointer items-center text-ink-muted hover:text-ink"
									>Show result</summary
								>
								<pre
									class="mt-1 max-h-64 overflow-auto rounded-control bg-[#0f1733] p-3 text-xs whitespace-pre-wrap">{formatToolOutput(
										card.output
									)}</pre>
							</details>
						{/if}
					</ToolActionCard>
				{/if}
				{#if (message.metadata as { source?: 'voice' } | undefined)?.source === 'voice'}
					<p class="mb-1 inline-flex items-center gap-1 text-xs text-ink-muted">
						<Mic size={12} aria-hidden="true" />
						<span>Voice conversation</span>
					</p>
				{/if}
				{#if (message.metadata as { source?: string } | undefined)?.source !== 'action'}
					{#each message.parts as part, partIndex (partIndex)}
						{#if part.type === 'text' && part.text}
							{#if message.role === 'user'}
								<p
									class="rounded-2xl rounded-br-md bg-accent-fill px-4 py-2.5 whitespace-pre-wrap text-white"
								>
									{part.text}
								</p>
							{:else}
								<MarkdownMessage text={part.text} />
							{/if}
						{:else if isToolUIPart(part)}
							<ToolCallCard {part} toolName={getToolOrDynamicToolName(part)} onrespond={respond} />
						{/if}
					{/each}
				{/if}
			</article>
		{/each}

		{#if chat.status === 'submitted'}
			<p class="flex items-center gap-2 text-sm text-ink-muted">
				<span class="size-2 animate-pulse rounded-full bg-accent-ink" aria-hidden="true"></span>
				Thinking…
			</p>
		{/if}
		{#if chat.error}
			<div class="notice notice-error" role="alert">
				<CircleAlert class="shrink-0 text-danger" size={20} aria-hidden="true" />
				<div>
					<p>{chat.error.message || 'Something went wrong.'}</p>
					<button type="button" class="mt-2 btn btn-secondary" onclick={() => chat.regenerate()}>
						Try again
					</button>
				</div>
			</div>
		{/if}
	</div>

	<form class="shrink-0 border-t border-white/10 p-3 max-lg:px-2" onsubmit={handleSubmit}>
		<div
			class="flex field items-end gap-2 pr-1.5 pl-3 focus-within:border-accent-ink focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent-ink"
		>
			<label for="chat-input" class="sr-only">Message</label>
			<textarea
				id="chat-input"
				rows="1"
				class="[field-sizing:content] max-h-[10.75rem] min-h-[3.25rem] min-w-0 flex-1 resize-none border-0! bg-transparent! px-0 py-3.5 shadow-none! placeholder:text-ink-muted/80 focus:ring-0! focus-visible:outline-none!"
				placeholder="Message Home Agent…"
				bind:value={input}
				onkeydown={handleKeydown}
			></textarea>
			{#if onstartvoice}
				<button
					id="start-voice"
					type="button"
					class="mb-1.5 btn size-10 min-h-0 shrink-0 rounded-full p-0 btn-secondary"
					aria-label="Start voice mode"
					title={manager.shortcutBlockedReason || 'Start voice mode'}
					disabled={Boolean(manager.shortcutBlockedReason)}
					onclick={onstartvoice}
				>
					<Mic size={18} aria-hidden="true" />
				</button>
			{/if}
			{#if busy}
				<button
					type="button"
					class="mb-1.5 btn size-10 min-h-0 shrink-0 rounded-full p-0 btn-secondary"
					aria-label="Stop"
					title="Stop"
					onclick={() => chat.stop()}
				>
					<Square size={16} fill="currentColor" aria-hidden="true" />
				</button>
			{:else}
				<button
					type="submit"
					class="mb-1.5 btn size-10 min-h-0 shrink-0 rounded-full p-0 btn-primary"
					aria-label="Send"
					title="Send"
					disabled={!input.trim()}
				>
					<SendHorizontal size={20} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</form>
</section>
