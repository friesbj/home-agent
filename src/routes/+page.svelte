<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { DefaultChatTransport } from 'ai';
	import { resolve } from '$app/paths';
	import { appConfig } from '$lib/config/app-config.svelte';
	import { OPENAI_KEY_HEADER } from '$lib/config/headers';

	let input = $state('');
	const chat = new Chat({
		transport: new DefaultChatTransport({
			api: '/api/chat',
			headers: (): Record<string, string> => {
				const apiKey = appConfig.getSecret('openaiApiKey');
				return apiKey ? { [OPENAI_KEY_HEADER]: apiKey } : {};
			},
			body: () => ({ model: appConfig.settings.models.textModel })
		})
	});

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!input.trim()) return;
		chat.sendMessage({ text: input });
		input = '';
	}
</script>

<svelte:head><title>Home Agent</title></svelte:head>

<main class="mx-auto max-w-3xl space-y-6 px-4 py-10">
	<header class="flex items-center justify-between gap-4">
		<h1 class="text-3xl font-semibold text-stone-900">Home Agent</h1>
		<a class="text-stone-700 underline" href={resolve('/settings')}>Settings</a>
	</header>
	<ul class="space-y-3">
		{#each chat.messages as message, messageIndex (messageIndex)}
			<li>
				<div class="text-sm font-medium text-stone-600">{message.role}</div>
				<div>
					{#each message.parts as part, partIndex (partIndex)}
						{#if part.type === 'text'}
							<div>{part.text}</div>
						{/if}
					{/each}
				</div>
			</li>
		{/each}
	</ul>
	{#if chat.error}
		<p role="alert" class="text-red-700">{chat.error.message}</p>
	{/if}
	<form class="flex gap-2" onsubmit={handleSubmit}>
		<label for="chat-input" class="sr-only">Message</label>
		<input id="chat-input" class="flex-1 rounded-md border-stone-300" bind:value={input} />
		<button
			type="submit"
			class="rounded-md bg-stone-900 px-4 py-2 text-white disabled:opacity-50"
			disabled={chat.status === 'submitted' || chat.status === 'streaming'}
		>
			Send
		</button>
	</form>
</main>
