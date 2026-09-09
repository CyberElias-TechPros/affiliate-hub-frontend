import type { BankDetails, PublicUser } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { audit, requireAuth } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { toPublicUser, type UserRow } from '../lib/repo';
import { bankDetailsSchema, goalSchema, parse, profileUpdateSchema } from '../lib/validate';
import { decryptField, encryptField } from '../lib/crypto';

export async function getProfile(c: Ctx): Promise<HandlerResult<{ user: PublicUser; bank: BankDetails }>> {
  const user = await requireAuth(c);

  const bankRow = await c.db
    .prepare('SELECT bank_name, account_name, account_number_mask FROM bank_details WHERE user_id = ?')
    .bind(user.id)
    .first<{ bank_name: string | null; account_name: string | null; account_number_mask: string | null }>();

  return json({
    user: toPublicUser(user),
    bank: {
      bankName: bankRow?.bank_name ?? null,
      accountName: bankRow?.account_name ?? null,
      // Only the masked value ever leaves the server.
      accountNumberMasked: bankRow?.account_number_mask ?? null,
    },
  });
}

export async function updateProfile(c: Ctx): Promise<HandlerResult<{ user: PublicUser }>> {
  const user = await requireAuth(c);
  const input = parse(profileUpdateSchema, await readBody(c));

  const updates: string[] = [];
  const bindings: (string | null)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    bindings.push(input.name);
  }
  if (input.country !== undefined) {
    updates.push('country = ?');
    bindings.push(input.country);
  }
  if (input.whatsapp !== undefined) {
    updates.push('whatsapp = ?');
    bindings.push(input.whatsapp);
  }
  if (input.niches !== undefined) {
    updates.push('niches = ?');
    bindings.push(JSON.stringify(input.niches));
  }

  if (updates.length === 0) {
    return json({ user: toPublicUser(user) });
  }

  updates.push('updated_at = ?');
  bindings.push(new Date().toISOString(), user.id);

  await c.db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).bind(...bindings).run();

  const updated = (await c.db
    .prepare('SELECT * FROM users WHERE id = ?')
    .bind(user.id)
    .first<UserRow>()) as UserRow;

  c.user = updated;
  await audit(c, 'profile.updated', 'user', user.id, {
    fields: Object.keys(input),
  });

  return json({ user: toPublicUser(updated) });
}

/**
 * Store payout bank details.
 *
 * The account number is encrypted with AES-GCM before it reaches D1 and is
 * only ever returned masked. The prototype stored it in plaintext.
 */
export async function updateBankDetails(c: Ctx): Promise<HandlerResult<{ bank: BankDetails }>> {
  const user = await requireAuth(c);
  const input = parse(bankDetailsSchema, await readBody(c));

  const encrypted = await encryptField(input.accountNumber, c.env.FIELD_ENCRYPTION_KEY);
  const masked = maskAccountNumber(input.accountNumber);

  await c.db
    .prepare(
      `INSERT INTO bank_details (user_id, bank_name, account_name, account_number_enc, account_number_mask, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         bank_name = excluded.bank_name,
         account_name = excluded.account_name,
         account_number_enc = excluded.account_number_enc,
         account_number_mask = excluded.account_number_mask,
         updated_at = excluded.updated_at`,
    )
    .bind(user.id, input.bankName, input.accountName, encrypted, masked, new Date().toISOString())
    .run();

  c.user = user;
  // Metadata only. Never log the account number, masked or otherwise.
  await audit(c, 'profile.bank_details_updated', 'user', user.id, { bankName: input.bankName });

  return json({
    bank: { bankName: input.bankName, accountName: input.accountName, accountNumberMasked: masked },
  });
}

/**
 * Verify a stored account number matches a supplied value.
 *
 * Used by the withdrawal confirmation step without ever sending the number to
 * the browser. Decryption happens server-side only.
 */
export async function verifyBankDetails(c: Ctx): Promise<HandlerResult<{ matches: boolean }>> {
  const user = await requireAuth(c);
  const body = (await readBody(c)) as { accountNumber?: unknown };
  const candidate = typeof body.accountNumber === 'string' ? body.accountNumber.trim() : '';
  if (!candidate) throw HttpError.validation('Enter your account number.', { accountNumber: 'Required' });

  const row = await c.db
    .prepare('SELECT account_number_enc FROM bank_details WHERE user_id = ?')
    .bind(user.id)
    .first<{ account_number_enc: string | null }>();

  if (!row?.account_number_enc) return json({ matches: false });

  try {
    const stored = await decryptField(row.account_number_enc, c.env.FIELD_ENCRYPTION_KEY);
    return json({ matches: stored === candidate });
  } catch {
    return json({ matches: false });
  }
}

export async function getGoal(
  c: Ctx,
): Promise<HandlerResult<{ targetMinor: number; currency: string; period: string } | null>> {
  const user = await requireAuth(c);
  const row = await c.db
    .prepare('SELECT target_minor, currency, period FROM affiliate_goals WHERE user_id = ?')
    .bind(user.id)
    .first<{ target_minor: number; currency: string; period: string }>();
  return json(row ? { targetMinor: row.target_minor, currency: row.currency, period: row.period } : null);
}

export async function setGoal(
  c: Ctx,
): Promise<HandlerResult<{ targetMinor: number; currency: string; period: string }>> {
  const user = await requireAuth(c);
  const input = parse(goalSchema, await readBody(c));

  await c.db
    .prepare(
      `INSERT INTO affiliate_goals (user_id, target_minor, currency, period, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         target_minor = excluded.target_minor,
         currency = excluded.currency,
         period = excluded.period,
         updated_at = excluded.updated_at`,
    )
    .bind(user.id, input.targetMinor, input.currency, input.period ?? 'monthly', new Date().toISOString())
    .run();

  c.user = user;
  await audit(c, 'profile.goal_set', 'user', user.id, { targetMinor: input.targetMinor });

  return json({
    targetMinor: input.targetMinor,
    currency: input.currency,
    period: input.period ?? 'monthly',
  });
}

function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length <= 4) return '••••';
  return `${'•'.repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

async function readBody(c: Ctx): Promise<unknown> {
  try {
    return await c.request.json();
  } catch {
    throw HttpError.validation('Expected a JSON request body.');
  }
}
