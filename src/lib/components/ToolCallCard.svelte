<script lang="ts">
	import type { DynamicToolUIPart, ToolUIPart } from 'ai';
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
				return { text: 'Running…', tone: 'text-stone-600' };
			case 'approval-requested':
				return { text: 'Waiting for your confirmation', tone: 'text-amber-800' };
			case 'approval-responded':
				return part.approval.approved
					? { text: 'Approved, running…', tone: 'text-stone-600' }
					: { text: 'Denied', tone: 'text-stone-600' };
			case 'output-available':
				return { text: 'Done', tone: 'text-emerald-800' };
			case 'output-error':
				return { text: 'Failed', tone: 'text-red-700' };
			case 'output-denied':
				return { text: 'Not executed', tone: 'text-stone-600' };
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
	class="rounded-md border p-3 text-sm {part.state === 'approval-requested'
		? 'border-amber-400 bg-amber-50'
		: 'border-stone-200 bg-stone-50'}"
>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<span class="font-medium text-stone-800">
			<span class="rounded bg-stone-200 px-1.5 py-0.5 text-xs tracking-wide uppercase">
				{kind === 'mutation' ? 'Change' : kind === 'read' ? 'Read' : 'Blocked'}
			</span>
			<span class="ml-1 font-mono">{label}</span>
		</span>
		<span class={status.tone}>{status.text}</span>
	</div>

	{#if summary}
		<p class="mt-1 text-stone-800">{summary}</p>
	{/if}

	{#if part.state === 'approval-requested'}
		<div class="mt-3 flex gap-2" role="group" aria-label="Confirm {label}">
			<button
				type="button"
				class="rounded-md bg-stone-900 px-3 py-1 text-white hover:bg-stone-700"
				onclick={() => onrespond(part.approval.id, true)}
			>
				Approve
			</button>
			<button
				type="button"
				class="rounded-md border border-stone-300 bg-white px-3 py-1 hover:bg-stone-100"
				onclick={() => onrespond(part.approval.id, false)}
			>
				Deny
			</button>
		</div>
	{:else if part.state === 'output-error'}
		<p class="mt-1 text-red-700">{part.errorText}</p>
	{:else if part.state === 'output-denied' && part.approval.reason}
		<p class="mt-1 text-stone-600">{part.approval.reason}</p>
	{:else if part.state === 'output-available'}
		<details class="mt-2">
			<summary class="cursor-pointer text-stone-600">Show result</summary>
			<pre
				class="mt-2 max-h-64 overflow-auto rounded bg-white p-2 text-xs whitespace-pre-wrap">{formatOutput(
					part.output
				)}</pre>
		</details>
	{/if}
</div>
