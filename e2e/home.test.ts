import { expect, test } from '@playwright/test';

const MCP_URL = 'http://127.0.0.1:4180/api/mcp';

test('tests the MCP connection during onboarding and shows the home overview', async ({ page }) => {
	await page.goto('/onboarding');
	await page.getByLabel(/Server address/).fill(MCP_URL);
	await page.getByLabel('Authentication').selectOption('bearer');

	await page.getByLabel('MCP bearer token').fill('wrong-token');
	await page.getByRole('button', { name: 'Test connection' }).click();
	await expect(page.getByText('The MCP server rejected the credentials.')).toBeVisible();

	await page.getByLabel('MCP bearer token').fill('e2e-mcp-token');
	await page.getByRole('button', { name: 'Test connection' }).click();
	await expect(
		page.getByText(
			'Connected to Fake Home Assistant: 1 read-only and 1 control tools available, 1 blocked by policy.'
		)
	).toBeVisible();

	await page.getByLabel('OpenAI API key').fill('sk-e2e-test');
	await page.getByRole('button', { name: 'Finish setup' }).click();

	const home = page.getByRole('region', { name: 'Your home' });
	await expect(home.getByRole('heading', { name: 'Kitchen' })).toBeVisible();
	await expect(home.getByText('Kitchen Light')).toBeVisible();
	await expect(home.getByRole('heading', { name: 'Living Room' })).toBeVisible();
	await expect(home.getByText('heat')).toBeVisible();
});
