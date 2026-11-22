import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { DynamicToolUIPart } from 'ai';
import ToolCallCard from './ToolCallCard.svelte';

const base = {
	type: 'dynamic-tool',
	toolName: 'HassTurnOn',
	toolCallId: 'call-1',
	input: { name: 'Kitchen', domain: ['light'] }
} as const;

describe('ToolCallCard', () => {
	it('shows the server summary and reports the user decision', async () => {
		const onrespond = vi.fn();
		render(ToolCallCard, {
			part: {
				...base,
				state: 'approval-requested',
				approval: { id: 'approval-1', requestReason: 'Turn on / activate: name "Kitchen" (light)' }
			} as DynamicToolUIPart,
			toolName: 'HassTurnOn',
			onrespond
		});

		await expect.element(page.getByText('Waiting for your confirmation')).toBeVisible();
		await expect
			.element(page.getByText('Turn on / activate: name "Kitchen" (light)'))
			.toBeVisible();
		await page.getByRole('button', { name: 'Deny' }).click();
		expect(onrespond).toHaveBeenCalledWith('approval-1', false);
	});

	it('shows no confirmation buttons for automatically denied calls', async () => {
		render(ToolCallCard, {
			part: {
				...base,
				state: 'output-denied',
				approval: {
					id: 'approval-2',
					approved: false,
					reason: 'Changing lock devices is not allowed.'
				}
			} as DynamicToolUIPart,
			toolName: 'HassTurnOn',
			onrespond: vi.fn()
		});

		await expect.element(page.getByText('Not executed')).toBeVisible();
		await expect.element(page.getByText('Changing lock devices is not allowed.')).toBeVisible();
		await expect.element(page.getByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
	});
});
