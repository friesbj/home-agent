import type { HomeArea, HomeEntity, HomeState } from './types';

export interface LightSummary {
	total: number;
	on: number;
	off: number;
	unavailable: number;
}

export interface ClimateReading {
	name: string;
	area: string;
	value: number;
	unit: string;
}

export interface ClimateSummary {
	total: number;
	readings: ClimateReading[];
	/** Formatted value or range, e.g. "21.5 °C" or "19–22 °C"; empty without readings. */
	display: string;
	/** Where the display value comes from, e.g. "Living Room" or "3 devices". */
	detail: string;
}

export interface HomeSummary {
	deviceCount: number;
	lights: LightSummary;
	climate: ClimateSummary;
	scenes: string[];
	status: string;
}

const UNAVAILABLE = ['unavailable', 'unknown'];
const number = new Intl.NumberFormat('en', { maximumFractionDigits: 1 });

function entities(areas: HomeArea[]) {
	return areas.flatMap((area) => area.entities.map((entity) => ({ entity, area: area.name })));
}

function formatTemperature(value: number, unit: string) {
	return unit ? `${number.format(value)} ${unit}` : `${number.format(value)}°`;
}

export function summarizeLights(list: HomeEntity[]): LightSummary {
	const lights = list.filter((entity) => entity.domain === 'light');
	const on = lights.filter((entity) => entity.state === 'on').length;
	const unavailable = lights.filter((entity) => UNAVAILABLE.includes(entity.state)).length;
	return { total: lights.length, on, unavailable, off: lights.length - on - unavailable };
}

export function summarizeClimate(list: { entity: HomeEntity; area: string }[]): ClimateSummary {
	const climate = list.filter(({ entity }) => entity.domain === 'climate');
	const readings = climate.flatMap(({ entity, area }) => {
		const value = Number.parseFloat(entity.attributes.current_temperature ?? '');
		if (!Number.isFinite(value)) return [];
		return [{ name: entity.name, area, value, unit: entity.attributes.temperature_unit ?? '' }];
	});
	if (readings.length === 0) return { total: climate.length, readings, display: '', detail: '' };
	const unit = readings[0].unit;
	if (readings.length === 1) {
		return {
			total: climate.length,
			readings,
			display: formatTemperature(readings[0].value, unit),
			detail: readings[0].area
		};
	}
	const values = readings.map((reading) => reading.value);
	const min = Math.min(...values);
	const max = Math.max(...values);
	const display =
		min === max
			? formatTemperature(min, unit)
			: `${number.format(min)}–${formatTemperature(max, unit)}`;
	return { total: climate.length, readings, display, detail: `${readings.length} devices` };
}

function statusSentence(deviceCount: number, lights: LightSummary, climate: ClimateSummary) {
	if (deviceCount === 0) return 'No devices are shared with Home Agent yet.';
	const parts: string[] = [];
	if (lights.on > 0) parts.push(`${lights.on} ${lights.on === 1 ? 'light' : 'lights'} on`);
	else if (lights.total > 0 && lights.unavailable === 0) parts.push('All lights are off');
	if (climate.display) {
		parts.push(
			climate.readings.length === 1
				? `${climate.display} in ${climate.detail}`
				: `${climate.display} across ${climate.detail}`
		);
	}
	if (parts.length === 0)
		parts.push(`${deviceCount} ${deviceCount === 1 ? 'device' : 'devices'} available`);
	return parts.join(' · ');
}

/** Read-only summary of one fetched home state; never implies live data. */
export function summarizeHome(state: HomeState): HomeSummary {
	const list = entities(state.areas);
	const plain = list.map(({ entity }) => entity);
	const lights = summarizeLights(plain);
	const climate = summarizeClimate(list);
	const scenes = plain.filter((entity) => entity.domain === 'scene').map((entity) => entity.name);
	return {
		deviceCount: list.length,
		lights,
		climate,
		scenes: [...new Set(scenes)],
		status: statusSentence(list.length, lights, climate)
	};
}

export function greeting(date: Date, name = '') {
	const hour = date.getHours();
	const part =
		hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
	const trimmed = name.trim();
	return trimmed ? `Good ${part}, ${trimmed}` : `Good ${part}`;
}
