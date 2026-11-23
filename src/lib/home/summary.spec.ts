import { describe, expect, it } from 'vitest';
import { greeting, summarizeHome } from './summary';
import type { HomeEntity, HomeState } from './types';

function entity(
	name: string,
	domain: string,
	state: string,
	attributes: Record<string, string> = {}
): HomeEntity {
	return { name, domain, state, areas: [], attributes };
}

function home(areas: Record<string, HomeEntity[]>): HomeState {
	return {
		fetchedAt: '2026-11-23T20:00:00.000Z',
		areas: Object.entries(areas).map(([name, entities]) => ({ name, entities }))
	};
}

describe('home summary', () => {
	it('counts lights and reports a single climate reading with its area', () => {
		const summary = summarizeHome(
			home({
				Kitchen: [entity('Ceiling', 'light', 'on'), entity('Spot', 'light', 'off')],
				'Living Room': [
					entity('Lamp', 'light', 'on'),
					entity('Thermostat', 'climate', 'heat', {
						current_temperature: '21.5',
						temperature_unit: '°C'
					})
				]
			})
		);
		expect(summary.lights).toEqual({ total: 3, on: 2, off: 1, unavailable: 0 });
		expect(summary.climate.display).toBe('21.5 °C');
		expect(summary.status).toBe('2 lights on · 21.5 °C in Living Room');
	});

	it('shows a temperature range for several climate devices and ignores missing readings', () => {
		const summary = summarizeHome(
			home({
				A: [entity('A', 'climate', 'heat', { current_temperature: '19', temperature_unit: '°C' })],
				B: [
					entity('B', 'climate', 'cool', { current_temperature: '22.25', temperature_unit: '°C' })
				],
				C: [entity('C', 'climate', 'off')]
			})
		);
		expect(summary.climate).toMatchObject({ total: 3, display: '19–22.3 °C', detail: '2 devices' });
		expect(summary.status).toBe('19–22.3 °C across 2 devices');
	});

	it('does not claim lights are off when some are unavailable', () => {
		expect(
			summarizeHome(home({ A: [entity('A', 'light', 'off'), entity('B', 'light', 'unavailable')] }))
				.status
		).toBe('2 devices available');
		expect(summarizeHome(home({ A: [entity('A', 'light', 'off')] })).status).toBe(
			'All lights are off'
		);
	});

	it('lists unique scenes and handles an empty home', () => {
		const summary = summarizeHome(
			home({ A: [entity('Movie', 'scene', 'unknown')], B: [entity('Movie', 'scene', 'unknown')] })
		);
		expect(summary.scenes).toEqual(['Movie']);
		expect(summarizeHome(home({})).status).toBe('No devices are shared with Home Agent yet.');
	});

	it('greets by time of day with an optional name', () => {
		expect(greeting(new Date(2026, 0, 1, 7), ' Alex ')).toBe('Good morning, Alex');
		expect(greeting(new Date(2026, 0, 1, 13))).toBe('Good afternoon');
		expect(greeting(new Date(2026, 0, 1, 2))).toBe('Good evening');
	});
});
