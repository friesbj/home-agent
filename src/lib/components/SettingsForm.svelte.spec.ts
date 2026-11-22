import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SettingsForm from './SettingsForm.svelte';
import { defaultConfirmationPolicy, defaultSettings } from '$lib/config/settings';

function renderForm(overrides: { serverHasOpenAiKey?: boolean } = {}) {
	const onsave = vi.fn();
	render(SettingsForm, {
		settings: defaultSettings(),
		confirmation: defaultConfirmationPolicy(),
		secretStatus: { openaiApiKey: 'missing', mcpToken: 'missing', homeAssistantToken: 'missing' },
		mcpUrlPolicy: { allowInsecureHttp: false, allowPrivateHosts: false },
		serverHasOpenAiKey: overrides.serverHasOpenAiKey ?? true,
		submitLabel: 'Save',
		onsave
	});
	return onsave;
}

describe('SettingsForm', () => {
	it('blocks submission and marks invalid fields', async () => {
		const onsave = renderForm({ serverHasOpenAiKey: false });
		await page.getByLabelText(/Server address/).fill('http://192.168.1.2');
		await page.getByRole('button', { name: 'Save' }).click();

		await expect
			.element(page.getByLabelText(/Server address/))
			.toHaveAttribute('aria-invalid', 'true');
		await expect.element(page.getByText(/private-network addresses are not allowed/)).toBeVisible();
		await expect.element(page.getByText(/OpenAI API key is required/)).toBeVisible();
		expect(onsave).not.toHaveBeenCalled();
	});

	it('saves normalized settings and entered secrets', async () => {
		const onsave = renderForm();
		await page.getByLabelText(/Server address/).fill(' https://MCP.example.com/mcp ');
		await page.getByLabelText('Authentication').selectOptions('bearer');
		await page.getByLabelText('MCP bearer token').fill('token-123');
		await page.getByRole('button', { name: 'Save' }).click();

		expect(onsave).toHaveBeenCalledOnce();
		const result = onsave.mock.calls[0][0];
		expect(result.settings.mcp).toMatchObject({
			url: 'https://mcp.example.com/mcp',
			authType: 'bearer'
		});
		expect(result.confirmation.mode).toBe('all');
		expect(result.secrets).toEqual({ mcpToken: 'token-123' });
	});

	it('requires acknowledgement before disabling confirmations', async () => {
		const onsave = renderForm();
		await page.getByLabelText(/Server address/).fill('https://mcp.example.com');
		await page.getByLabelText(/No confirmation/).click();
		await page.getByRole('button', { name: 'Save' }).click();
		await expect
			.element(page.getByText('Acknowledge the risk to disable confirmations.'))
			.toBeVisible();
		expect(onsave).not.toHaveBeenCalled();

		await page.getByLabelText(/I understand/).click();
		await page.getByRole('button', { name: 'Save' }).click();
		expect(onsave.mock.calls[0][0].confirmation).toMatchObject({
			mode: 'none',
			acknowledgedNoConfirmationRisk: true
		});
	});
});
