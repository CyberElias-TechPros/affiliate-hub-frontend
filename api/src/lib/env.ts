/**
 * Cloudflare Workers environment bindings.
 *
 * Every service declared here is justified by an actual code path:
 *   DB         — D1, all relational data.
 *   CACHE      — KV, read-heavy public catalogue + FX rate cache.
 *   ASSETS     — R2, promo artwork and avatar uploads (binaries never go in D1).
 *   RATE_LIMIT — Durable Object, strongly consistent per-key counters.
 *   PAYOUTS    — Queue, asynchronous payout settlement + notification fan-out.
 *
 * Nothing here is speculative; remove a binding and the code that uses it
 * fails to compile.
 */
export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  ASSETS: R2Bucket;
  RATE_LIMIT: DurableObjectNamespace;
  PAYOUTS: Queue;

  /** HMAC key for access tokens. Secret. */
  ACCESS_TOKEN_SECRET: string;
  /** HMAC key for refresh tokens. Secret. Rotated independently of access. */
  REFRESH_TOKEN_SECRET: string;
  /** Salt used to hash visitor IPs for click fraud detection. Secret. */
  VISITOR_HASH_SALT: string;
  /** Symmetric key for encrypting bank account numbers at rest. Secret. */
  FIELD_ENCRYPTION_KEY: string;
  /** Comma-separated list of allowed browser origins. */
  ALLOWED_ORIGINS: string;
  /** Absolute public origin the frontend is served from, for building links. */
  PUBLIC_SITE_URL: string;
  /** Access token lifetime in seconds. */
  ACCESS_TOKEN_TTL_SECONDS?: string;
  /** Refresh token lifetime in seconds. */
  REFRESH_TOKEN_TTL_SECONDS?: string;
  /** Cache TTL for public catalogue responses, seconds. */
  CATALOGUE_CACHE_TTL_SECONDS?: string;
  /** Build stamp injected by the deploy pipeline. */
  BUILD_VERSION?: string;
}

export interface CfProperties {
  country?: string;
  colo?: string;
}
