/**
 * Tool allowlist for the official Home Assistant "Model Context Protocol Server" integration
 * (Assist "Device control" tools). Anything not listed here is never exposed to the model,
 * including the administrator "Home Assistant" tool set (for example "Call action").
 */

export const ALLOWED_MUTATION_DOMAINS = ['light', 'climate', 'scene', 'script'] as const;

const READ_TOOLS = new Set([
	'GetLiveContext',
	'GetDateTime',
	'HassGetState',
	'HassGetWeather',
	'HassClimateGetTemperature'
]);

type DomainResolver = (input: Record<string, unknown>) => string[] | undefined;

const fromDomainArgument: DomainResolver = (input) => {
	const value = input.domain;
	if (typeof value === 'string') return [value];
	if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return value;
	return undefined;
};

const MUTATION_TOOLS: Record<string, { verb: string; domains: DomainResolver }> = {
	HassTurnOn: { verb: 'Turn on / activate', domains: fromDomainArgument },
	HassTurnOff: { verb: 'Turn off', domains: fromDomainArgument },
	HassLightSet: { verb: 'Adjust light', domains: () => ['light'] },
	HassClimateSetTemperature: { verb: 'Set temperature', domains: () => ['climate'] }
};

export type ToolKind = 'read' | 'mutation' | 'blocked';

export type ToolCallEvaluation =
	| { kind: 'read' }
	| { kind: 'mutation'; domains: string[]; summary: string }
	| { kind: 'blocked'; reason: string };

/** Home Assistant may prefix tool names with their tool set, e.g. `homeassistant__GetLiveContext`. */
export function baseToolName(name: string): string {
	const index = name.lastIndexOf('__');
	return index >= 0 ? name.slice(index + 2) : name;
}

export function classifyToolName(name: string): ToolKind {
	const base = baseToolName(name);
	if (READ_TOOLS.has(base)) return 'read';
	if (Object.hasOwn(MUTATION_TOOLS, base)) return 'mutation';
	return 'blocked';
}

function asRecord(input: unknown): Record<string, unknown> {
	return input && typeof input === 'object' && !Array.isArray(input)
		? (input as Record<string, unknown>)
		: {};
}

function describeTarget(input: Record<string, unknown>): string {
	const parts: string[] = [];
	for (const key of ['name', 'area', 'floor'] as const) {
		const value = input[key];
		if (typeof value === 'string' && value.trim()) parts.push(`${key} "${value.trim()}"`);
	}
	return parts.length > 0 ? parts.join(', ') : 'all matching devices';
}

const DETAIL_KEYS = ['brightness', 'color', 'temperature', 'position'] as const;

export function describeToolCall(name: string, rawInput: unknown): string {
	const input = asRecord(rawInput);
	const base = baseToolName(name);
	const rule = Object.hasOwn(MUTATION_TOOLS, base) ? MUTATION_TOOLS[base] : undefined;
	const domains = rule?.domains(input);
	const details = DETAIL_KEYS.filter((key) => input[key] !== undefined).map(
		(key) => `${key} ${JSON.stringify(input[key])}`
	);
	return [
		`${rule?.verb ?? base}: ${describeTarget(input)}`,
		domains?.length ? `(${domains.join(', ')})` : '',
		details.length ? `→ ${details.join(', ')}` : ''
	]
		.filter(Boolean)
		.join(' ');
}

/** Server-side authorization of a single tool call. Never trusts client state. */
export function evaluateToolCall(name: string, rawInput: unknown): ToolCallEvaluation {
	const base = baseToolName(name);
	if (READ_TOOLS.has(base)) return { kind: 'read' };

	if (!Object.hasOwn(MUTATION_TOOLS, base)) {
		return { kind: 'blocked', reason: `The tool "${base}" is not allowed.` };
	}

	const input = asRecord(rawInput);
	const domains = MUTATION_TOOLS[base].domains(input);
	const allowed = ALLOWED_MUTATION_DOMAINS as readonly string[];
	if (!domains || domains.length === 0) {
		return {
			kind: 'blocked',
			reason: `Specify the "domain" argument (${allowed.join(', ')}) when calling ${base}.`
		};
	}
	const disallowed = domains.filter((domain) => !allowed.includes(domain));
	if (disallowed.length > 0) {
		return {
			kind: 'blocked',
			reason: `Changing ${disallowed.join(', ')} devices is not allowed. Allowed: ${allowed.join(', ')}.`
		};
	}
	return { kind: 'mutation', domains, summary: describeToolCall(name, input) };
}
