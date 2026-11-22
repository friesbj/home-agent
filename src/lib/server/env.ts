import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';
import { parseServerEnv, type ServerEnv } from './env-schema';

let cached: ServerEnv | undefined;

/** Validated server configuration. Throws `ServerEnvError` on invalid values. */
export function getServerEnv(): ServerEnv {
	cached ??= parseServerEnv(env, { dev });
	return cached;
}
