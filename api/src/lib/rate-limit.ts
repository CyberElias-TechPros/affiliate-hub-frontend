import type { Env } from './env';
import { HttpError } from './errors';

export interface RateLimitOutcome {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Coarse per-key rate limiting backed by the RateLimiter Durable Object.
 *
 * Failure mode is deliberate: if the DO is unreachable we allow the request
 * and log. Brute-force protection on credentials does NOT depend on this —
 * that is enforced by a durable failed-attempt counter in D1
 * (`registerFailedLogin` / `clearFailedLogins` in `security.ts`), which cannot
 * fail open. This layer exists to shed abusive traffic cheaply.
 */
export async function checkRateLimit(
  env: Env,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  try {
    const id = env.RATE_LIMIT.idFromName(key);
    const stub = env.RATE_LIMIT.get(id);
    const response = await stub.fetch('https://rate-limit/check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit, windowSeconds }),
    });
    if (!response.ok) throw new Error(`rate limiter responded ${response.status}`);
    return (await response.json()) as RateLimitOutcome;
  } catch (error) {
    console.warn('rate_limit_unavailable', { key, error: (error as Error).message });
    return { allowed: true, remaining: limit, retryAfterSeconds: 0 };
  }
}

/** Throws `429` when the key is over its budget. */
export async function enforceRateLimit(
  env: Env,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitOutcome> {
  const outcome = await checkRateLimit(env, `${bucket}:${key}`, limit, windowSeconds);
  if (!outcome.allowed) {
    throw HttpError.rateLimited(
      `Too many attempts. Please wait ${outcome.retryAfterSeconds}s and try again.`,
    );
  }
  return outcome;
}

/** Response headers that tell a well-behaved client when to back off. */
export function rateLimitHeaders(outcome: RateLimitOutcome, limit: number): Record<string, string> {
  return {
    'x-ratelimit-limit': String(limit),
    'x-ratelimit-remaining': String(outcome.remaining),
    ...(outcome.retryAfterSeconds > 0 ? { 'retry-after': String(outcome.retryAfterSeconds) } : {}),
  };
}
