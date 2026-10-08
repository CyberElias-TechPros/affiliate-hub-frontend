import type { AuthSession, LoginRequest, OnboardingRequest, PublicUser, SignupRequest } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { audit, notify, requireAuth } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { hashPassword, randomCode, sha256Hex, uuid, verifyPassword } from '../lib/crypto';
import { issueSession, rotateSession, revokeAllSessions } from '../lib/auth';
import { toPublicUser, type UserRow } from '../lib/repo';
import {
  loginSchema,
  onboardingSchema,
  parse,
  passwordChangeSchema,
  signupSchema,
} from '../lib/validate';
import { enforceRateLimit, rateLimitHeaders } from '../lib/rate-limit';
import {
  clearFailedLogins,
  lockoutRemainingSeconds,
  registerFailedLogin,
} from '../lib/security';

/** Unique, URL-safe referral slug for a new affiliate. */
async function allocateReferralCode(db: D1Database, name: string): Promise<string> {
  const stem =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '')
      .slice(0, 8) || 'aff';

  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = attempt === 0 ? `${stem}-${randomCode(4)}` : `${stem}-${randomCode(6)}`;
    const existing = await db
      .prepare('SELECT 1 FROM users WHERE referral_code = ?')
      .bind(candidate)
      .first();
    if (!existing) return candidate;
  }
  return `aff-${randomCode(10)}`;
}

export async function signup(c: Ctx): Promise<HandlerResult<AuthSession>> {
  // Per-IP throttle on account creation: the prototype's unauthenticated
  // social-auth endpoint was an unbounded account-creation oracle.
  const rl = await enforceRateLimit(c.env, 'signup', c.reqCtx.ip, 5, 60 * 60);

  const input = parseSignup(await readJson(c));

  if (input.referralCode) {
    const referrer = await c.db
      .prepare('SELECT id FROM users WHERE referral_code = ? AND deleted_at IS NULL')
      .bind(input.referralCode)
      .first<{ id: string }>();
    if (!referrer) throw HttpError.validation('That referral code is not valid.', { referralCode: 'Unknown referral code' });
  }

  const existing = await c.db
    .prepare('SELECT id FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(input.email)
    .first<{ id: string }>();
  if (existing) {
    // Deliberate tradeoff: this reveals that the email is registered. Telling a
    // new user "try signing in instead" is worth more than the enumeration
    // risk, which is bounded by the signup rate limit above.
    throw HttpError.conflict('An account with that email already exists. Try signing in instead.');
  }

  const now = new Date().toISOString();
  const id = uuid();
  const { formatted } = await hashPassword(input.password);
  const referralCode = await allocateReferralCode(c.db, input.name);

  await c.db
    .prepare(
      `INSERT INTO users (id, name, email, password_hash, country, referral_code, tier,
                          onboarding_completed, niches, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'starter', 0, '[]', ?, ?)`,
    )
    .bind(id, input.name, input.email, formatted, input.country ?? 'NG', referralCode, now, now)
    .run();

  const user = await mustGetUser(c.db, id);
  const tokens = await issueSession(c.env, c.db, user, c.reqCtx);

  c.user = user;
  await audit(c, 'auth.signup', 'user', id, { country: user.country });

  return json({ ...tokens, user: toPublicUser(user) }, 201, rateLimitHeaders(rl, 5));
}

export async function login(c: Ctx): Promise<HandlerResult<AuthSession>> {
  const rl = await enforceRateLimit(c.env, 'login', c.reqCtx.ip, 10, 60);
  const input = parse(loginSchema, await readJson(c)) as LoginRequest;

  // Durable lockout: unlike the rate limiter this cannot fail open.
  const lockedFor = await lockoutRemainingSeconds(c.db, input.email, c.reqCtx.ip);
  if (lockedFor > 0) {
    throw new HttpError(
      429,
      'rate_limited',
      `Too many failed sign-in attempts. Try again in ${Math.ceil(lockedFor / 60)} minute(s).`,
    );
  }

  const user = await c.db
    .prepare('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL')
    .bind(input.email)
    .first<UserRow>();

  // Always run a verification, even for an unknown email, so response latency
  // does not distinguish "no such account" from "wrong password".
  const passwordMatches = user
    ? await verifyPassword(input.password, user.password_hash)
    : await verifyPassword(input.password, DUMMY_HASH);

  if (!user || !passwordMatches) {
    await registerFailedLogin(c.db, input.email, c.reqCtx.ip);
    await audit(c, 'auth.login_failed', 'user', user?.id ?? null, { email: input.email });
    // Identical message either way — no account enumeration.
    throw HttpError.unauthenticated('Incorrect email or password.');
  }

  if (user.status !== 'active') throw HttpError.forbidden('This account is suspended.');

  await clearFailedLogins(c.db, input.email);
  await c.db
    .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), user.id)
    .run();

  const tokens = await issueSession(c.env, c.db, user, c.reqCtx);

  c.user = user;
  await audit(c, 'auth.login', 'user', user.id, {});

  return json({ ...tokens, user: toPublicUser(user) }, 200, rateLimitHeaders(rl, 10));
}

export async function refresh(c: Ctx): Promise<HandlerResult<AuthSession>> {
  const body = (await readJson(c)) as { refreshToken?: unknown };
  const refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken.trim() : '';
  if (!refreshToken) throw HttpError.validation('A refresh token is required.', { refreshToken: 'Required' });

  const result = await rotateSession(c.env, c.db, refreshToken, c.reqCtx);
  return json({ ...result.tokens, user: result.user });
}

export async function logout(c: Ctx): Promise<HandlerResult<{ revoked: boolean }>> {
  const user = await requireAuth(c);
  const body = (await readJson(c).catch(() => ({}))) as { refreshToken?: unknown };

  if (typeof body.refreshToken === 'string' && body.refreshToken) {
    await c.db
      .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ? AND user_id = ?')
      .bind(new Date().toISOString(), await sha256Hex(body.refreshToken), user.id)
      .run();
  } else {
    await revokeAllSessions(c.db, user.id);
  }

  c.user = user;
  await audit(c, 'auth.logout', 'user', user.id, {});
  return json({ revoked: true });
}

export async function me(c: Ctx): Promise<HandlerResult<{ user: PublicUser }>> {
  const user = await requireAuth(c);
  return json({ user: toPublicUser(user) });
}

export async function changePassword(c: Ctx): Promise<HandlerResult<{ changed: boolean }>> {
  const user = await requireAuth(c);
  const input = parse(passwordChangeSchema, await readJson(c));

  const matches = await verifyPassword(input.currentPassword, user.password_hash);
  if (!matches) {
    await registerFailedLogin(c.db, user.email, c.reqCtx.ip);
    c.user = user;
    await audit(c, 'auth.password_change_failed', 'user', user.id, {});
    throw HttpError.validation('Your current password is not correct.', {
      currentPassword: 'Incorrect password',
    });
  }

  const { formatted } = await hashPassword(input.newPassword);
  await c.db
    .prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .bind(formatted, new Date().toISOString(), user.id)
    .run();

  // A password change invalidates every other device.
  await revokeAllSessions(c.db, user.id);

  c.user = user;
  await audit(c, 'auth.password_changed', 'user', user.id, {});
  await notify(c, user.id, 'Password changed', 'Your password was changed and other devices were signed out.', '/profile/security');

  return json({ changed: true });
}

export async function completeOnboarding(c: Ctx): Promise<HandlerResult<{ user: PublicUser }>> {
  const user = await requireAuth(c);
  const input = onboardingSchema.parse(await readJson(c)) as OnboardingRequest;

  await c.db
    .prepare(
      `UPDATE users SET country = ?, niches = ?, whatsapp = ?, onboarding_completed = 1, updated_at = ?
       WHERE id = ?`,
    )
    .bind(input.country, JSON.stringify(input.niches), input.whatsapp ?? null, new Date().toISOString(), user.id)
    .run();

  const updated = await mustGetUser(c.db, user.id);
  c.user = updated;
  await audit(c, 'profile.onboarding_completed', 'user', user.id, { niches: input.niches });

  return json({ user: toPublicUser(updated) });
}

/* -------------------------------- helpers -------------------------------- */

function parseSignup(raw: unknown): SignupRequest {
  // `parse()` (not Zod's `.parse`) so a rejected field surfaces as a 400 with
  // per-field messages instead of an unhandled ZodError becoming a 500.
  return parse(signupSchema, raw) as SignupRequest;
}

async function mustGetUser(db: D1Database, id: string): Promise<UserRow> {
  const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<UserRow>();
  if (!user) throw HttpError.internal();
  return user;
}

export async function readJson(c: Ctx): Promise<unknown> {
  try {
    return await c.request.json();
  } catch {
    throw HttpError.validation('Expected a JSON request body.');
  }
}

/**
 * A pre-computed hash of a random password. Verifying against it on the
 * unknown-email path keeps timing uniform without leaking which emails exist.
 * Regenerating one per request would cost 210k PBKDF2 rounds on every miss.
 */
const DUMMY_HASH =
  'pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
