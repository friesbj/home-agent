import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import HomeOverview from './HomeOverview.svelte';
import { appConfig } from '$lib/config/app-config.svelte';
import { defaultConfirmationPolicy, defaultSettings } from '$lib/config/settings';
import type { HomeEntity, HomeState } from '$lib/home/types';

function configure(favoriteAreas: string[] = []) {
	const settings = defaultSettings();
	settings.mcp.url = 'https://ha.example.com/api/mcp';
	settings.favorites.areas = favoriteAreas;
	appConfig.save({ settings, confirmation: defaultConfirmationPolicy() });
}

const entity = (name: string, state: string, area: string): HomeEntity => ({
	name,
	domain: 'light',
	state,
	areas: [area],
	attributes: {}
});

function serve(state: Omit<HomeState, 'fetchedAt'>) {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => Response.json({ ...state, fetchedAt: new Date().toISOString() }))
	);
}

afterEach(() => {
	appConfig.resetAll();
	vi.unstubAllGlobals();
});

describe('HomeOverview', () => {
	it('renders entities that share a name and domain within an area', async () => {
		configure();
		serve({
			areas: [
				{
					name: 'Arbeitszimmer',
					entities: [
						entity('Licht', 'on', 'Arbeitszimmer'),
						entity('Licht', 'off', 'Arbeitszimmer')
					]
				}
			]
		});

		render(HomeOverview);

		await page.getByRole('heading', { name: 'Arbeitszimmer' }).click();
		await expect.element(page.getByText('off', { exact: true })).toBeVisible();
	});

	it('opens favorite areas, collapses the rest, and can expand all', async () => {
		configure(['Kitchen']);
		serve({
			areas: [
				{ name: 'Bedroom', entities: [entity('Bed lamp', 'off', 'Bedroom')] },
				{
					name: 'Kitchen',
					entities: [entity('Ceiling', 'on', 'Kitchen'), entity('Counter', 'off', 'Kitchen')]
				}
			]
		});

		render(HomeOverview);

		await expect.element(page.getByText('2 devices · 1 active')).toBeVisible();
		await expect.element(page.getByText('Ceiling')).toBeVisible();
		await expect.element(page.getByText('Bed lamp')).not.toBeVisible();

		await page.getByRole('button', { name: 'Expand all' }).click();
		await expect.element(page.getByText('Bed lamp')).toBeVisible();

		await page.getByRole('button', { name: 'Collapse all' }).click();
		await expect.element(page.getByText('Ceiling')).not.toBeVisible();
	});
});
