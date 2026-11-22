import { redactSecrets } from '$lib/security/redact';

type Level = 'info' | 'warn' | 'error';

/** Structured, secret-redacted server log line. */
export function logEvent(level: Level, event: string, fields: Record<string, unknown> = {}) {
	const line = JSON.stringify(
		redactSecrets({ time: new Date().toISOString(), level, event, ...fields })
	);
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.info(line);
}

export function errorName(error: unknown): string {
	return error instanceof Error ? error.name : typeof error;
}
