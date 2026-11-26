import { expect, test } from '@playwright/test';

test('first run requires onboarding, then settings can manage and reset data', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveURL(/\/onboarding$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome to Home Agent');

	await expect(page.locator('input:visible, select:visible, textarea:visible')).toHaveCount(3);
	await page.getByLabel(/Server address/).fill('https://mcp.example.com/mcp');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page.getByText(/Enter the access token/)).toBeVisible();
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();

	await expect(page).toHaveURL(/\/$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Home Agent');

	await page.getByRole('link', { name: 'Settings' }).click();
	await expect(page.getByLabel(/Server address/)).toHaveValue('https://mcp.example.com/mcp');
	await page.getByText('Data and privacy', { exact: true }).click();
	const credentials = page.getByRole('region', { name: 'Stored credentials' });
	await expect(credentials.getByText('Stored', { exact: true })).toHaveCount(2);
	await expect(page.getByText('sk-e2e-test')).toHaveCount(0);

	await page.getByRole('button', { name: 'Reset all data' }).click();
	await page.getByRole('button', { name: 'Delete everything' }).click();
	await expect(page).toHaveURL(/\/onboarding$/);
	expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('declares the app icons and serves them', async ({ page, request }) => {
	await page.goto('/onboarding');
	const links = await page
		.locator('link[rel="icon"], link[rel="apple-touch-icon"]')
		.evaluateAll((elements) => elements.map((element) => (element as HTMLLinkElement).href));
	expect(links).toHaveLength(3);
	for (const href of links) {
		const response = await request.get(href);
		expect(response.ok(), href).toBe(true);
		expect((await response.body()).length, href).toBeGreaterThan(100);
	}
	const svg = links.find((href) => href.endsWith('.svg'));
	expect((await request.get(svg as string)).headers()['content-type']).toContain('image/svg+xml');
	await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0b142d');
});

test('filters and selects a natural voice using the keyboard', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.goto('/onboarding');
	await page.getByText('Advanced settings', { exact: true }).click();
	const voices = page.getByRole('group', { name: 'Voice', exact: true });
	await voices.getByLabel('Search').fill('ripple');
	await expect(voices.getByRole('radio')).toHaveCount(1);
	await voices.getByLabel('Language').selectOption('English');
	await voices.getByLabel('Presentation').selectOption('Masculine');
	const ripple = voices.getByRole('radio', { name: /Ripple/ });
	await ripple.focus();
	await page.keyboard.press('Space');
	await expect(ripple).toBeChecked();
	await voices.getByLabel('Presentation').selectOption('Feminine');
	await expect(voices.getByText('No natural voices match these filters.')).toBeVisible();
	await voices.getByLabel('Presentation').selectOption('Masculine');
	await page.getByLabel(/Server address/).fill('https://mcp.example.com/mcp');
	await page.getByLabel('Access token', { exact: true }).fill('e2e-mcp-token');
	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();
	await expect(page).toHaveURL(/\/$/);
	await page.goto('/settings');
	await page.getByText('Advanced settings', { exact: true }).click();
	await expect(page.getByRole('radio', { name: /Ripple/ })).toBeChecked();
});
