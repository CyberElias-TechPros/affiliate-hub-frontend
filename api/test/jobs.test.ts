import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { creditWallet, makeClient, signupClient, startWorker, type TestEnv } from './helpers';
import { handlePayoutMessage } from '../src/queue-consumer';
import {
  ensureFxSeed,
  expireStaleWithdrawals,
  pruneExpiredSessions,
  reconcileWallets,
} from '../src/jobs';

/**
 * Queue consumer and cron jobs.
 *
 * These were the last code paths with no coverage. The report asserts specific
 * behaviour about both — that a payout without provider credentials stays
 * `pending` rather than being faked as settled, and that the nightly cron
 * reconciles wallet drift — and an assertion nobody has executed is a guess.
 *
 * They are exercised directly rather than through a queue delivery because
 * Miniflare's local queue does not invoke the consumer on the same schedule a
 * real deployment would, and the interesting logic is the state machine.
 */

let env: TestEnv;

beforeAll(async () => {
  env = await startWorker();
}, 120_000);

afterAll(async () => {
  await env?.dispose();
});

const api = (path: string) => `/api/v1${path}`;

/** Create a real pending withdrawal and return its transaction id. */
async function createWithdrawal(amountMinor = 500_000) {
  const { client, user } = await signupClient(env.origin, {}, env.fetch);
  await creditWallet(env.db, user.id, amountMinor);

  const response = await client.post<{
    ok: boolean;
    data: { transactionId: string; status: string };
  }>(api('/wallet/withdraw'), {
    amountMinor,
    currency: 'NGN',
    method: 'bank',
    destination: '0123456789',
    idempotencyKey: `job-test-${Math.random().toString(36).slice(2)}`,
  });

  // A withdrawal is a created resource, so the route answers 201.
  expect(response.status).toBe(201);
  return { userId: user.id, transactionId: response.body.data.transactionId };
}

const statusOf = async (transactionId: string) =>
  (
    await env.db
      .prepare('SELECT status FROM transactions WHERE id = ?')
      .bind(transactionId)
      .first<{ status: string }>()
  )?.status;

describe('payout queue consumer', () => {
  it('leaves a withdrawal pending when no provider is configured', async () => {
    const { transactionId } = await createWithdrawal();

    // The whole point: without provider credentials the payout must NOT be
    // marked completed. Telling an affiliate their money moved when it did not
    // is the single worst thing this system could do.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await handlePayoutMessage(env.env, {
      kind: 'withdrawal',
      transactionId,
      userId: 'u',
      amountMinor: 500_000,
      feeMinor: 0,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      requestedAt: new Date().toISOString(),
    });

    expect(await statusOf(transactionId)).toBe('pending');
    expect(warn).toHaveBeenCalledWith(
      'payout_awaiting_provider_configuration',
      expect.objectContaining({ transactionId }),
    );
    warn.mockRestore();
  });

  it('ignores an unrecognised payload without throwing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(handlePayoutMessage(env.env, { kind: 'something-else' })).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith('payout_message_ignored', expect.anything());
    warn.mockRestore();
  });

  it('ignores a message for a transaction that does not exist', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      handlePayoutMessage(env.env, {
        kind: 'withdrawal',
        transactionId: 'no-such-transaction',
        userId: 'u',
        amountMinor: 1,
        feeMinor: 0,
        currency: 'NGN',
        method: 'bank',
        destination: '0123456789',
        requestedAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'payout_transaction_missing',
      expect.objectContaining({ transactionId: 'no-such-transaction' }),
    );
    warn.mockRestore();
  });

  it('is idempotent when a settlement is redelivered', async () => {
    const { transactionId } = await createWithdrawal();

    // Force the settled state the consumer would have written.
    await env.db
      .prepare("UPDATE transactions SET status = 'completed' WHERE id = ?")
      .bind(transactionId)
      .run();

    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await handlePayoutMessage(env.env, {
      kind: 'withdrawal',
      transactionId,
      userId: 'u',
      amountMinor: 500_000,
      feeMinor: 0,
      currency: 'NGN',
      method: 'bank',
      destination: '0123456789',
      requestedAt: new Date().toISOString(),
    });

    // A redelivery must not double-settle or double-notify.
    expect(await statusOf(transactionId)).toBe('completed');
    expect(log).toHaveBeenCalledWith('payout_already_settled', expect.objectContaining({ transactionId }));
    log.mockRestore();
  });
});

describe('cron: reconcileWallets', () => {
  it('detects and corrects drift between the counter and the ledger', async () => {
    const { client, user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 100_000);

    // Corrupt the cached counter so it disagrees with the authoritative ledger.
    // The ledger is the source of truth; the counter exists only for fast reads.
    await env.db
      .prepare('UPDATE wallets SET available_minor = available_minor + 99999 WHERE user_id = ?')
      .bind(user.id)
      .run();

    const before = await env.db
      .prepare('SELECT available_minor FROM wallets WHERE user_id = ?')
      .bind(user.id)
      .first<{ available_minor: number }>();
    expect(before?.available_minor).toBe(199_999);

    const result = await reconcileWallets(env.env);
    expect(result.corrected).toBeGreaterThanOrEqual(1);

    const after = await env.db
      .prepare('SELECT available_minor FROM wallets WHERE user_id = ?')
      .bind(user.id)
      .first<{ available_minor: number }>();
    // Recomputed from SUM(transactions), not patched by the delta.
    expect(after?.available_minor).toBe(100_000);
    void client;
  });

  it('records the discrepancy rather than fixing it silently', async () => {
    const { user } = await signupClient(env.origin, {}, env.fetch);
    await creditWallet(env.db, user.id, 50_000);
    await env.db
      .prepare('UPDATE wallets SET available_minor = available_minor + 7777 WHERE user_id = ?')
      .bind(user.id)
      .run();

    await reconcileWallets(env.env);

    // A silent correction hides whatever caused the drift. The row is the trail.
    const logged = await env.db
      .prepare('SELECT COUNT(*) AS total FROM wallet_reconciliations WHERE user_id = ?')
      .bind(user.id)
      .first<{ total: number }>();
    expect(logged?.total ?? 0).toBeGreaterThanOrEqual(1);
  });
});

describe('cron: expireStaleWithdrawals', () => {
  it('expires a withdrawal older than the window and refunds it', async () => {
    const { transactionId, userId } = await createWithdrawal();

    // Backdate past the 72-hour window.
    const stale = new Date(Date.now() - 96 * 3600_000).toISOString();
    await env.db
      .prepare('UPDATE transactions SET created_at = ?, updated_at = ? WHERE id = ?')
      .bind(stale, stale, transactionId)
      .run();

    const result = await expireStaleWithdrawals(env.env);
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(await statusOf(transactionId)).toBe('failed');

    // The debit is reversed — the affiliate must not lose money to a stuck payout.
    const wallet = await env.db
      .prepare('SELECT available_minor FROM wallets WHERE user_id = ?')
      .bind(userId)
      .first<{ available_minor: number }>();
    expect(wallet?.available_minor).toBe(500_000);
  });

  it('leaves a recent withdrawal alone', async () => {
    const { transactionId } = await createWithdrawal();
    await expireStaleWithdrawals(env.env);
    expect(await statusOf(transactionId)).toBe('pending');
  });
});

describe('cron: pruneExpiredSessions and ensureFxSeed', () => {
  it('prunes only sessions past the 7-day retention window', async () => {
    const { user } = await signupClient(env.origin, {}, env.fetch);

    // Long past the cutoff — this one should go.
    const ancient = new Date(Date.now() - 10 * 86_400_000).toISOString();
    await env.db
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, 'ancient-hash', ?, ?)`,
      )
      .bind(crypto.randomUUID(), user.id, ancient, ancient)
      .run();

    // Expired an hour ago. The job deliberately keeps these for seven days: a
    // freshly-expired token is exactly the evidence reuse detection needs, and
    // pruning it immediately would blind that check.
    const recent = new Date(Date.now() - 3600_000).toISOString();
    await env.db
      .prepare(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, 'recent-hash', ?, ?)`,
      )
      .bind(crypto.randomUUID(), user.id, recent, recent)
      .run();

    const result = await pruneExpiredSessions(env.env);
    expect(result.pruned).toBeGreaterThanOrEqual(1);

    const gone = await env.db
      .prepare("SELECT COUNT(*) AS total FROM refresh_tokens WHERE token_hash = 'ancient-hash'")
      .first<{ total: number }>();
    expect(gone?.total).toBe(0);

    const kept = await env.db
      .prepare("SELECT COUNT(*) AS total FROM refresh_tokens WHERE token_hash = 'recent-hash'")
      .first<{ total: number }>();
    expect(kept?.total).toBe(1);
  });

  it('seeds an FX rate on an empty table without duplicating it', async () => {
    await ensureFxSeed(env.env);
    const first = await env.db.prepare('SELECT COUNT(*) AS total FROM fx_rates').first<{ total: number }>();

    await ensureFxSeed(env.env);
    const second = await env.db.prepare('SELECT COUNT(*) AS total FROM fx_rates').first<{ total: number }>();

    // Idempotent: running the cron twice must not append a second row.
    expect(second?.total).toBe(first?.total);
    expect(first?.total ?? 0).toBeGreaterThan(0);
  });
});

describe('scheduled entry point', () => {
  it('runs the full cron cycle without throwing', async () => {
    const worker = (await import('../src/index')).default;
    const { scheduled } = worker;
    expect(typeof scheduled).toBe('function');

    await expect(
      // A ScheduledController, not a ScheduledEvent — the Worker handler type.
      scheduled(
        { cron: '15 3 * * *', scheduledTime: Date.now(), noRetry: () => {} } as never,
        env.env,
        { waitUntil: () => {}, passThroughOnException: () => {} } as never,
      ),
    ).resolves.toBeUndefined();
  });

  it('routes a queue batch to the payout consumer', async () => {
    const worker = (await import('../src/index')).default;
    const { queue } = worker;
    expect(typeof queue).toBe('function');

    const { transactionId } = await createWithdrawal();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      queue(
        {
          queue: 'affiliate-hub-payouts',
          messages: [
            {
              id: 'msg-1',
              timestamp: new Date(),
              body: {
                kind: 'withdrawal',
                transactionId,
                userId: 'u',
                amountMinor: 500_000,
                feeMinor: 0,
                currency: 'NGN',
                method: 'bank',
                destination: '0123456789',
                requestedAt: new Date().toISOString(),
              },
              ack: () => {},
              retry: () => {},
            },
          ],
        } as never,
        env.env,
        { waitUntil: () => {}, passThroughOnException: () => {} } as never,
      ),
    ).resolves.toBeUndefined();

    expect(await statusOf(transactionId)).toBe('pending');
    warn.mockRestore();
  });
});

describe('http surface still intact after importing the worker module', () => {
  it('serves health through the exported fetch handler', async () => {
    const client = makeClient(env.origin, { current: null }, env.fetch);
    const health = await client.get<{ ok: boolean; data: { status: string } }>(api('/health'));
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('ok');
  });
});
