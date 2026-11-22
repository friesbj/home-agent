export const REDACTED = '[redacted]';

const SENSITIVE_KEY = /(api[-_]?key|token|secret|password|authorization|cookie|credential)/i;

export function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEY.test(key);
}

/** Returns a deep copy with values of sensitive-looking keys replaced. Safe for logs and diagnostics. */
export function redactSecrets<T>(value: T): T {
	if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T;
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value).map(([key, entry]) => [
				key,
				isSensitiveKey(key) && entry !== undefined && entry !== null && entry !== ''
					? REDACTED
					: redactSecrets(entry)
			])
		) as T;
	}
	return value;
}

export type SecretStatus = 'stored' | 'missing';

export function secretStatus(value: string | undefined | null): SecretStatus {
	return value ? 'stored' : 'missing';
}
