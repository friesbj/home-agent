import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HomeOverview from './HomeOverview.svelte';
import { appConfig } from '$lib/config/app-config.svelte';
import { defaultConfirmationPolicy, defaultSettings } from '$lib/config/settings';
import type { HomeEntity, HomeState } from '$lib/home/types';

function configure() {
	const settings = defaultSettings();
	settings.mcp.url = 'https://ha.example.com/api/mcp';
	appConfig.save({ settings, confirmation: defaultConfirmationPolicy() });
}

const entity = (name: string, state: string, area: string): HomeEntity => ({
	name,
	domain: 'light',
	state,
	areas: [area],
	attributes: {}
});

afterEach(() => {
	appConfig.resetAll();
	vi.unstubAllGlobals();
});

describe('HomeOverview', () => {
	it('renders entities that share a name and domain within an area', async () => {
		configure();
		const state: HomeState = {
			fetchedAt: new Date().toISOString(),
			areas: [
				{
					name: 'Arbeitszimmer',
					entities: [
						entity('Licht', 'on', 'Arbeitszimmer'),
						entity('Licht', 'off', 'Arbeitszimmer')
					]
				}
			]
		};
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json(state))
		);

		render(HomeOverview);

		await expect.element(page.getByRole('heading', { name: 'Arbeitszimmer' })).toBeVisible();
		await expect.element(page.getByText('off', { exact: true })).toBeVisible();
	});
});
