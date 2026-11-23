<script lang="ts">
	import { Lightbulb, Power, ScrollText, Sparkles, Thermometer } from '@lucide/svelte';

	let { domain }: { domain: string } = $props();

	const icons = {
		light: { icon: Lightbulb, tone: 'text-warm' },
		climate: { icon: Thermometer, tone: 'text-cool' },
		scene: { icon: Sparkles, tone: 'text-violet' },
		script: { icon: ScrollText, tone: 'text-violet' }
	} as const;

	const entry = $derived(
		icons[domain as keyof typeof icons] ?? { icon: Power, tone: 'text-ink-muted' }
	);
</script>

<span class="icon-well" aria-hidden="true">
	<entry.icon class={entry.tone} size={20} strokeWidth={1.75} />
</span>
