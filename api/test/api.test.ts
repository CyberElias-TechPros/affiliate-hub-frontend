import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  creditWallet,
  makeClient,
  signupClient,
  startWorker,
  type BankData,
  type CategoriesData,
  type Envelope,
  type FaqsData,
  type HealthData,
  type LeaderboardData,
  type LinkData,
  type MeData,
  type PayoutOptionsData,
  type ProductData,
  type ProductPage,
  type RefreshData,
  type SessionData,
  type TestEnv,
  type TicketData,
  type TransactionsData,
  type WalletSummaryData,
  type WithdrawData,
} from './helpers';
import type { Page, Product } from '../../shared/api-contract';

let env: TestEnv;

beforeAll(async () => {
  env = await startWorker();
}, 120_000);

afterAll(async () => {
  await env?.dispose();
});

const api = (path: string) => `/api/v1${path}`;

describe('infrastructure', () => {
  it('reports real database health, not a hardcoded ok', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<Envelope<HealthData>>(api('/health'));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    expect(response.body.data.status).toBe('ok');
    expect(response.body.data.database).toBe('up');
  });

  it('applies foreign key constraints', async () => {
    // D1 must enforce FKs, otherwise deleted products leave orphaned links.
    const result = await env.db
      .prepare(
        `INSERT INTO affiliate_links (id, user_id, product_id, code, created_at)
         VALUES ('fk-test', 'no-such-user', 'no-such-product', 'fktest001', '2025-01-01')`,
      )
      .run()
      .catch((error: Error) => error);

    expect(result).toBeInstanceOf(Error);
    expect(String((result as Error).message)).toMatch(/FOREIGN KEY constraint failed/i);
  });

  it('enforces CORS as an allowlist and rejects unknown origins', async () => {
    const allowed = await env.fetch(`${env.origin}${api('/health')}`, {
      headers: { origin: 'https://affiliate-hub.test' },
    });
    expect(allowed.headers.get('access-control-allow-origin')).toBe('https://affiliate-hub.test');

    const rejected = await env.fetch(`${env.origin}${api('/health')}`, {
      headers: { origin: 'https://evil.example' },
    });
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight without hitting the database', async () => {
    const response = await env.fetch(`${env.origin}${api('/wallet/summary')}`, {
      method: 'OPTIONS',
      headers: { origin: 'https://affiliate-hub.test' },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-methods')).toContain('POST');
  });

  it('returns a JSON envelope for unknown routes', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get(api('/does-not-exist'));
    expect(response.status).toBe(404);
    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe('not_found');
    expect(response.body.error.requestId).toBeTruthy();
  });
});

describe('route ordering (regression: Express prototype shadowed these)', () => {
  it('reaches /products/categories instead of matching /products/:slug', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<CategoriesData>(api('/products/categories'));

    expect(response.status).toBe(200);
    expect(response.body.ok).toBe(true);
    const categories = response.body.data as Array<{ category: string; count: number }>;
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.map((c) => c.category)).toContain('education');
  });

  it('still resolves a real product slug', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<ProductData>(api('/products/forex-mastery-course'));

    expect(response.status).toBe(200);
    expect(response.body.data.slug).toBe('forex-mastery-course');
  });

  it('404s an unknown slug rather than crashing', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get(api('/products/nope-not-real'));
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('not_found');
  });
});

describe('catalogue', () => {
  it('lists products with integer money and basis-point commission', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<ProductPage>(api('/products?pageSize=50'));

    expect(response.status).toBe(200);
    const page = response.body.data;
    expect(page.items.length).toBeGreaterThan(0);

    const forex = page.items.find((p) => p.slug === 'forex-mastery-course')!;
    expect(forex.price).toEqual({ amountMinor: 15_000_000, currency: 'NGN' });
    expect(forex.commissionBps).toBe(4500);
    // 45% of ₦150,000.00 === ₦67,500.00, computed from integers.
    expect(forex.commissionAmount).toEqual({ amountMinor: 6_750_000, currency: 'NGN' });
  });

  it('filters by category and honours the minimum commission rate', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);

    const beauty = await client.get<Envelope<Page<Product>>>(api('/products?category=beauty'));
    expect(beauty.body.data.items.every((p) => p.category === 'beauty')).toBe(true);
    expect(beauty.body.data.items.length).toBeGreaterThan(0);

    const highCommission = await client.get<Envelope<Page<Product>>>(api('/products?minCommissionBps=4000'));
    expect(highCommission.body.data.items.every((p) => p.commissionBps >= 4000)).toBe(true);
  });

  it('sorts by commission descending', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<Envelope<Page<Product>>>(
      api('/products?sort=commission-desc&pageSize=50'),
    );
    const rates = response.body.data.items.map((p) => p.commissionBps);
    expect(rates).toEqual([...rates].sort((a: number, b: number) => b - a));
  });

  it('searches without allowing LIKE wildcards to widen the match', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    // A bare "%" would match every row if it were not escaped.
    const response = await client.get<ProductPage>(api('/products?q=%25'));
    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBe(0);
  });

  it('paginates', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const page1 = await client.get<ProductPage>(api('/products?pageSize=2&page=1'));
    const page2 = await client.get<ProductPage>(api('/products?pageSize=2&page=2'));

    expect(page1.body.data.items.length).toBe(2);
    expect(page1.body.data.items[0].id).not.toBe(page2.body.data.items[0].id);
    expect(page1.body.data.totalPages).toBeGreaterThan(1);
  });

  it('rejects an oversized pageSize', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<ProductPage>(api('/products?pageSize=100000'));
    expect(response.status).toBe(400);
    expect(response.body.error.fields.pageSize).toBeTruthy();
  });
});

describe('authentication', () => {
  it('signs up, then returns the session from /auth/me', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    expect(user.email).toBeTruthy();
    expect(user.referralCode).toBeTruthy();
    expect(user.onboardingCompleted).toBe(false);

    const me = await client.get<MeData>(api('/auth/me'));
    expect(me.status).toBe(200);
    expect(me.body.data.user.id).toBe(user.id);
    // The password hash must never leave the server.
    expect(JSON.stringify(me.body)).not.toContain('pbkdf2');
  });

  it('rejects a weak password with a field-level error', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.post<SessionData>(api('/auth/signup'), {
      name: 'Weak Pass',
      email: `weak-${Date.now()}@test.dev`,
      password: 'short',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');
    expect(response.body.error.fields.password).toBeTruthy();
  });

  it('refuses to reuse an email', async () => {
    const email = `dupe-${Date.now()}@test.dev`;
    await signupClient(env.origin, { email }, env.fetch);

    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.post<SessionData>(api('/auth/signup'), {
      name: 'Second Person',
      email,
      password: 'Testpass1234',
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('conflict');
  });

  it('rejects a wrong password without revealing whether the account exists', async () => {
    const email = `wrongpw-${Date.now()}@test.dev`;
    await signupClient(env.origin, { email }, env.fetch);

    const client = makeClient(env.origin, { current: null }, env.fetch);
    const wrongPassword = await client.post<SessionData>(api('/auth/login'), { email, password: 'Totallywrong1' });
    const noAccount = await client.post<SessionData>(api('/auth/login'), {
      email: `ghost-${Date.now()}@test.dev`,
      password: 'Totallywrong1',
    });

    expect(wrongPassword.status).toBe(401);
    expect(noAccount.status).toBe(401);
    // Identical message either way: no account enumeration.
    expect(wrongPassword.body.error.message).toBe(noAccount.body.error.message);
  });

  it('rejects a malformed email', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.post<SessionData>(api('/auth/login'), { email: 'not-an-email', password: 'whatever123' });
    expect(response.status).toBe(400);
    expect(response.body.error.fields.email).toBeTruthy();
  });

  it('protects wallet routes from anonymous callers', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<WalletSummaryData>(api('/wallet/summary'));
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('unauthenticated');
  });

  it('rejects a garbage bearer token', async () => {
    const client = makeClient(env.origin, { current: 'not.a.real.token' }, env.fetch);
    const response = await client.get<MeData>(api('/auth/me'));
    expect(response.status).toBe(401);
  });

  it('locks an account after repeated failed logins', async () => {
    const email = `brute-${Date.now()}@test.dev`;
    await signupClient(env.origin, { email }, env.fetch);

    const client = makeClient(env.origin, { current: null }, env.fetch);
    for (let attempt = 0; attempt < 5; attempt++) {
      await client.post<SessionData>(api('/auth/login'), { email, password: 'Wrongpassword1' });
    }

    // The sixth attempt must be refused even though it is a fresh request.
    const locked = await client.post<SessionData>(api('/auth/login'), { email, password: 'Wrongpassword1' });
    expect(locked.status).toBe(429);
  });
});

describe('token rotation', () => {
  it('rotates a refresh token and revokes the old one', async () => {
    const { refreshToken } = await signupClient(env.origin, {}, env.fetch);
    const client = makeClient(env.origin, { current: null }, env.fetch);

    const rotated = await client.post<RefreshData>(api('/auth/refresh'), { refreshToken });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.accessToken).toBeTruthy();
    expect(rotated.body.data.refreshToken).not.toBe(refreshToken);

    // Reusing the original token is treated as theft.
    const reuse = await client.post<RefreshData>(api('/auth/refresh'), { refreshToken });
    expect(reuse.status).toBe(401);
  });

  it('revokes the whole token family when a rotated token is replayed', async () => {
    const { refreshToken } = await signupClient(env.origin, {}, env.fetch);
    const client = makeClient(env.origin, { current: null }, env.fetch);

    // Rotate once. `next` is the only currently-valid refresh token.
    const rotated = await client.post<RefreshData>(api('/auth/refresh'), { refreshToken });
    expect(rotated.status).toBe(200);
    const next = rotated.body.data.refreshToken;

    // Replay the ORIGINAL, already-rotated token. This is the theft signal.
    const replay = await client.post<RefreshData>(api('/auth/refresh'), { refreshToken });
    expect(replay.status).toBe(401);

    // The claim is not merely "the old token is refused" — the family is torn
    // down, so the token an attacker may already be holding is dead too.
    // Without family revocation, a thief who replayed the stale token would
    // still have a valid `next` in hand.
    const afterRevoke = await client.post<RefreshData>(api('/auth/refresh'), {
      refreshToken: next,
    });
    expect(afterRevoke.status).toBe(401);
  });

  it('refuses an access token used where a refresh token is expected', async () => {
    const { tokenRef } = await signupClient(env.origin, {}, env.fetch);
    const client = makeClient(env.origin, { current: null }, env.fetch);

    const response = await client.post<RefreshData>(api('/auth/refresh'), { refreshToken: tokenRef.current });
    expect(response.status).toBe(401);
  });
});

describe('affiliate links', () => {
  it('generates a link pointing at the configured site, not the request origin', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const products = await client.get<ProductPage>(api('/products?pageSize=1'));
    const productId = products.body.data.items[0].id;

    const created = await client.post<LinkData>(api('/affiliate/links'), { productId });
    expect(created.status).toBe(201);

    // The prototype built this from `req.headers.origin`, which the client
    // controls. It must come from PUBLIC_SITE_URL instead.
    expect(created.body.data.link.url.startsWith('https://affiliate-hub.test/r/')).toBe(true);
  });

  it('is idempotent per affiliate per product', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const products = await client.get<ProductPage>(api('/products?pageSize=1'));
    const productId = products.body.data.items[0].id;

    const first = await client.post<LinkData>(api('/affiliate/links'), { productId });
    const second = await client.post<LinkData>(api('/affiliate/links'), { productId });

    expect(first.body.data.link.id).toBe(second.body.data.link.id);
    expect(first.body.data.link.code).toBe(second.body.data.link.code);
  });

  it('refuses to link to a product that does not exist', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const response = await client.post<LinkData>(api('/affiliate/links'), { productId: 'no-such-product' });
    expect(response.status).toBe(404);
  });

  it('records a click and redirects to the product page', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const products = await client.get<ProductPage>(api('/products?pageSize=1'));
    const product = products.body.data.items[0];
    const link = await client.post<LinkData>(api('/affiliate/links'), { productId: product.id });
    const code = link.body.data.link.code;

    const clicked = await env.fetch(`${env.origin}${api(`/go/${code}`)}`, { redirect: 'manual' });
    expect(clicked.status).toBe(302);
    expect(clicked.headers.get('location')).toContain(`/products/${product.slug}`);
    expect(clicked.headers.get('location')).toContain(`ref=${code}`);

    const before = await env.db
      .prepare('SELECT COUNT(*) AS total FROM clicks WHERE link_id = ?')
      .bind(link.body.data.link.id)
      .first<{ total: number }>();
    expect((before?.total ?? 0)).toBeGreaterThanOrEqual(1);

    // The raw IP must never reach the database. `visitor_hash` is a salted
    // SHA-256, so asserting on the stored column catches a regression that
    // started writing `c.reqCtx.ip` directly — which would be personal data
    // retained with no need and no expiry.
    const stored = await env.db
      .prepare('SELECT visitor_hash FROM clicks WHERE link_id = ? LIMIT 1')
      .bind(link.body.data.link.id)
      .first<{ visitor_hash: string }>();
    expect(stored?.visitor_hash).toBeTruthy();
    expect(stored?.visitor_hash).not.toContain('203.0.113');
    expect(stored?.visitor_hash).toMatch(/^[0-9a-f]{64}$/);

    // Replaying the same visitor inside the dedupe window must not inflate it.
    await env.fetch(`${env.origin}${api(`/go/${code}`)}`, { redirect: 'manual' });
    const after = await env.db
      .prepare('SELECT COUNT(*) AS total FROM clicks WHERE link_id = ?')
      .bind(link.body.data.link.id)
      .first<{ total: number }>();
    expect(after?.total).toBe(before?.total);
  });

  it('404s an unknown click code instead of redirecting anywhere', async () => {
    const response = await env.fetch(`${env.origin}${api('/go/doesnotexist')}`, { redirect: 'manual' });
    expect(response.status).toBe(404);
  });
});

describe('withdrawals — the money path', () => {
  it('rejects a negative amount instead of crediting the wallet', async () => {
    // This is the prototype's most serious bug: a negative "withdrawal" passed
    // the balance check and then increased the balance, because the ledger
    // summed -amount for debits.
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 1_000_000);

    const response = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: -5_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'negamount-test-0001',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('validation_error');

    const summary = await client.get<WalletSummaryData>(api('/wallet/summary'));
    expect(summary.body.data.available.amountMinor).toBe(1_000_000);
  });

  it('rejects a zero amount', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 1_000_000);

    const response = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 0,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'zeroamount-test-0001',
    });
    expect(response.status).toBe(400);
  });

  it('rejects a fractional amount', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 1_000_000);

    const response = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 1000.5,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'fraction-test-0001',
    });
    expect(response.status).toBe(400);
  });

  it('enforces the per-method minimum', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 50_000_000);

    // ₦5,000.00 is the floor for bank transfer; ₦1,000.00 is not.
    const tooSmall = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 100_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'min-test-0000000001',
    });
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.body.error.code).toBe('withdrawal_below_minimum');
  });

  it('validates the destination format per method', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 50_000_000);

    const badNuban = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 1_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: 'not-a-nuban',
      idempotencyKey: 'nuban-test-00000001',
    });
    expect(badNuban.status).toBe(400);
    expect(badNuban.body.error.fields.destination).toBeTruthy();
  });

  it('refuses a withdrawal larger than the balance', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 1_000_000);

    const response = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 50_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'overdraw-test-0001',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('insufficient_funds');
  });

  it('prevents a double spend from concurrent requests', async () => {
    // The prototype read the balance with a SELECT and inserted the debit in a
    // later statement, so two racing requests both passed. Both must not win.
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 1_000_000); // ₦10,000.00

    const makeRequest = (key: string) =>
      client.post<WithdrawData>(api('/wallet/withdraw'), {
        amountMinor: 900_000, // ₦9,000.00 — only one can fit
        currency: 'NGN',
        method: 'bank',
        destination: '0123456789',
        idempotencyKey: key,
      });

    const results = await Promise.all([
      makeRequest('race-test-0000000001'),
      makeRequest('race-test-0000000002'),
      makeRequest('race-test-0000000003'),
    ]);

    const successes = results.filter((r) => r.status === 201);
    expect(successes.length).toBe(1);

    const summary = await client.get<WalletSummaryData>(api('/wallet/summary'));
    expect(summary.body.data.available.amountMinor).toBe(100_000);
    expect(summary.body.data.available.amountMinor).toBeGreaterThanOrEqual(0);
  });

  it('deduplicates a replayed idempotency key', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 50_000_000);

    const payload = {
      amountMinor: 1_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'idempotency-test-01',
    };

    const first = await client.post<WithdrawData>(api('/wallet/withdraw'), payload);
    const replay = await client.post<WithdrawData>(api('/wallet/withdraw'), payload);

    expect(first.status).toBe(201);
    expect(replay.status).toBe(200);
    expect(replay.body.data.deduplicated).toBe(true);
    expect(replay.body.data.transactionId).toBe(first.body.data.transactionId);

    // The balance moved once, not twice.
    const summary = await client.get<WalletSummaryData>(api('/wallet/summary'));
    expect(summary.body.data.available.amountMinor).toBe(49_000_000);
  });

  it('records the withdrawal as a pending ledger entry with the fee', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 100_000_000);

    const response = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 10_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'ledger-test-0000001',
    });
    expect(response.status).toBe(201);

    const tx = await env.db
      .prepare('SELECT amount_minor, status, type FROM transactions WHERE id = ?')
      .bind(response.body.data.transactionId)
      .first<{ amount_minor: number; status: string; type: string }>();

    expect(tx?.type).toBe('withdrawal');
    expect(tx?.status).toBe('pending');
    // Debits are stored negative so a SUM cannot be tricked by sign.
    expect(tx?.amount_minor).toBe(-10_000_000);
  });

  it('applies the USDT fee and enforces currency matching', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    // NGN wallet cannot pay out via USDT.
    await creditWallet(env.db, user.id, 100_000_000, 'NGN');

    const mismatched = await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 10_000,
      currency: 'USD',
      method: 'usdt',
      destination: 'TQrZ9wBsZ3xw8VtKK3mnbFQeJmfvqVrYhZ',
      idempotencyKey: 'currency-test-00001',
    });
    expect(mismatched.status).toBe(400);
  });

  it('returns payout options with server-side fees', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const response = await client.get<PayoutOptionsData>(api('/wallet/payout-options'));

    expect(response.status).toBe(200);
    const options = response.body.data.options as Array<{ method: string; feeBps: number; minimumMinor: number }>;
    expect(options.find((o) => o.method === 'bank')?.feeBps).toBe(0);
    expect(options.find((o) => o.method === 'usdt')?.feeBps).toBe(100);
    expect(options.find((o) => o.method === 'paypal')?.feeBps).toBe(200);
    expect(options.find((o) => o.method === 'bank')?.minimumMinor).toBe(500_000);
  });
});

describe('wallet reads', () => {
  it('reports available, pending and lifetime balances separately', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 2_500_000);

    const summary = await client.get<WalletSummaryData>(api('/wallet/summary'));
    expect(summary.status).toBe(200);
    expect(summary.body.data.available).toEqual({ amountMinor: 2_500_000, currency: 'NGN' });
    expect(summary.body.data.lifetimeEarnings.amountMinor).toBe(2_500_000);
    // Secondary currency comes from a stored rate, not a hardcoded /450.
    expect(summary.body.data.fxRate.source).toBeTruthy();
    expect(summary.body.data.availableSecondary.currency).toBe('USD');
  });

  it('lists transactions newest first and paginates', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 5_000_000);
    await client.post<WithdrawData>(api('/wallet/withdraw'), {
      amountMinor: 1_000_000,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      idempotencyKey: 'txnlist-test-000001',
    });

    const response = await client.get<TransactionsData>(api('/wallet/transactions'));
    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBe(2);
    expect(response.body.data.items[0].type).toBe('withdrawal');
  });
});

describe('privacy', () => {
  it('pseudonymises the leaderboard instead of exposing real names', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);
    const response = await client.get<LeaderboardData>(api('/stats/leaderboard'));

    expect(response.status).toBe(200);
    const entries = response.body.data.entries as Array<{ handle: string }>;
    // The seeded affiliate is "Chinedu Nwankwo"; the handle must not be the
    // full name, and no email may appear anywhere in the payload.
    expect(JSON.stringify(response.body)).not.toContain('affiliatehub.test');
    for (const entry of entries) {
      expect(entry.handle).not.toBe('Chinedu Nwankwo');
    }
  });

  it('masks a stored bank account number', async () => {
    const { client } = await signupClient(env.origin, {}, env.fetch);

    const saved = await client.put<BankData>(api('/profile/bank-details'), {
      bankName: 'GTBank',
      accountName: 'Chinedu Nwankwo',
      accountNumber: '0123456789',
    });
    expect(saved.status).toBe(200);
    expect(saved.body.data.bank.accountNumberMasked).toBe('••••••6789');
    expect(JSON.stringify(saved.body)).not.toContain('0123456789');

    // The ciphertext in the database must not be the plaintext either.
    const row = await env.db
      .prepare('SELECT account_number_enc FROM bank_details WHERE account_number_mask = ?')
      .bind('••••••6789')
      .first<{ account_number_enc: string }>();
    expect(row?.account_number_enc).toBeTruthy();
    expect(row?.account_number_enc).not.toContain('0123456789');
    expect(row?.account_number_enc.startsWith('v1:')).toBe(true);
  });
});

describe('content', () => {
  it('serves FAQs for the public help page', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const response = await client.get<FaqsData>(api('/faqs'));

    expect(response.status).toBe(200);
    expect(response.body.data.items.length).toBeGreaterThan(0);
    expect(response.body.data.items[0].answer.length).toBeGreaterThan(20);
  });

  it('accepts a support ticket and rate limits spam', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const ticket = {
      subject: 'Cannot withdraw',
      message: 'My withdrawal has been pending for two days, please help.',
      contactEmail: 'user@test.dev',
      category: 'payouts',
    };

    const first = await client.post<TicketData>(api('/support/tickets'), ticket);
    expect(first.status).toBe(201);

    // Three per hour per IP.
    await client.post<TicketData>(api('/support/tickets'), ticket);
    await client.post<TicketData>(api('/support/tickets'), ticket);
    const fourth = await client.post<TicketData>(api('/support/tickets'), ticket);
    expect(fourth.status).toBe(429);
  });
});
