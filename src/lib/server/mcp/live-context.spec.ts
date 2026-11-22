import { describe, expect, it } from 'vitest';
import { extractLiveContextText, groupByArea, parseLiveContext } from './live-context';

const SAMPLE = `Live Context: An overview of the areas and the devices in this smart home:
- names: Kitchen Light, Ceiling
  domain: light
  state: 'on'
  areas: Kitchen
  attributes:
    brightness: '50'
- names: Thermostat
  domain: climate
  state: heat
  areas: Living Room
  attributes:
    current_temperature: '21.5'
- names: Movie Night
  domain: scene
  state: '2026-11-22T10:00:00+00:00'
`;

describe('GetLiveContext parsing', () => {
	it('extracts text from plain and JSON-enveloped tool results', () => {
		expect(extractLiveContextText([{ type: 'text', text: 'plain' }])).toBe('plain');
		expect(
			extractLiveContextText([
				{ type: 'text', text: JSON.stringify({ success: true, result: SAMPLE }) }
			])
		).toBe(SAMPLE);
	});

	it('parses entities with quoted values and attributes', () => {
		const entities = parseLiveContext(SAMPLE);
		expect(entities).toHaveLength(3);
		expect(entities[0]).toEqual({
			name: 'Kitchen Light',
			domain: 'light',
			state: 'on',
			areas: ['Kitchen'],
			attributes: { brightness: '50' }
		});
		expect(entities[1].attributes.current_temperature).toBe('21.5');
	});

	it('groups by area and puts unassigned entities last', () => {
		const areas = groupByArea(parseLiveContext(SAMPLE));
		expect(areas.map((area) => area.name)).toEqual(['Kitchen', 'Living Room', 'Other']);
	});
});
