<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import VoiceStateGallery from '$lib/components/dev/VoiceStateGallery.svelte';

	function returnToAssistant() {
		void goto(resolve('/'));
	}
</script>

<svelte:head>
	<title>Home Agent</title>
</svelte:head>

{#if import.meta.env.DEV}
	<VoiceStateGallery onclose={returnToAssistant} />
{:else}
	<p class="sr-only">Not found</p>
{/if}
