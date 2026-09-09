/**
 * Rate limiter Durable Object.
 *
 * Why a Durable Object rather than KV: KV writes are eventually consistent
 * across the edge, so two simultaneous requests in different colo can both
 * observe "under the limit" and both proceed. Login throttling must not be
 * bypassable that way. A single DO instance serialises every request for one
 * key, giving a strongly consistent counter.
 *
 * Model: sliding-window log trimmed to the window, stored in DO SQLite/KV
 * storage. For the small limits used here (login, signup, withdrawals,
 * support tickets) keeping timestamps is cheap and gives accurate
 * `retryAfterSeconds`.
 */
export interface RateLimitRequest {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAt: number;
}

export class RateLimiter {
  private readonly state: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let payload: RateLimitRequest;
    try {
      payload = (await request.json()) as RateLimitRequest;
    } catch {
      return new Response('Invalid payload', { status: 400 });
    }

    const limit = Math.max(1, Math.min(payload.limit ?? 0, 10_000));
    const windowSeconds = Math.max(1, Math.min(payload.windowSeconds ?? 60, 86_400));
    const result = await this.hit(limit, windowSeconds);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  private async hit(limit: number, windowSeconds: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;

    const stored = (await this.state.storage.get<number[]>('hits')) ?? [];
    const withinWindow = stored.filter((t) => t > windowStart);

    if (withinWindow.length >= limit) {
      const oldest = withinWindow[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowSeconds * 1000 - now) / 1000));
      // Keep the log trimmed even when rejecting, so a rejected client cannot
      // grow the object's storage without bound.
      await this.state.storage.put('hits', withinWindow);
      this.scheduleAlarm(windowSeconds);
      return { allowed: false, remaining: 0, retryAfterSeconds, resetAt: oldest + windowSeconds * 1000 };
    }

    withinWindow.push(now);
    await this.state.storage.put('hits', withinWindow);
    this.scheduleAlarm(windowSeconds);

    return {
      allowed: true,
      remaining: Math.max(0, limit - withinWindow.length),
      retryAfterSeconds: 0,
      resetAt: windowStart + windowSeconds * 1000,
    };
  }

  /** Alarms let idle objects drop their state without a cron sweep. */
  private scheduleAlarm(windowSeconds: number): void {
    const fireAt = Date.now() + windowSeconds * 1000 + 1000;
    void this.state.storage.getAlarm().then((existing) => {
      if (!existing || existing > fireAt) void this.state.storage.setAlarm(fireAt);
    });
  }

  async alarm(): Promise<void> {
    await this.state.storage.delete('hits');
  }
}

export default RateLimiter;
