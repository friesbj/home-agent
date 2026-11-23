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
