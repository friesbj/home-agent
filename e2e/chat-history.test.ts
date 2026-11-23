import { expect, test } from '@playwright/test';

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';

test('persists text, respects disabled history, and deletes saved history on request', async ({
	page
}) => {
	const requests: { messages: { parts: { type: string; text?: string }[] }[] }[] = [];
	await page.route('**/api/chat', async (route) => {
		requests.push(route.request().postDataJSON());
		const events = [
			{ type: 'start', messageId: `assistant-${requests.length}` },
			{ type: 'text-start', id: 'text-1' },
			{ type: 'text-delta', id: 'text-1', delta: 'The kitchen light is on.' },
			{ type: 'text-end', id: 'text-1' },
			{ type: 'finish' }
		];
		await route.fulfill({
			status: 200,
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`
		});
	});

	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await page.getByLabel('Message').fill('Is the kitchen light on?');
	await page.getByRole('button', { name: 'Send' }).click();
	await expect(page.getByText('The kitchen light is on.')).toBeVisible();
	await page.reload();
	await expect(page.getByText('Is the kitchen light on?')).toBeVisible();
	await expect(page.getByText('The kitchen light is on.')).toBeVisible();
	await page.getByLabel('Message').fill('Thanks');
	await page.getByRole('button', { name: 'Send' }).click();
	await expect.poll(() => requests.length).toBe(2);
	expect(
		requests[1].messages.flatMap((message) => message.parts).map((part) => part.text)
	).toContain('Is the kitchen light on?');

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByLabel('Keep text chat history in this browser').uncheck();
	await page.getByRole('button', { name: 'Save settings' }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Is the kitchen light on?')).toHaveCount(0);
	await page.getByLabel('Message').fill('Do not save this message');
	await page.getByRole('button', { name: 'Send' }).click();
	await expect(page.getByText('The kitchen light is on.')).toBeVisible();
	await page.reload();
	await expect(page.getByText('Do not save this message')).toHaveCount(0);

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByLabel('Keep text chat history in this browser').check();
	await page.getByRole('button', { name: 'Save settings' }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Is the kitchen light on?')).toBeVisible();
	await expect(page.getByText('Do not save this message')).toHaveCount(0);

	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Clear chat history' }).click();
	await page.getByRole('button', { name: 'Delete history', exact: true }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Is the kitchen light on?')).toHaveCount(0);
});

test('preserves unreadable history and reports the error', async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.evaluate(() => localStorage.setItem('home-agent.chat-history.v1', '{broken'));
	await page.reload();
	await expect(
		page.getByRole('alert').filter({ hasText: 'Chat history could not be loaded' })
	).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('home-agent.chat-history.v1'))).toBe(
		'{broken'
	);
});

test('warns about interrupted actions without restoring or sending approvals', async ({ page }) => {
	let requests = 0;
	await page.route('**/api/chat', (route) => {
		requests++;
		return route.fulfill({ status: 500, body: 'Mock failure' });
	});
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.evaluate(() => {
		localStorage.setItem(
			'home-agent.chat-history.v1',
			JSON.stringify({
				version: 1,
				messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Turn on the light' }] }],
				interruptedTools: true
			})
		);
	});
	await page.reload();
	await expect(page.getByText('Turn on the light')).toBeVisible();
	await expect(page.getByText(/previous tool action was interrupted/)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
	expect(requests).toBe(0);
});

test('does not overwrite history after settings change in another tab', async ({
	page,
	context
}) => {
	await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'Mock failure' }));
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	const other = await context.newPage();
	await other.goto('/settings');
	await other.getByLabel('Keep text chat history in this browser').uncheck();
	await other.getByRole('button', { name: 'Save settings' }).click();
	await expect(page.getByRole('alert').filter({ hasText: 'changed in another tab' })).toBeVisible();
	const saved = await page.evaluate(() => localStorage.getItem('home-agent.chat-history.v1'));
	await page.getByLabel('Message').fill('Not saved in this tab');
	await page.getByRole('button', { name: 'Send' }).click();
	await expect(page.getByText('Not saved in this tab')).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('home-agent.chat-history.v1'))).toBe(saved);
});
