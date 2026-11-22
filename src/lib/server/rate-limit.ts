export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	retryAfterSeconds: number;
}

/** In-memory fixed-window rate limiter. Suitable for a single-instance private deployment. */
export class FixedWindowRateLimiter {
	private readonly windows = new Map<string, { start: number; count: number }>();

	constructor(
		private readonly maxRequests: number,
		private readonly windowMs: number,
		private readonly now: () => number = Date.now
	) {}

	check(key: string): RateLimitResult {
		const now = this.now();
		this.prune(now);

		let window = this.windows.get(key);
		if (!window || now - window.start >= this.windowMs) {
			window = { start: now, count: 0 };
			this.windows.set(key, window);
		}

		const retryAfterSeconds = Math.ceil((window.start + this.windowMs - now) / 1000);
		if (window.count >= this.maxRequests) {
			return { allowed: false, remaining: 0, retryAfterSeconds };
		}
		window.count++;
		return { allowed: true, remaining: this.maxRequests - window.count, retryAfterSeconds };
	}

	private prune(now: number) {
		if (this.windows.size < 10_000) return;
		for (const [key, window] of this.windows) {
			if (now - window.start >= this.windowMs) this.windows.delete(key);
		}
	}
}
