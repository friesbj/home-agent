export interface ApiGuardOptions {
	allowedOrigins: string[];
	maxRequestBodyBytes: number;
}

export interface ApiGuardRejection {
	status: number;
	message: string;
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Same-origin and body-size checks for state-changing API requests. */
export function checkApiRequest(
	request: Request,
	url: URL,
	options: ApiGuardOptions
): ApiGuardRejection | null {
	if (SAFE_METHODS.has(request.method)) return null;

	const origin = request.headers.get('origin');
	if (!origin || (origin !== url.origin && !options.allowedOrigins.includes(origin))) {
		return { status: 403, message: 'Cross-origin requests are not allowed.' };
	}

	const contentLength = Number(request.headers.get('content-length') ?? 0);
	if (Number.isFinite(contentLength) && contentLength > options.maxRequestBodyBytes) {
		return { status: 413, message: 'Request body is too large.' };
	}

	return null;
}
