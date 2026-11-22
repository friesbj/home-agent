<script lang="ts">
  import { Chat } from '@ai-sdk/svelte';
  import { DefaultChatTransport } from 'ai';

  let input = $state('');
  const chat = new Chat({
    transport: new DefaultChatTransport({ api: '/api/chat' })
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    chat.sendMessage({ text: input });
    input = '';
  }
</script>

<main>
  <h1>Home Agent</h1>
  <ul>
    {#each chat.messages as message, messageIndex (messageIndex)}
      <li>
        <div>{message.role}</div>
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
    <p role="alert">{chat.error.message}</p>
  {/if}
  <form onsubmit={handleSubmit}>
    <input bind:value={input} />
    <button type="submit" disabled={chat.status === 'submitted' || chat.status === 'streaming'}>Send</button>
  </form>
</main>