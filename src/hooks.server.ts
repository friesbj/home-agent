import type { Handle, ServerInit } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { getServerEnv } from '$lib/server/env';
import { FixedWindowRateLimiter } from '$lib/server/rate-limit';
import { checkApiRequest } from '$lib/server/request-guard';

let apiRateLimiter: FixedWindowRateLimiter | undefined;

function getRateLimiter() {
	const { rateLimit } = getServerEnv();
	apiRateLimiter ??= new FixedWindowRateLimiter(rateLimit.maxRequests, rateLimit.windowMs);
	return apiRateLimiter;
}

export const init: ServerInit = () => {
	// Fail fast on invalid configuration instead of on the first request.
	getRateLimiter();
};

export const handle: Handle = async ({ event, resolve }) => {
	const requestId = crypto.randomUUID();
	event.locals.requestId = requestId;

	if (event.url.pathname.startsWith('/api/')) {
		const rejection = checkApiRequest(event.request, event.url, getServerEnv());
		if (rejection) {
			return json(
				{ error: rejection.message, requestId },
				{ status: rejection.status, headers: { 'x-request-id': requestId } }
			);
		}

		const limit = getRateLimiter().check(event.getClientAddress());
		if (!limit.allowed) {
			return json(
				{ error: 'Too many requests. Please wait and try again.', requestId },
				{
					status: 429,
					headers: { 'retry-after': String(limit.retryAfterSeconds), 'x-request-id': requestId }
				}
			);
		}
	}

	const response = await resolve(event);
	response.headers.set('x-request-id', requestId);
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'no-referrer');
	return response;
};
