import type { HomeArea, HomeEntity } from '$lib/home/types';

export const UNASSIGNED_AREA = 'Other';

function unquote(value: string): string {
	const trimmed = value.trim();
	if (
		trimmed.length >= 2 &&
		((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
			(trimmed.startsWith('"') && trimmed.endsWith('"')))
	) {
		return trimmed.slice(1, -1).replace(/''/g, "'");
	}
	return trimmed;
}

function splitList(value: string): string[] {
	return unquote(value)
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

/**
 * Extracts the YAML-like text returned by Home Assistant's `GetLiveContext` tool. The tool may
 * return plain text or a JSON envelope like `{ "success": true, "result": "..." }`.
 */
export function extractLiveContextText(content: unknown): string {
	const parts = Array.isArray(content) ? content : [];
	const text = parts
		.filter((part): part is { type: 'text'; text: string } => part?.type === 'text')
		.map((part) => part.text)
		.join('\n');
	try {
		const parsed = JSON.parse(text) as { result?: unknown };
		if (typeof parsed?.result === 'string') return parsed.result;
	} catch {
		// plain text
	}
	return text;
}

/** Tolerant parser for the `GetLiveContext` overview (a YAML list of entities). */
export function parseLiveContext(text: string): HomeEntity[] {
	const entities: HomeEntity[] = [];
	let current: HomeEntity | null = null;
	let itemIndent = 0;
	let inAttributes = false;

	for (const rawLine of text.split(/\r?\n/)) {
		if (!rawLine.trim()) continue;
		const indent = rawLine.length - rawLine.trimStart().length;
		const line = rawLine.trim();

		const item = /^-\s+(\w+):\s*(.*)$/.exec(line);
		if (item) {
			current = { name: '', domain: '', state: '', areas: [], attributes: {} };
			entities.push(current);
			itemIndent = indent;
			inAttributes = false;
			assign(current, item[1], item[2]);
			continue;
		}

		const pair = /^([\w.-]+):\s*(.*)$/.exec(line);
		if (!current || !pair) continue;

		if (inAttributes && indent > itemIndent + 2) {
			current.attributes[pair[1]] = unquote(pair[2]);
			continue;
		}
		inAttributes = pair[1] === 'attributes' && pair[2] === '';
		if (!inAttributes) assign(current, pair[1], pair[2]);
	}

	return entities.filter((entity) => entity.name && entity.domain);
}

function assign(entity: HomeEntity, key: string, value: string) {
	switch (key) {
		case 'names':
		case 'name':
			entity.name = splitList(value)[0] ?? '';
			break;
		case 'domain':
			entity.domain = unquote(value);
			break;
		case 'state':
			entity.state = unquote(value);
			break;
		case 'areas':
		case 'area':
			entity.areas = splitList(value);
			break;
	}
}

export function groupByArea(entities: HomeEntity[]): HomeArea[] {
	const areas = new Map<string, HomeEntity[]>();
	for (const entity of entities) {
		const area = entity.areas[0] ?? UNASSIGNED_AREA;
		areas.set(area, [...(areas.get(area) ?? []), entity]);
	}
	return [...areas.entries()]
		.map(([name, list]) => ({
			name,
			entities: list.sort((a, b) => a.name.localeCompare(b.name))
		}))
		.sort((a, b) =>
			a.name === UNASSIGNED_AREA
				? 1
				: b.name === UNASSIGNED_AREA
					? -1
					: a.name.localeCompare(b.name)
		);
}
