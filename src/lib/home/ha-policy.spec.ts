import { describe, expect, it } from 'vitest';
import { baseToolName, classifyToolName, describeToolCall, evaluateToolCall } from './ha-policy';

describe('Home Assistant tool policy', () => {
	it('classifies tools by base name, including tool-set prefixes', () => {
		expect(baseToolName('homeassistant__GetLiveContext')).toBe('GetLiveContext');
		expect(classifyToolName('assist__GetLiveContext')).toBe('read');
		expect(classifyToolName('HassTurnOn')).toBe('mutation');
		expect(classifyToolName('homeassistant__call_service')).toBe('blocked');
		expect(classifyToolName('HassLockUnlock')).toBe('blocked');
		expect(classifyToolName('constructor')).toBe('blocked');
	});

	it('classifies tool names observed in the real Home Assistant discovery response', () => {
		const observed = {
			read: ['homeassistant__GetLiveContext', 'llm__GetDateTime'],
			mutation: [
				'climate__HassClimateSetTemperature',
				'intent__HassTurnOn',
				'intent__HassTurnOff',
				'light__HassLightSet'
			],
			blocked: [
				'assist_satellite__HassBroadcast',
				'calendar__get_events',
				'media_player__HassMediaPause',
				'todo__HassListAddItem',
				'config__reload_config_entry',
				'homeassistant__render_template',
				'homeassistant__call_action',
				'search__search'
			]
		} as const;
		for (const [kind, names] of Object.entries(observed)) {
			for (const name of names) expect(classifyToolName(name)).toBe(kind);
		}
	});

	it('allows mutations only for allowlisted domains', () => {
		expect(evaluateToolCall('HassTurnOn', { name: 'Kitchen', domain: ['light'] })).toMatchObject({
			kind: 'mutation',
			domains: ['light']
		});
		expect(evaluateToolCall('HassLightSet', { area: 'Office', brightness: 40 })).toMatchObject({
			kind: 'mutation',
			domains: ['light']
		});
		expect(evaluateToolCall('HassTurnOff', { name: 'Front door', domain: ['lock'] }).kind).toBe(
			'blocked'
		);
		expect(evaluateToolCall('HassTurnOn', { domain: ['light', 'cover'] }).kind).toBe('blocked');
		expect(evaluateToolCall('HassTurnOn', { name: 'Garage' })).toMatchObject({
			kind: 'blocked',
			reason: expect.stringContaining('domain')
		});
		expect(evaluateToolCall('GetLiveContext', {}).kind).toBe('read');
	});

	it('describes actions for confirmation prompts', () => {
		expect(
			describeToolCall('HassLightSet', { name: 'Desk lamp', area: 'Office', brightness: 40 })
		).toBe('Adjust light: name "Desk lamp", area "Office" (light) → brightness 40');
	});
});
