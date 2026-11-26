import { page } from 'vitest/browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import '../../routes/layout.css';
import HomeView from './HomeView.svelte';
import { appConfig } from '$lib/config/app-config.svelte';
import { defaultConfirmationPolicy, defaultSettings } from '$lib/config/settings';
import type { HomeEntity, HomeState } from '$lib/home/types';

function configure(favoriteAreas: string[] = []) {
	const settings = defaultSettings();
	settings.mcp.url = 'https://ha.example.com/api/mcp';
	settings.favorites.areas = favoriteAreas;
	appConfig.save({ settings, confirmation: defaultConfirmationPolicy() });
}

const entity = (name: string, state: string, area: string, domain = 'light'): HomeEntity => ({
	name,
	domain,
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

function renderHome(shortcutBlockedReason = '') {
	const onshortcut = vi.fn();
	render(HomeView, {
		onopenassistant: vi.fn(),
		onstartvoice: vi.fn(),
		onshortcut,
		shortcutBlockedReason
	});
	return onshortcut;
}

afterEach(() => {
	appConfig.resetAll();
	vi.unstubAllGlobals();
});

describe('HomeView', () => {
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

		renderHome();

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

		renderHome();

		await expect.element(page.getByText('2 devices · 1 active')).toBeVisible();
		await expect.element(page.getByText('Ceiling')).toBeVisible();
		await expect.element(page.getByText('Bed lamp')).not.toBeVisible();

		await page.getByRole('button', { name: 'Expand all' }).click();
		await expect.element(page.getByText('Bed lamp')).toBeVisible();

		await page.getByRole('button', { name: 'Collapse all' }).click();
		await expect.element(page.getByText('Ceiling')).not.toBeVisible();
	});

	it('greets by name, summarizes lights, and filters rooms by the selected summary', async () => {
		configure();
		const settings = { ...appConfig.settings, profile: { displayName: 'Alex' } };
		appConfig.save({ settings, confirmation: defaultConfirmationPolicy() });
		serve({
			areas: [
				{ name: 'Bedroom', entities: [entity('Bed lamp', 'off', 'Bedroom')] },
				{ name: 'Kitchen', entities: [entity('Thermostat', 'heat', 'Kitchen', 'climate')] }
			]
		});

		renderHome();

		await expect.element(page.getByRole('heading', { name: /, Alex$/ })).toBeVisible();
		await expect.element(page.getByText('All lights are off')).toBeVisible();
		const lights = page.getByRole('button', { name: /^Lights: 0 on, 1 off/ });
		await lights.click();
		await expect.element(lights).toHaveAttribute('aria-pressed', 'true');
		await expect.element(page.getByText('Bed lamp')).toBeVisible();
		await expect.element(page.getByRole('heading', { name: 'Kitchen' })).not.toBeInTheDocument();
		await page.getByRole('button', { name: 'Show all devices' }).click();
		await expect.element(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible();
	});

	it('sends scene shortcuts as visible requests and disables them with a reason', async () => {
		configure();
		serve({
			areas: [{ name: 'Lounge', entities: [entity('Movie', 'unknown', 'Lounge', 'scene')] }]
		});

		const onshortcut = renderHome();
		await page.getByRole('button', { name: 'Movie' }).click();
		expect(onshortcut).toHaveBeenCalledWith('Activate the scene "Movie".');
	});

	it('truncates long scene names without changing tile height or the shortcut', async () => {
		configure();
		const longName = 'A very long scene name that does not fit on the tile';
		const unbrokenName = 'AnExtremelyLongSceneNameWithoutSpaces';
		serve({
			areas: [
				{
					name: 'Lounge',
					entities: [
						entity('Movie', 'unknown', 'Lounge', 'scene'),
						entity(longName, 'unknown', 'Lounge', 'scene'),
						entity(unbrokenName, 'unknown', 'Lounge', 'scene')
					]
				}
			]
		});

		const onshortcut = renderHome();
		const shortTile = page.getByRole('button', { name: 'Movie' });
		const longTile = page.getByRole('button', { name: longName });
		await expect.element(longTile).toBeVisible();
		const shortHeight = shortTile.element().getBoundingClientRect().height;
		for (const name of [longName, unbrokenName]) {
			const tile = page.getByRole('button', { name }).element();
			const label = tile.lastElementChild;
			if (!(label instanceof HTMLElement)) throw new Error('Scene label is missing.');
			expect(tile.getBoundingClientRect().height).toBe(shortHeight);
			expect(label.scrollWidth).toBeGreaterThan(label.clientWidth);
			expect(getComputedStyle(label).textOverflow).toBe('ellipsis');
			expect(getComputedStyle(label).whiteSpace).toBe('nowrap');
			expect(getComputedStyle(label).overflowX).toBe('hidden');
			expect(tile.getAttribute('title')).toBe(name);
		}
		await longTile.click();
		expect(onshortcut).toHaveBeenCalledWith(`Activate the scene "${longName}".`);
	});

	it('explains why scene shortcuts are unavailable', async () => {
		configure();
		serve({
			areas: [{ name: 'Lounge', entities: [entity('Movie', 'unknown', 'Lounge', 'scene')] }]
		});

		renderHome('Answer the pending confirmation first.');
		const tile = page.getByRole('button', { name: 'Movie' });
		await expect.element(tile).toBeDisabled();
		await expect
			.element(tile)
			.toHaveAccessibleDescription('Answer the pending confirmation first.');
	});
});
