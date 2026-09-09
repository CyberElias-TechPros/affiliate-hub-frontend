import type { Env } from './env';
import { HttpError } from './errors';
import { hashPassword, verifyPassword, uuid, sha256Hex } from './crypto';

/**
 * Account-level brute-force protection.
 *
 * This is deliberately backed by D1 rather than the rate-limiter Durable
 * Object: a durable counter cannot "fail open" during a DO hiccup, so an
 * attacker cannot reset their budget by inducing errors.
 *
 * Policy: after MAX_ATTEMPTS failed password checks for one email within
 * WINDOW_MS, further attempts are refused until the window expires. Counters
 * are keyed by email *and* by IP so a shared NAT is not locked out by one
 * abusive neighbour, while a credential-stuffing bot rotating emails still
 * trips the IP key.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_SECONDS = 15 * 60;

interface FailedLoginRow {
  id: string;
  bucket_key: string;
  created_at: string;
}

export async function registerFailedLogin(db: D1Database, email: string, ip: string): Promise<void> {
  const now = new Date().toISOString();
  const keys = [`email:${email.toLowerCase()}`, `ip:${ip}`];
  const statements = keys.map((key) =>
    db
      .prepare('INSERT INTO failed_logins (id, bucket_key, created_at) VALUES (?, ?, ?)')
      .bind(uuid(), key, now),
  );
  await db.batch(statements);
  await pruneFailedLogins(db);
}

export async function clearFailedLogins(db: D1Database, email: string): Promise<void> {
  await db
    .prepare('DELETE FROM failed_logins WHERE bucket_key = ?')
    .bind(`email:${email.toLowerCase()}`)
    .run();
}

/** Returns seconds remaining on a lockout, or 0 when not locked. */
export async function lockoutRemainingSeconds(
  db: D1Database,
  email: string,
  ip: string,
): Promise<number> {
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  const keys = [`email:${email.toLowerCase()}`, `ip:${ip}`];
  const placeholders = keys.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT created_at FROM failed_logins
       WHERE bucket_key IN (${placeholders}) AND created_at > ?
       ORDER BY created_at DESC`,
    )
    .bind(...keys, cutoff)
    .all<{ created_at: string }>();

  const rows = results ?? [];
  if (rows.length < MAX_ATTEMPTS) return 0;

  const oldestInWindow = new Date(rows[MAX_ATTEMPTS - 1].created_at).getTime();
  const expiresAt = oldestInWindow + WINDOW_MS;
  const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
  return Math.max(0, Math.min(remaining, LOCK_SECONDS));
}

async function pruneFailedLogins(db: D1Database): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MS).toISOString();
  await db.prepare('DELETE FROM failed_logins WHERE created_at <= ?').bind(cutoff).run();
}

export { MAX_ATTEMPTS, WINDOW_MS, LOCK_SECONDS };

/**
 * Password policy helpers shared with the frontend so the client can give
 * immediate feedback without the server being the only source of truth.
 */
export const PASSWORD_MIN_LENGTH = 10;

export function passwordPolicyIssue(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (password.length > 200) return 'Password is too long';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number';
  }
  return null;
}

export { hashPassword, verifyPassword, sha256Hex };
export type { FailedLoginRow };
