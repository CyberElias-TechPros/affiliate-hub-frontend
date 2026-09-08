import type { Env } from './lib/env';

/**
 * Scheduled maintenance jobs, invoked by the cron trigger in wrangler.toml.
 *
 * Each returns a count so the cron log line is actually useful rather than
 * "job ran".
 */

/**
 * Reconcile `wallets.available_minor` against the transactions ledger.
 *
 * The counter exists purely to make withdrawals atomic; the ledger is the
 * source of truth. If they disagree, the ledger wins and the discrepancy is
 * recorded for audit rather than silently patched.
 */
export async function reconcileWallets(env: Env): Promise<{ checked: number; corrected: number }> {
  const db = env.DB;
  const wallets = await db
    .prepare('SELECT user_id, currency, available_minor FROM wallets')
    .all<{ user_id: string; currency: string; available_minor: number }>();

  let corrected = 0;

  for (const wallet of wallets.results ?? []) {
    const ledger = await db
      .prepare(
        `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM transactions
          WHERE user_id = ? AND status = 'completed'`,
      )
      .bind(wallet.user_id)
      .first<{ total: number }>();

    const ledgerTotal = ledger?.total ?? 0;
    if (ledgerTotal === wallet.available_minor) continue;

    const delta = ledgerTotal - wallet.available_minor;
    const now = new Date().toISOString();

    await db.batch([
      db
        .prepare('UPDATE wallets SET available_minor = ?, updated_at = ? WHERE user_id = ?')
        .bind(ledgerTotal, now, wallet.user_id),
      db
        .prepare(
          `INSERT INTO wallet_reconciliations
             (id, user_id, counter_minor, ledger_minor, delta_minor, action_taken, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          wallet.user_id,
          wallet.available_minor,
          ledgerTotal,
          delta,
          'counter_reset_to_ledger',
          now,
        ),
    ]);

    corrected++;
    console.warn('wallet_drift_corrected', {
      userId: wallet.user_id,
      counterMinor: wallet.available_minor,
      ledgerMinor: ledgerTotal,
      deltaMinor: delta,
    });
  }

  return { checked: wallets.results?.length ?? 0, corrected };
}

/**
 * Withdrawals stuck in `pending` are returned to the wallet after 72 hours.
 *
 * Without this, a payout provider that never calls back would hold an
 * affiliate's money indefinitely. Returning funds is the safe direction: a
 * double payment is recoverable, a permanently frozen balance is not.
 */
const STALE_WITHDRAWAL_HOURS = 72;

export async function expireStaleWithdrawals(env: Env): Promise<{ expired: number }> {
  const db = env.DB;
  const cutoff = new Date(Date.now() - STALE_WITHDRAWAL_HOURS * 3_600_000).toISOString();
  const now = new Date().toISOString();

  const stale = await db
    .prepare(
      `SELECT id, user_id, amount_minor, fee_minor FROM transactions
        WHERE type = 'withdrawal' AND status = 'pending' AND created_at < ?`,
    )
    .bind(cutoff)
    .all<{ id: string; user_id: string; amount_minor: number; fee_minor: number }>();

  let expired = 0;

  for (const tx of stale.results ?? []) {
    // Reversal amount is positive: the ledger stored the debit as negative.
    const reversal = Math.abs(tx.amount_minor) + tx.fee_minor;
    await db.batch([
      db
        .prepare("UPDATE transactions SET status = 'failed', updated_at = ? WHERE id = ? AND status = 'pending'")
        .bind(now, tx.id),
      db
        .prepare(
          `INSERT INTO transactions
             (id, user_id, type, status, amount_minor, fee_minor, currency, description, created_at, updated_at)
           SELECT ?, ?, 'adjustment', 'completed', ?, 0,
                  (SELECT currency FROM transactions WHERE id = ?),
                  'Automatic reversal: withdrawal did not settle', ?, ?
            WHERE EXISTS (SELECT 1 FROM transactions WHERE id = ? AND status = 'failed')`,
        )
        .bind(crypto.randomUUID(), tx.user_id, reversal, tx.id, now, now, tx.id),
      db
        .prepare(
          `UPDATE wallets
              SET available_minor = available_minor + ?,
                  pending_minor = MAX(0, pending_minor - ?),
                  updated_at = ?
            WHERE user_id = ?`,
        )
        .bind(reversal, Math.abs(tx.amount_minor), now, tx.user_id),
    ]);
    expired++;
  }

  return { expired };
}

/**
 * Drop refresh tokens that expired more than a week ago.
 *
 * Revoked rows are kept briefly so reuse detection still works, then removed.
 */
export async function pruneExpiredSessions(env: Env): Promise<{ pruned: number }> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const result = await env.DB.prepare(
    'DELETE FROM refresh_tokens WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)',
  )
    .bind(cutoff, cutoff)
    .run();
  return { pruned: result.meta.changes };
}

/**
 * Seed the FX rate when none exists yet.
 *
 * Uses the documented fallback and labels it as such, so the wallet renders
 * correctly on a fresh deployment instead of showing a blank secondary
 * balance. Replaced as soon as a real rate is ingested.
 */
export async function ensureFxSeed(env: Env): Promise<void> {
  const existing = await env.DB.prepare('SELECT COUNT(*) AS total FROM fx_rates').first<{ total: number }>();
  if ((existing?.total ?? 0) > 0) return;

  const { storeFxRate } = await import('./lib/fx');
  await storeFxRate(env, env.DB, 'NGN', 'USD', 1 / 1500, 'bootstrap-default');
  await storeFxRate(env, env.DB, 'USD', 'NGN', 1500, 'bootstrap-default');
}
