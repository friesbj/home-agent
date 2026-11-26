import { expect, test, type Page } from '@playwright/test';

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';

async function setup(page: Page) {
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
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

test('mobile navigation preserves a running response and its pending approval', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	let completeResponse: (() => void) | undefined;
	await page.route('**/api/chat', async (route) => {
		await new Promise<void>((resolve) => {
			completeResponse = resolve;
		});
		await route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'mobile-approval' },
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
	await expect(page.getByRole('region', { name: 'Home', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'Type', exact: true }).click();
	await expect(page.getByLabel('Message')).toBeInViewport();
	await send(page, 'Turn on the light');
	await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
	await page.getByRole('button', { name: 'Home', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Assistant', exact: true })).toBeHidden();
	await expect.poll(() => Boolean(completeResponse)).toBe(true);
	completeResponse?.();
	// Voice is unavailable while a confirmation is pending: the orb shows the conversation instead.
	await page.getByRole('button', { name: 'Start voice mode' }).click();
	await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
	await expect(page.getByRole('dialog', { name: 'Live conversation' })).toBeHidden();
	await page.getByRole('button', { name: 'Home', exact: true }).click();
	await page.getByRole('button', { name: 'Type', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
	await expect(page.getByText('Turn on the light', { exact: true })).toBeVisible();
});

test('scene shortcuts send a visible request through the confirmation flow', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	const requests: { messages: { parts: { text?: string }[] }[] }[] = [];
	await page.route('**/api/chat', async (route) => {
		requests.push(route.request().postDataJSON());
		await route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'scene-approval' },
				{
					type: 'tool-input-available',
					toolCallId: 'call',
					toolName: 'HassTurnOn',
					input: { name: 'Movie Night', domain: ['scene'] },
					dynamic: true
				},
				{
					type: 'tool-approval-request',
					toolCallId: 'call',
					approvalId: 'approval',
					reason: 'Activate Movie Night'
				},
				{ type: 'finish' }
			])
		});
	});
	await setup(page);
	await page.getByRole('button', { name: 'Movie Night' }).click();

	await expect(page.getByText('Activate the scene "Movie Night".', { exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
	expect(requests).toHaveLength(1);
	expect(requests[0].messages.at(-1)?.parts.map((part) => part.text)).toContain(
		'Activate the scene "Movie Night".'
	);

	await page.getByRole('button', { name: 'Home', exact: true }).click();
	const tile = page.getByRole('button', { name: 'Movie Night' });
	await expect(tile).toBeDisabled();
	await expect(page.getByText('Answer the pending confirmation first.')).toBeVisible();
	expect(requests).toHaveLength(1);
});

test('renders assistant Markdown and restored history without formatting user messages', async ({
	page
}) => {
	const longCode = 'x'.repeat(300);
	const wideHeader = `| ${Array.from({ length: 20 }, (_, i) => `Column ${i}`).join(' | ')} |`;
	const wideDivider = `| ${Array.from({ length: 20 }, () => '---').join(' | ')} |`;
	await page.route('**/api/chat', (route) =>
		route.fulfill({
			headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' },
			body: stream([
				{ type: 'start', messageId: 'markdown-reply' },
				{ type: 'text-start', id: 'text' },
				{
					type: 'text-delta',
					id: 'text',
					delta: `**Ready**\n\n| Device | State |\n| --- | --- |\n| Light | On |\n\n${wideHeader}\n${wideDivider}\n\n\`\`\`text\n${longCode}\n\`\`\``
				},
				{ type: 'text-end', id: 'text' },
				{ type: 'finish' }
			])
		})
	);
	await setup(page);
	await send(page, 'Show **status**');
	const assistant = page.getByRole('article', { name: 'Assistant' });
	await expect(assistant.locator('strong')).toHaveText('Ready');
	await expect(assistant.locator('table td')).toHaveText(['Light', 'On']);
	await expect(assistant.locator('pre code')).toHaveText(`${longCode}\n`);
	await expect(page.getByRole('article', { name: 'You' })).toContainText('Show **status**');
	await expect(page.getByRole('article', { name: 'You' }).locator('strong')).toHaveCount(0);
	expect(
		await assistant.locator('pre').evaluate((element) => element.scrollWidth > element.clientWidth)
	).toBe(true);
	expect(
		await assistant
			.locator('table')
			.nth(1)
			.evaluate((table) => {
				const wrapper = table.parentElement;
				return !!wrapper && wrapper.scrollWidth > wrapper.clientWidth;
			})
	).toBe(true);
	await expect(page.getByRole('button', { name: 'Send' })).toBeInViewport();

	await page.reload();
	const saved = page.getByLabel('Conversation').locator('option', { hasText: 'Show **status**' });
	await page.getByLabel('Conversation').selectOption((await saved.getAttribute('value')) as string);
	await expect(assistant.locator('strong')).toHaveText('Ready');
	await expect(assistant.locator('table td')).toHaveText(['Light', 'On']);
	await expect(assistant.locator('pre code')).toHaveText(`${longCode}\n`);
});

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

test('enables history for legacy disabled settings and clears it without removing credentials', async ({
	page
}) => {
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
	await page.evaluate(() => {
		const key = 'home-agent.settings.v1';
		const stored = JSON.parse(localStorage.getItem(key)!);
		stored.data.history = { enabled: false };
		localStorage.setItem(key, JSON.stringify(stored));
	});
	await page.reload();
	await send(page, 'Saved message');
	await expect(page.getByText('OK')).toBeVisible();
	const saved = page.getByLabel('Conversation').locator('option', { hasText: 'Saved message' });
	await expect(saved).toHaveCount(1);
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByText('Advanced settings', { exact: true }).click();
	await expect(page.getByLabel('Keep text chat history in this browser')).toHaveCount(0);
	await page.getByRole('link', { name: 'Back to assistant' }).click();
	await expect(page.getByText('Saved message', { exact: true })).toBeVisible();
	await page.reload();
	const old = page.getByLabel('Conversation').locator('option', { hasText: 'Saved message' });
	await page.getByLabel('Conversation').selectOption((await old.getAttribute('value')) as string);
	await expect(page.getByText('Saved message', { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Settings' }).click();
	await page.getByText('Data and privacy', { exact: true }).click();
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
	// The stale-tab alert can appear before the other tab has persisted its message.
	await expect
		.poll(() =>
			page.evaluate((id) => localStorage.getItem(`home-agent.chat-session.v1.${id}`), sessionId)
		)
		.toContain('Second tab change');
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
	await page.getByText('Data and privacy', { exact: true }).click();
	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Delete everything' }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
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
	await page.getByText('Data and privacy', { exact: true }).click();
	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Delete everything' }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
});
