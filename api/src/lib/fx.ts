import type { Currency, FxRate } from '../../../shared/api-contract';
import type { Env } from './env';

/**
 * FX rates.
 *
 * The prototype converted NGN to USD with a hardcoded `/ 450` buried in the
 * balance endpoint. Rates move, and a stale constant silently misreports every
 * affiliate's earnings. Rates now live in `fx_rates` with an `as_of` timestamp
 * and a `source`, are refreshed by the nightly cron, and are cached in KV.
 *
 * If no rate has ever been loaded we fall back to a clearly-labelled default
 * rather than failing the request — the wallet must still render.
 */
const FALLBACK_NGN_PER_USD = 1500;
const CACHE_KEY = 'fx:latest:v1';
const CACHE_TTL = 3600;

interface FxRow {
  base: string;
  quote: string;
  rate_scaled: number;
  as_of: string;
  source: string;
}

export async function getFxRate(
  env: Env,
  db: D1Database,
  base: Currency,
  quote: Currency,
): Promise<FxRate> {
  if (base === quote) {
    return { base, quote, rateScaled: 1_000_000, asOf: new Date().toISOString(), source: 'identity' };
  }

  const cacheKey = `${CACHE_KEY}:${base}:${quote}`;
  const cached = await env.CACHE.get<FxRate>(cacheKey, 'json');
  if (cached) return cached;

  const row = await db
    .prepare(
      `SELECT base, quote, rate_scaled, as_of, source FROM fx_rates
        WHERE base = ? AND quote = ? ORDER BY as_of DESC LIMIT 1`,
    )
    .bind(base, quote)
    .first<FxRow>();

  const rate: FxRate = row
    ? {
        base: row.base as Currency,
        quote: row.quote as Currency,
        rateScaled: row.rate_scaled,
        asOf: row.as_of,
        source: row.source,
      }
    : fallbackRate(base, quote);

  await env.CACHE.put(cacheKey, JSON.stringify(rate), { expirationTtl: CACHE_TTL });
  return rate;
}

function fallbackRate(base: Currency, quote: Currency): FxRate {
  const ngnToUsd = quote === 'USD' ? 1 / FALLBACK_NGN_PER_USD : FALLBACK_NGN_PER_USD;
  const rate = base === 'NGN' ? ngnToUsd : 1 / ngnToUsd;
  return {
    base,
    quote,
    rateScaled: Math.round(rate * 1_000_000),
    asOf: new Date(0).toISOString(),
    source: 'fallback-default',
  };
}

/**
 * Persist a refreshed rate and bust the cache.
 *
 * The provider call lives behind this function so a rate source can be swapped
 * (or a manual override applied) without touching callers.
 */
export async function storeFxRate(
  env: Env,
  db: D1Database,
  base: Currency,
  quote: Currency,
  rate: number,
  source: string,
): Promise<void> {
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Refusing to store non-positive FX rate for ${base}/${quote}`);
  }
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO fx_rates (id, base, quote, rate_scaled, as_of, source, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(crypto.randomUUID(), base, quote, Math.round(rate * 1_000_000), now, source, now)
    .run();

  await env.CACHE.delete(`${CACHE_KEY}:${base}:${quote}`);
  await env.CACHE.delete(`${CACHE_KEY}:${quote}:${base}`);
}

export { FALLBACK_NGN_PER_USD };
