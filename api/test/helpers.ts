import { Miniflare } from 'miniflare';
import { build } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedDatabase } from '../scripts/seed-data';
import { parseSqlStatements } from '../src/lib/sql';
import type { BankDetails, Page, Product, PublicUser, Transaction } from '../../shared/api-contract';
import type { Env } from '../src/lib/env';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '..');

export const TEST_BINDINGS = {
  ACCESS_TOKEN_SECRET: 'test-access-secret-0000000000000000000000000000000000',
  REFRESH_TOKEN_SECRET: 'test-refresh-secret-00000000000000000000000000000',
  VISITOR_HASH_SALT: 'test-visitor-salt-00000000000000000000000000000000',
  // 32 random bytes, base64url — matches what `openssl rand 32` produces.
  FIELD_ENCRYPTION_KEY: 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY',
  ALLOWED_ORIGINS: 'https://affiliate-hub.test,http://localhost:8080',
  PUBLIC_SITE_URL: 'https://affiliate-hub.test',
  BUILD_VERSION: 'test',
};

/**
 * Split a migration file into individual statements.
 *
 * `D1Database.exec()` treats a newline as a statement separator, so a
 * multi-line `CREATE TABLE` fed to it directly fails with "incomplete input".
 * `wrangler d1 migrations apply` handles multi-line SQL correctly (verified),
 * so this only affects the test harness — but the harness must still run the
 * real migration files unmodified, which means the splitting happens here
 * rather than by editing the SQL.
 *
 * Quote-aware: a `--` or `;` inside a string literal is data, not syntax.
 */
/**
 * Split a migration file into statements safe for `D1Database.exec()`.
 *
 * Delegates to the shared parser so the seed CLI and the test suite can never
 * drift on how `--` comments or string literals are handled.
 */
export function parseMigrationStatements(sql: string): string[] {
  return parseSqlStatements(sql);
}

/**
 * `Miniflare.dispatchFetch` is typed against workerd's `Request`/`Response`,
 * which are structurally close to but not identical with Node's undici types
 * (workerd's `Response` has no `bytes()`, its `Headers` has no
 * `getSetCookie()`). Tests only need `status`, `headers.get()` and `json()`,
 * so the boundary is narrowed once here instead of leaking the mismatch into
 * every call site.
 */
export type TestFetch = (url: string, init?: RequestInit) => Promise<Response>;

export interface TestEnv {
  mf: Miniflare;
  /**
   * The worker's real bindings, assembled into an `Env`.
   *
   * The cron jobs and the queue consumer take an `Env` directly rather than a
   * `Context`, so testing them needs the actual D1/KV/R2/Queue objects rather
   * than a stand-in. `getBindings()` returns the same instances the worker
   * itself uses, so these tests exercise the real code path.
   */
  env: Env;
  /**
   * Virtual origin. Requests are dispatched straight into workerd via
   * `dispatchFetch`, so no port is bound and tests cannot collide.
   */
  origin: string;
  /** Fetch bound to the worker. */
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
  db: D1Database;
  dispose: () => Promise<void>;
}

/**
 * Bundle the Worker and boot it in Miniflare with real D1, KV, R2, Durable
 * Object and Queue bindings.
 *
 * Miniflare runs `workerd` — the actual Cloudflare runtime — so these tests
 * exercise the same D1 SQLite engine, WebCrypto and Durable Object storage that
 * production uses, rather than a mock.
 */
export async function startWorker(options: { seed?: boolean } = {}): Promise<TestEnv> {
  // workerd refuses to load a module outside its sandbox root, so the bundle
  // must live inside the project rather than in the system temp directory.
  const tempDir = await fs.mkdtemp(path.join(apiRoot, '.worker-build-'));
  const outfile = path.join(tempDir, 'worker.mjs');

  await build({
    entryPoints: [path.join(apiRoot, 'src/index.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    outfile,
    external: ['__STATIC_CONTENT_MANIFEST'],
    logLevel: 'silent',
  });

  const mf = new Miniflare({
    modules: true,
    scriptPath: outfile,
    modulesRoot: tempDir,
    d1Databases: { DB: 'test-db' },
    kvNamespaces: ['CACHE'],
    r2Buckets: ['ASSETS'],
    durableObjects: { RATE_LIMIT: 'RateLimiter' },
    queueProducers: { PAYOUTS: 'test-payouts' },
    queueConsumers: { 'test-payouts': { maxBatchSize: 1, maxBatchTimeout: 1 } },
    bindings: TEST_BINDINGS,
  });

  const db = (await mf.getD1Database('DB')) as unknown as D1Database;

  // Apply every migration in filename order, exactly as wrangler would.
  const migrationsDir = path.join(apiRoot, 'migrations');
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
    for (const statement of parseMigrationStatements(sql)) {
      await db.exec(statement);
    }
  }

  if (options.seed !== false) {
    await seedDatabase(db);
  }

  const origin = 'https://worker.test';
  const dispatch: TestFetch = (url, init = {}) =>
    mf.dispatchFetch(url, init as never) as unknown as Promise<Response>;

  const bindings = (await mf.getBindings()) as Record<string, unknown>;
  const workerEnv: Env = {
    ...(TEST_BINDINGS as unknown as Env),
    DB: db,
    CACHE: bindings.CACHE as Env['CACHE'],
    ASSETS: bindings.ASSETS as Env['ASSETS'],
    RATE_LIMIT: bindings.RATE_LIMIT as Env['RATE_LIMIT'],
    PAYOUTS: bindings.PAYOUTS as Env['PAYOUTS'],
  };

  return {
    mf,
    env: workerEnv,
    origin,
    fetch: dispatch,
    db,
    dispose: async () => {
      await mf.dispose();
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * The `{ ok, data | error }` envelope the Worker always returns.
 *
 * Deliberately a single object type with both members rather than a
 * discriminated union: a union would force every one of the ~40 call sites to
 * narrow before reading `.data`, which adds noise without adding safety in a
 * test that has already asserted on `response.status`.
 *
 * `TData` defaults to `unknown`, so a call site that cares about the shape
 * names it — `client.get<Envelope<Page<Product>>>(...)` — and the compiler then
 * checks the fields it reads. The four assertions that used to be `any` now
 * genuinely verify `slug`, `category` and `commissionBps` exist.
 */
/* ── Named response shapes ───────────────────────────────────────────────
   Aliases for the envelopes the suite actually reads, so call sites name a
   shape instead of repeating a generic. Each is derived from the shared
   contract where one exists. */

export interface Envelope<TData = unknown> {
  ok: boolean;
  data: TData;
  error: {
    code: string;
    message: string;
    fields: Record<string, string>;
    requestId: string;
  };
}

export type HealthData = { status: string; database: string };
export type ProductPage = Envelope<Page<Product>>;
export type ProductData = Envelope<Product>;
export type CategoriesData = Envelope<Array<{ category: string; count: number }>>;
export type SessionData = Envelope<{
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
}>;
export type MeData = Envelope<{ user: PublicUser; bank: BankDetails | null }>;
export type WalletSummaryData = Envelope<{
  available: { amountMinor: number; currency: string };
  pending: { amountMinor: number; currency: string };
  availableSecondary: { amountMinor: number; currency: string };
  lifetimeEarnings: { amountMinor: number; currency: string };
  fxRate: { rateScaled: number; base: string; quote: string; source: string; asOf: string };
}>;
export type PayoutOptionsData = Envelope<{
  options: { method: string; label: string; feeBps: number; minimumMinor: number }[];
}>;
export type TransactionsData = Envelope<Page<Transaction>>;
export type WithdrawData = Envelope<{
  transactionId: string;
  status: string;
  amount: { amountMinor: number; currency: string };
  deduplicated: boolean;
}>;
export type LinkData = Envelope<{
  link: { id: string; url: string; code: string; clicks: number; conversions: number };
}>;
export type LeaderboardData = Envelope<{
  entries: Array<{
    handle: string;
    tier: 'starter' | 'pro' | 'elite';
    earnings: { amountMinor: number; currency: string };
    conversions: number;
    rank: number;
  }>;
}>;
export type FaqsData = Envelope<{ items: { id: string; question: string; answer: string }[] }>;
export type TicketData = Envelope<{ id: string }>;
export type BankData = Envelope<{ bank: { bankName: string; accountNumberMasked: string } }>;
export type RefreshData = Envelope<{ accessToken: string; refreshToken: string }>;

export interface ApiClient {
  get: <TBody = Envelope>(path: string, init?: RequestInit) => Promise<ParsedResponse<TBody>>;
  post: <TBody = Envelope>(path: string, body?: unknown, init?: RequestInit) => Promise<ParsedResponse<TBody>>;
  patch: <TBody = Envelope>(path: string, body?: unknown, init?: RequestInit) => Promise<ParsedResponse<TBody>>;
  put: <TBody = Envelope>(path: string, body?: unknown, init?: RequestInit) => Promise<ParsedResponse<TBody>>;
  del: <TBody = Envelope>(path: string, init?: RequestInit) => Promise<ParsedResponse<TBody>>;
}

/**
 * Shape of an API response after the `{ ok, data | error }` envelope is opened.
 *
 * `body` is the unwrapped payload, so its type is only known at each call site.
 * `unknown` keeps that honest: callers must narrow before they touch it.
 */
export interface ParsedResponse<TBody = unknown> {
  status: number;
  headers: Headers;
  body: TBody;
}

/** Minimal fetch wrapper that unwraps the `{ ok, data | error }` envelope. */
/**
 * A per-client source IP.
 *
 * In production Cloudflare sets `cf-connecting-ip` and clients cannot spoof
 * it; `dispatchFetch` does not, so tests must supply it. Without a distinct IP
 * per client every test would share one rate-limit bucket.
 */
export function randomIp(): string {
  const octet = () => Math.floor(Math.random() * 250) + 2;
  return `203.0.${octet()}.${octet()}`;
}

export function makeClient(
  origin: string,
  tokenRef: { current: string | null } = { current: null },
  fetchFn: TestFetch = fetch,
  ip: string = randomIp(),
): ApiClient {
  const request = async <TBody,>(method: string, p: string, body?: unknown, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('origin', 'https://affiliate-hub.test');
    headers.set('cf-connecting-ip', ip);
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (tokenRef.current) headers.set('authorization', `Bearer ${tokenRef.current}`);

    const response = await fetchFn(`${origin}${p}`, {
      ...init,
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual',
    });

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    return { status: response.status, headers: response.headers, body: parsed as TBody };
  };

  return {
    get: (p, init) => request('GET', p, undefined, init),
    post: (p, body, init) => request('POST', p, body ?? {}, init),
    patch: (p, body, init) => request('PATCH', p, body ?? {}, init),
    put: (p, body, init) => request('PUT', p, body ?? {}, init),
    del: (p, init) => request('DELETE', p, undefined, init),
  };
}

/** Sign up and return a client pre-loaded with that user's access token. */
export async function signupClient(
  origin: string,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
  fetchFn: TestFetch = fetch,
  ip: string = randomIp(),
) {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2, 10)}@test.dev`;
  const response = await fetchFn(`${origin}/api/v1/auth/signup`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://affiliate-hub.test',
      'cf-connecting-ip': ip,
    },
    body: JSON.stringify({
      name: overrides.name ?? 'Test Affiliate',
      email,
      password: overrides.password ?? 'Testpass1234',
    }),
  });
  const payload = (await response.json()) as Envelope<{
    user: PublicUser;
    accessToken: string;
    refreshToken: string;
  }>;
  if (!payload?.ok) throw new Error(`signup failed: ${JSON.stringify(payload)}`);

  const tokenRef = { current: payload.data.accessToken };
  return {
    client: makeClient(origin, tokenRef, fetchFn, ip),
    tokenRef,
    user: payload.data.user,
    refreshToken: payload.data.refreshToken,
  };
}

/** Give a user spendable balance by writing a completed commission directly. */
export async function creditWallet(
  db: D1Database,
  userId: string,
  amountMinor: number,
  currency = 'NGN',
): Promise<void> {
  const now = new Date().toISOString();
  await db.batch([
    db
      .prepare(
        `INSERT INTO transactions (id, user_id, type, status, amount_minor, fee_minor, currency,
                                   description, created_at, updated_at)
         VALUES (?, ?, 'commission', 'completed', ?, 0, ?, 'Seed credit', ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, amountMinor, currency, now, now),
    db
      .prepare(
        `INSERT INTO wallets (user_id, currency, available_minor, pending_minor, updated_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           available_minor = wallets.available_minor + excluded.available_minor,
           updated_at = excluded.updated_at`,
      )
      .bind(userId, currency, amountMinor, now),
  ]);
}
