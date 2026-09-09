import type {
  Currency,
  Money,
  Page,
  PayoutOption,
  Transaction,
  WalletSummary,
  WithdrawResult,
} from '../../../shared/api-contract';
import { ERROR_CODES, formatMoney } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { audit, notify, requireAuth } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { buildPage, money, toTransaction, type TransactionRow } from '../lib/repo';
import { parse, transactionQuerySchema, withdrawSchema } from '../lib/validate';
import { destinationIssue, feeFor, payoutOptions, PAYOUT_CONFIG } from '../lib/payouts';
import { enforceRateLimit } from '../lib/rate-limit';
import { getFxRate } from '../lib/fx';
import { batchAs, firstRow } from '../lib/db';
import type { WithdrawRequest } from '../../../shared/api-contract';

const DEFAULT_PAGE_SIZE = 20;

export async function summary(c: Ctx): Promise<HandlerResult<WalletSummary>> {
  const user = await requireAuth(c);

  const wallet = await c.db
    .prepare('SELECT currency, available_minor, pending_minor FROM wallets WHERE user_id = ?')
    .bind(user.id)
    .first<{ currency: string; available_minor: number; pending_minor: number }>();

  const availableMinor = wallet?.available_minor ?? 0;
  const pendingMinor = wallet?.pending_minor ?? 0;
  const currency = (wallet?.currency as Currency) ?? 'NGN';

  const lifetimeRow = await c.db
    .prepare(
      `SELECT COALESCE(SUM(amount_minor), 0) AS lifetime FROM transactions
       WHERE user_id = ? AND status = 'completed' AND amount_minor > 0`,
    )
    .bind(user.id)
    .first<{ lifetime: number }>();

  const fx = await getFxRate(c.env, c.db, currency, currency === 'NGN' ? 'USD' : 'NGN');

  return json({
    available: money(availableMinor, currency),
    pending: money(pendingMinor, currency),
    lifetimeEarnings: money(lifetimeRow?.lifetime ?? 0, currency),
    availableSecondary: convert(availableMinor, currency, fx.rateScaled, fx.quote),
    fxRate: fx,
  });
}

export async function transactions(c: Ctx): Promise<HandlerResult<Page<Transaction>>> {
  const user = await requireAuth(c);
  const query = parse(transactionQuerySchema, Object.fromEntries(c.url.searchParams));
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

  const where = ['t.user_id = ?'];
  const bindings: (string | number)[] = [user.id];
  if (query.status) {
    where.push('t.status = ?');
    bindings.push(query.status);
  }
  if (query.type) {
    where.push('t.type = ?');
    bindings.push(query.type);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [listRes, countRes] = await batchAs<
    [
      D1Result<TransactionRow & { product_title: string | null }>,
      D1Result<{ total: number }>,
    ]
  >(c.db, [
    c.db
      .prepare(
        `SELECT t.*, p.title AS product_title
           FROM transactions t
           LEFT JOIN products p ON p.id = t.product_id
           ${whereSql}
           ORDER BY t.created_at DESC, t.id DESC
           LIMIT ? OFFSET ?`,
      )
      .bind(...bindings, pageSize, (page - 1) * pageSize),
    c.db.prepare(`SELECT COUNT(*) AS total FROM transactions t ${whereSql}`).bind(...bindings),
  ]);

  const rows = listRes.results ?? [];
  const countRow = firstRow(countRes);
  const items = rows.map((row) => toTransaction(row, row.product_title));
  return json(buildPage(items, page, pageSize, countRow?.total ?? 0));
}

export async function options(c: Ctx): Promise<HandlerResult<{ options: PayoutOption[] }>> {
  await requireAuth(c);
  const currency = c.url.searchParams.get('currency') as Currency | null;
  return json({ options: payoutOptions(currency ?? undefined) });
}

/**
 * Request a withdrawal.
 *
 * Three properties matter, and each one fixes a specific prototype bug:
 *
 *  1. POSITIVE-ONLY AMOUNTS. The prototype accepted a negative amount; because
 *     the balance summed `-amount` for debits, a negative withdrawal *added*
 *     money. `withdrawSchema` rejects non-positive values outright.
 *
 *  2. ATOMICITY. Balance was read with a SELECT and the debit inserted in a
 *     later statement, so two concurrent requests both passed the check. Here
 *     the ledger insert and the counter decrement run in one D1 batch (a single
 *     SQLite transaction) and are both guarded by `available_minor >= total`,
 *     so exactly one racer can win.
 *
 *  3. IDEMPOTENCY. A retried submit (double tap, flaky network) returns the
 *     original result instead of paying twice, enforced by a unique index on
 *     (user_id, idempotency_key).
 */
export async function withdraw(c: Ctx): Promise<HandlerResult<WithdrawResult>> {
  const user = await requireAuth(c);
  await enforceRateLimit(c.env, 'withdraw', user.id, 5, 60 * 60);

  const input = parse(withdrawSchema, await readBody(c)) as WithdrawRequest;

  const config = PAYOUT_CONFIG[input.method];
  if (!config) throw HttpError.validation('Unknown payout method.', { method: 'Unknown method' });

  if (!config.currencies.includes(input.currency)) {
    throw HttpError.validation(`${config.label} pays out in ${config.currencies.join(' or ')}.`, {
      currency: `Not supported for ${config.label}`,
    });
  }

  if (input.amountMinor < config.minimumMinor) {
    throw new HttpError(
      400,
      ERROR_CODES.WITHDRAWAL_BELOW_MINIMUM,
      `The minimum withdrawal for ${config.label} is ${formatMoney(
        money(config.minimumMinor, input.currency),
      )}.`,
      { amountMinor: 'Below the minimum for this method' },
    );
  }

  const destinationProblem = destinationIssue(input.method, input.destination);
  if (destinationProblem) {
    throw HttpError.validation('Check your payout details.', { destination: destinationProblem });
  }

  const wallet = await c.db
    .prepare('SELECT currency, available_minor FROM wallets WHERE user_id = ?')
    .bind(user.id)
    .first<{ currency: string; available_minor: number }>();

  if (wallet && wallet.currency !== input.currency) {
    throw HttpError.validation(`Your wallet holds ${wallet.currency}.`, {
      currency: `Wallet currency is ${wallet.currency}`,
    });
  }

  const fee = feeFor(input.method, input.amountMinor);
  const totalDebit = input.amountMinor + fee;
  const now = new Date().toISOString();
  const transactionId = crypto.randomUUID();

  // Replay detection: same key, same user -> return the original outcome.
  const existing = await findByIdempotencyKey(c.db, user.id, input.idempotencyKey);
  if (existing) {
    return json(
      {
        transactionId: existing.id,
        status: existing.status as WithdrawResult['status'],
        amount: money(Math.abs(existing.amount_minor), existing.currency as Currency),
        fee: money(existing.fee_minor, existing.currency as Currency),
        idempotencyKey: input.idempotencyKey,
        deduplicated: true,
        availableAfter: money(wallet?.available_minor ?? 0, (existing.currency as Currency) ?? input.currency),
      },
      200,
    );
  }

  const description = `Withdrawal via ${config.label}`;

  try {
    const results = await c.db.batch([
      // Ledger row: inserted only while funds are sufficient. `SELECT ... WHERE
      // EXISTS` makes the insert itself conditional, so it cannot outlive a
      // failed debit.
      c.db
        .prepare(
          `INSERT INTO transactions
             (id, user_id, type, status, amount_minor, fee_minor, currency, description,
              payout_method, idempotency_key, created_at, updated_at)
           SELECT ?, ?, 'withdrawal', 'pending', ?, ?, ?, ?, ?, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM wallets WHERE user_id = ? AND available_minor >= ?
            )`,
        )
        .bind(
          transactionId,
          user.id,
          -input.amountMinor, // debits are negative; sign lives in the ledger
          fee,
          input.currency,
          description,
          input.method,
          input.idempotencyKey,
          now,
          now,
          user.id,
          totalDebit,
        ),
      // Counter decrement, guarded by the same condition.
      c.db
        .prepare(
          `UPDATE wallets
              SET available_minor = available_minor - ?, pending_minor = pending_minor + ?, updated_at = ?
            WHERE user_id = ? AND available_minor >= ?`,
        )
        .bind(totalDebit, input.amountMinor, now, user.id, totalDebit),
    ]);

    const debited = results[1].meta.changes === 1;
    if (!debited) {
      c.user = user;
      await audit(c, 'wallet.withdraw_insufficient', 'wallet', user.id, {
        requested: input.amountMinor,
      });
      throw new HttpError(
        400,
        ERROR_CODES.INSUFFICIENT_FUNDS,
        'You do not have enough available balance for that withdrawal.',
      );
    }
  } catch (error) {
    // A unique-constraint failure here means an identical request landed
    // concurrently. Return its result rather than an opaque 500.
    if (isUniqueConstraintError(error)) {
      const winner = await findByIdempotencyKey(c.db, user.id, input.idempotencyKey);
      if (winner) {
        return json({
          transactionId: winner.id,
          status: winner.status as WithdrawResult['status'],
          amount: money(Math.abs(winner.amount_minor), winner.currency as Currency),
          fee: money(winner.fee_minor, winner.currency as Currency),
          idempotencyKey: input.idempotencyKey,
          deduplicated: true,
          availableAfter: money(wallet?.available_minor ?? 0, input.currency),
        });
      }
    }
    throw error;
  }

  const availableAfter = Math.max(0, (wallet?.available_minor ?? 0) - totalDebit);

  // Settlement is asynchronous: the user gets an immediate acknowledgement and
  // the payout provider call happens off the request path.
  c.executionCtx.waitUntil(
    c.env.PAYOUTS.send({
      kind: 'withdrawal',
      transactionId,
      userId: user.id,
      amountMinor: input.amountMinor,
      feeMinor: fee,
      currency: input.currency,
      method: input.method,
      destination: input.destination,
      requestedAt: now,
    }),
  );

  c.user = user;
  await audit(c, 'wallet.withdraw_requested', 'transaction', transactionId, {
    amountMinor: input.amountMinor,
    feeMinor: fee,
    method: input.method,
    currency: input.currency,
  });
  await notify(
    c,
    user.id,
    'Withdrawal started',
    `${formatMoney(money(input.amountMinor, input.currency))} is on its way via ${config.label}.`,
    '/wallet',
  );

  return json({
    transactionId,
    status: 'pending' as const,
    amount: money(input.amountMinor, input.currency),
    fee: money(fee, input.currency),
    idempotencyKey: input.idempotencyKey,
    deduplicated: false,
    availableAfter: money(availableAfter, input.currency),
  }, 201);
}

/* -------------------------------- helpers -------------------------------- */

async function findByIdempotencyKey(
  db: D1Database,
  userId: string,
  key: string,
): Promise<TransactionRow | null> {
  return (
    (await db
      .prepare('SELECT * FROM transactions WHERE user_id = ? AND idempotency_key = ?')
      .bind(userId, key)
      .first<TransactionRow>()) ?? null
  );
}

function isUniqueConstraintError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(message);
}

function convert(amountMinor: number, _from: Currency, rateScaled: number, quote: Currency): Money {
  // rateScaled is quote-per-base scaled by 1e6.
  return money(Math.round((amountMinor * rateScaled) / 1_000_000), quote);
}

async function readBody(c: Ctx): Promise<unknown> {
  try {
    return await c.request.json();
  } catch {
    throw HttpError.validation('Expected a JSON request body.');
  }
}
