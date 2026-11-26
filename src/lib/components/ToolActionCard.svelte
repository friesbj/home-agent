<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Ban, Eye, PenLine } from '@lucide/svelte';

	interface Props {
		kind: 'mutation' | 'read' | 'blocked';
		/** Mono tool name shown next to the badge, e.g. HassTurnOn. */
		label: string;
		summary?: string;
		statusText: string;
		statusTone: string;
		/** Draws the warning accent used while a confirmation is pending. */
		highlight?: boolean;
		/** Buttons, result, or error rendered below the summary. */
		children?: Snippet;
	}

	let {
		kind,
		label,
		summary,
		statusText,
		statusTone,
		highlight = false,
		children
	}: Props = $props();
</script>

<div class={['rounded-tile p-3 text-sm surface-solid', highlight && 'border-l-4 border-l-warning']}>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="flex min-w-0 items-center gap-2 font-medium">
			<span
				class={[
					'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold tracking-wide uppercase',
					kind === 'mutation' && 'border-warning/50 text-warning',
					kind === 'read' && 'border-cool/50 text-cool',
					kind === 'blocked' && 'border-danger/50 text-danger'
				]}
			>
				{#if kind === 'mutation'}<PenLine
						size={12}
						aria-hidden="true"
					/>{:else if kind === 'read'}<Eye size={12} aria-hidden="true" />{:else}<Ban
						size={12}
						aria-hidden="true"
					/>{/if}
				{kind === 'mutation' ? 'Change' : kind === 'read' ? 'Read' : 'Blocked'}
			</span>
			<span class="truncate font-mono text-ink-muted">{label}</span>
		</span>
		<span class={['font-medium', statusTone]}>{statusText}</span>
	</div>

	{#if summary}
		<p class="mt-2 text-base">{summary}</p>
	{/if}

	{@render children?.()}
</div>
