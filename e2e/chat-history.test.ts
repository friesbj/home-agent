import { expect, test, type Page } from '@playwright/test';

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';

async function setup(page: Page) {
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
}

function stream(events: object[]) {
	return `${events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')}data: [DONE]\n\n`;
}

async function send(page: Page, text: string) {
	await page.getByLabel('Message').fill(text);
	await page.getByRole('button', { name: 'Send' }).click();
}

test('starts new sessions on reload and resumes selected context, preserving it through Settings', async ({
	page
}) => {
	const requests: { messages: { parts: { text?: string }[] }[] }[] = [];
	await page.route('**/api/chat', async (route) => {
		requests.push(route.request().postDataJSON());
		await route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: `response-${requests.length}` },
				{ type: 'text-start', id: 'text' },
				{ type: 'text-delta', id: 'text', delta: `Response ${requests.length}` },
				{ type: 'text-end', id: 'text' },
				{ type: 'finish' }
			])
		});
	});
	await setup(page);
	await page.evaluate(() => localStorage.setItem('home-agent.chat-history.v1', 'legacy'));
	await send(page, 'First conversation');
	await expect(page.getByText('Response 1')).toBeVisible();
	await expect(
		page.getByLabel('Conversation').locator('option', { hasText: 'First conversation' })
	).toHaveCount(1);
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('First conversation', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText('First conversation', { exact: true })).toHaveCount(0);
	await expect
		.poll(() => page.evaluate(() => localStorage.getItem('home-agent.chat-history.v1')))
		.toBeNull();
	await send(page, 'Second conversation');
	await expect(page.getByText('Response 2')).toBeVisible();
	const first = page
		.getByLabel('Conversation')
		.locator('option', { hasText: 'First conversation' });
	await page.getByLabel('Conversation').selectOption((await first.getAttribute('value')) as string);
	await expect(page.getByText('First conversation', { exact: true })).toBeVisible();
	await expect(page.getByText('Second conversation', { exact: true })).toHaveCount(0);
	await send(page, 'Continue first');
	await expect(page.getByText('Response 3')).toBeVisible();
	expect(
		requests[2].messages.flatMap((message) => message.parts).map((part) => part.text)
	).toContain('First conversation');
	expect(
		requests[2].messages.flatMap((message) => message.parts).map((part) => part.text)
	).not.toContain('Second conversation');
});

test('cancels pending approval on switch and does not restore it', async ({ page }) => {
	let requests = 0;
	await page.route('**/api/chat', async (route) => {
		requests++;
		await route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'approval-message' },
				{
					type: 'tool-input-available',
					toolCallId: 'call',
					toolName: 'HassTurnOn',
					input: { domain: ['light'] },
					dynamic: true
				},
				{
					type: 'tool-approval-request',
					toolCallId: 'call',
					approvalId: 'approval',
					reason: 'Turn on light'
				},
				{ type: 'finish' }
			])
		});
	});
	await setup(page);
	await send(page, 'Turn on the light');
	await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
	await page.getByRole('button', { name: 'New chat' }).click();
	await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
	await expect(page.getByText(/previous response was interrupted/i)).toBeVisible();
	const previous = page
		.getByLabel('Conversation')
		.locator('option', { hasText: 'Turn on the light' });
	await page
		.getByLabel('Conversation')
		.selectOption((await previous.getAttribute('value')) as string);
	await expect(page.getByText(/previous response or tool action was interrupted/i)).toBeVisible();
	await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
	expect(requests).toBe(1);
});

test('isolates an interrupted response from the newly selected chat', async ({ page }) => {
	let completeResponse: (() => void) | undefined;
	let responseFinished: (() => void) | undefined;
	const finished = new Promise<void>((resolve) => {
		responseFinished = resolve;
	});
	await page.route('**/api/chat', async (route) => {
		await new Promise<void>((resolve) => {
			completeResponse = resolve;
		});
		await route
			.fulfill({
				headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
				body: stream([
					{ type: 'start', messageId: 'late' },
					{ type: 'text-start', id: 't' },
					{ type: 'text-delta', id: 't', delta: 'Late response' },
					{ type: 'text-end', id: 't' },
					{ type: 'finish' }
				])
			})
			.catch(() => undefined);
		responseFinished?.();
	});
	await setup(page);
	await send(page, 'Waiting for a response');
	await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
	await page.getByRole('button', { name: 'New chat' }).click();
	await expect(page.getByText(/previous response was interrupted/i)).toBeVisible();
	completeResponse?.();
	await finished;
	await expect(page.getByText('Late response')).toHaveCount(0);
	await expect(page.getByText('Waiting for a response', { exact: true })).toHaveCount(0);
});

test('reports invalid stored sessions without overwriting them', async ({ page }) => {
	await setup(page);
	await page.evaluate(() => localStorage.setItem('home-agent.chat-session.v1.invalid', '{broken'));
	await page.reload();
	await expect(
		page.getByRole('alert').filter({ hasText: 'Chat history could not be loaded' })
	).toBeVisible();
	expect(
		await page.evaluate(() => localStorage.getItem('home-agent.chat-session.v1.invalid'))
	).toBe('{broken');
});

test('honors disabled history and clear history while preserving credentials', async ({ page }) => {
	await page.route('**/api/chat', (route) =>
		route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'reply' },
				{ type: 'text-start', id: 't' },
				{ type: 'text-delta', id: 't', delta: 'OK' },
				{ type: 'text-end', id: 't' },
				{ type: 'finish' }
			])
		})
	);
	await setup(page);
	await send(page, 'Saved message');
	await expect(page.getByText('OK')).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByLabel('Keep text chat history in this browser').uncheck();
	await page.getByRole('button', { name: 'Save settings' }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Saved message', { exact: true })).toBeVisible();
	await send(page, 'Not saved');
	await expect(page.getByText('Not saved', { exact: true })).toBeVisible();
	await page.reload();
	await expect(page.getByText('Not saved', { exact: true })).toHaveCount(0);
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByLabel('Keep text chat history in this browser').check();
	await page.getByRole('button', { name: 'Save settings' }).click();
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	const old = page.getByLabel('Conversation').locator('option', { hasText: 'Saved message' });
	await page.getByLabel('Conversation').selectOption((await old.getAttribute('value')) as string);
	await expect(page.getByText('Saved message', { exact: true })).toBeVisible();
	await expect(page.getByText('Not saved', { exact: true })).toHaveCount(0);
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Clear chat history' }).click();
	await page.getByRole('button', { name: 'Delete history', exact: true }).click();
	await expect(page.getByText('Chat history deleted from this browser.')).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'Stored credentials' }).getByText('Stored', { exact: true })
	).toHaveCount(2);
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Saved message', { exact: true })).toHaveCount(0);
});

test('keeps new tabs independent and stops stale writes to a shared session', async ({
	page,
	context
}) => {
	await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'Mock failure' }));
	await setup(page);
	await send(page, 'First tab session');
	await expect(
		page.getByLabel('Conversation').locator('option', { hasText: 'First tab session' })
	).toHaveCount(1);
	const other = await context.newPage();
	await other.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'Mock failure' }));
	await other.goto('/');
	await expect(other.getByText('First tab session', { exact: true })).toHaveCount(0);
	await send(other, 'Independent second session');
	await expect(
		other.getByLabel('Conversation').locator('option', { hasText: 'Independent second session' })
	).toHaveCount(1);
	await expect(page.getByText('First tab session', { exact: true })).toBeVisible();
	await expect(page.getByRole('alert').filter({ hasText: 'changed in another tab' })).toHaveCount(
		0
	);
	const first = other
		.getByLabel('Conversation')
		.locator('option', { hasText: 'First tab session' });
	await other
		.getByLabel('Conversation')
		.selectOption((await first.getAttribute('value')) as string);
	await expect(other.getByText('First tab session', { exact: true })).toBeVisible();
	await send(other, 'Second tab change');
	await expect(page.getByRole('alert').filter({ hasText: 'changed in another tab' })).toBeVisible();
	const sessionId = await other.getByLabel('Conversation').inputValue();
	const saved = await page.evaluate(
		(id) => localStorage.getItem(`home-agent.chat-session.v1.${id}`),
		sessionId
	);
	await send(page, 'Stale tab change');
	await expect(page.getByText('Stale tab change', { exact: true })).toBeVisible();
	expect(
		await page.evaluate((id) => localStorage.getItem(`home-agent.chat-session.v1.${id}`), sessionId)
	).toBe(saved);
});

test('reset all clears the active in-memory session as well as storage', async ({ page }) => {
	await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'Mock failure' }));
	await setup(page);
	await send(page, 'Before reset');
	await expect(
		page.getByLabel('Conversation').locator('option', { hasText: 'Before reset' })
	).toHaveCount(1);
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Delete everything' }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');
	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page.getByText('Before reset', { exact: true })).toHaveCount(0);
});

test('keeps chat and reset usable when browser locking is unavailable', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'locks', { value: undefined });
	});
	await page.route('**/api/chat', (route) => route.fulfill({ status: 500, body: 'Mock failure' }));
	await setup(page);
	await expect(
		page.getByRole('alert').filter({ hasText: 'Chat history could not be initialized' })
	).toBeVisible();
	await send(page, 'Still usable');
	await expect(page.getByText('Still usable', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Delete everything' }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
});
