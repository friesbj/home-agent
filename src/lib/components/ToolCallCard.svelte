<script lang="ts">
	import type { DynamicToolUIPart, ToolUIPart } from 'ai';
	import { baseToolName, classifyToolName, describeToolCall } from '$lib/home/ha-policy';
	import { formatToolOutput } from '$lib/home/tool-output';
	import ToolActionCard from './ToolActionCard.svelte';

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
</script>

<ToolActionCard
	{kind}
	{label}
	{summary}
	statusText={status.text}
	statusTone={status.tone}
	highlight={part.state === 'approval-requested'}
>
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
				class="mt-1 max-h-64 overflow-auto rounded-control bg-[#0f1733] p-3 text-xs whitespace-pre-wrap">{formatToolOutput(
					part.output
				)}</pre>
		</details>
	{/if}
</ToolActionCard>
