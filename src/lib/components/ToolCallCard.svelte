<script lang="ts">
	import type { DynamicToolUIPart, ToolUIPart } from 'ai';
	import { Ban, Eye, PenLine } from '@lucide/svelte';
	import { baseToolName, classifyToolName, describeToolCall } from '$lib/home/ha-policy';

	interface Props {
		part: ToolUIPart | DynamicToolUIPart;
		toolName: string;
		onrespond: (approvalId: string, approved: boolean) => void;
	}

	let { part, toolName, onrespond }: Props = $props();

	const kind = $derived(classifyToolName(toolName));
	const label = $derived(baseToolName(toolName));
	const summary = $derived(
		part.approval?.requestReason ??
			(kind === 'mutation' ? describeToolCall(toolName, part.input) : undefined)
	);

	const status = $derived.by(() => {
		switch (part.state) {
			case 'input-streaming':
			case 'input-available':
				return { text: 'Running…', tone: 'text-ink-muted' };
			case 'approval-requested':
				return { text: 'Waiting for your confirmation', tone: 'text-warning' };
			case 'approval-responded':
				return part.approval.approved
					? { text: 'Approved, running…', tone: 'text-ink-muted' }
					: { text: 'Denied', tone: 'text-ink-muted' };
			case 'output-available':
				return { text: 'Done', tone: 'text-success' };
			case 'output-error':
				return { text: 'Failed', tone: 'text-danger' };
			case 'output-denied':
				return { text: 'Not executed', tone: 'text-ink-muted' };
			default:
				return { text: '', tone: '' };
		}
	});

	function formatOutput(output: unknown): string {
		const content = (output as { content?: { type: string; text?: string }[] } | undefined)
			?.content;
		const text = Array.isArray(content)
			? content
					.filter((item) => item.type === 'text')
					.map((item) => item.text)
					.join('\n')
			: JSON.stringify(output, null, 2);
		return text.length > 4000 ? `${text.slice(0, 4000)}\n…` : text;
	}
</script>

<div
	class={[
		'rounded-tile p-3 text-sm surface-solid',
		part.state === 'approval-requested' && 'border-l-4 border-l-warning'
	]}
>
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
		<span class={['font-medium', status.tone]}>{status.text}</span>
	</div>

	{#if summary}
		<p class="mt-2 text-base">{summary}</p>
	{/if}

	{#if part.state === 'approval-requested'}
		<div class="mt-3 flex flex-wrap gap-2" role="group" aria-label="Confirm {label}">
			<button
				type="button"
				class="btn btn-primary"
				onclick={() => onrespond(part.approval.id, true)}
			>
				Approve
			</button>
			<button
				type="button"
				class="btn btn-secondary"
				onclick={() => onrespond(part.approval.id, false)}
			>
				Deny
			</button>
		</div>
	{:else if part.state === 'output-error'}
		<p class="mt-2 text-danger">{part.errorText}</p>
	{:else if part.state === 'output-denied' && part.approval.reason}
		<p class="mt-2 text-ink-muted">{part.approval.reason}</p>
	{:else if part.state === 'output-available'}
		<details class="mt-2">
			<summary
				class="inline-flex min-h-11 cursor-pointer items-center text-ink-muted hover:text-ink"
				>Show result</summary
			>
			<pre
				class="mt-1 max-h-64 overflow-auto rounded-control bg-[#0f1733] p-3 text-xs whitespace-pre-wrap">{formatOutput(
					part.output
				)}</pre>
		</details>
	{/if}
</div>
