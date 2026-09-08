import type { AuthTokens, PublicUser } from '../../../shared/api-contract';
import type { Env } from './env';
import type { RequestContext } from './respond';
import { HttpError } from './errors';
import { randomBytes, sha256Hex, signToken, uuid, verifyToken, TokenError } from './crypto';
import type { UserRow } from './repo';
import { toPublicUser } from './repo';

const ACCESS_TTL_DEFAULT = 15 * 60; // 15 minutes
const REFRESH_TTL_DEFAULT = 30 * 24 * 60 * 60; // 30 days

function accessTtl(env: Env): number {
  const parsed = Number.parseInt(env.ACCESS_TOKEN_TTL_SECONDS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : ACCESS_TTL_DEFAULT;
}

function refreshTtl(env: Env): number {
  const parsed = Number.parseInt(env.REFRESH_TOKEN_TTL_SECONDS ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : REFRESH_TTL_DEFAULT;
}

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Create a fresh access + refresh token pair for a user.
 *
 * The refresh token is returned to the client in full but stored only as a
 * SHA-256 hash, so a database compromise does not yield usable sessions.
 */
export async function issueSession(
  env: Env,
  db: D1Database,
  user: UserRow,
  ctx: RequestContext,
): Promise<AuthTokens> {
  const now = Math.floor(Date.now() / 1000);
  const accessExpires = now + accessTtl(env);
  const refreshExpiresAt = new Date((now + refreshTtl(env)) * 1000).toISOString();

  const accessToken = await signToken(
    { sub: user.id, typ: 'access', iat: now, exp: accessExpires },
    env.ACCESS_TOKEN_SECRET,
  );

  const tokenId = uuid();
  const refreshTokenRaw = `${tokenId}.${base64Url(randomBytes(32))}`;
  const refreshTokenHash = await sha256Hex(refreshTokenRaw);

  await db
    .prepare(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      tokenId,
      user.id,
      refreshTokenHash,
      refreshExpiresAt,
      ctx.userAgent.slice(0, 300),
      ctx.ip,
      new Date().toISOString(),
    )
    .run();

  return { accessToken, refreshToken: refreshTokenRaw, expiresIn: accessTtl(env) };
}

/**
 * Rotate a refresh token.
 *
 * Rotation with reuse detection: presenting a token that has already been
 * rotated is treated as theft — the whole family is revoked. This limits the
 * blast radius of a leaked refresh token to the first attacker to use it.
 */
export async function rotateSession(
  env: Env,
  db: D1Database,
  refreshToken: string,
  ctx: RequestContext,
): Promise<AuthSessionResult> {
  const [tokenId, secretPart] = refreshToken.split('.');
  if (!tokenId || !secretPart) throw HttpError.unauthenticated('Session expired. Please sign in again.');

  const tokenHash = await sha256Hex(refreshToken);
  const row = await db
    .prepare(
      `SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?`,
    )
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>();

  if (!row) throw HttpError.unauthenticated('Session expired. Please sign in again.');

  if (row.revoked_at) {
    // Reuse of a rotated token — assume compromise and kill every session.
    await db
      .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
      .bind(new Date().toISOString(), row.user_id)
      .run();
    throw HttpError.unauthenticated('Session was reused and has been revoked. Please sign in again.');
  }

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    throw HttpError.unauthenticated('Session expired. Please sign in again.');
  }

  const user = await db
    .prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(row.user_id)
    .first<UserRow>();
  if (!user) throw HttpError.unauthenticated('Account no longer exists.');

  // Revoke the presented token before issuing its replacement.
  const newTokens = await issueSession(env, db, user, ctx);
  const newTokenId = await resolveTokenId(newTokens.refreshToken);
  await db
    .prepare('UPDATE refresh_tokens SET revoked_at = ?, replaced_by_id = ? WHERE id = ?')
    .bind(new Date().toISOString(), newTokenId, row.id)
    .run();

  return { tokens: newTokens, user: toPublicUser(user) };
}

async function resolveTokenId(raw: string): Promise<string> {
  return raw.split('.')[0];
}

export interface AuthSessionResult {
  tokens: AuthTokens;
  user: PublicUser;
}

/** Revoke every refresh token belonging to a user ("sign out everywhere"). */
export async function revokeAllSessions(db: D1Database, userId: string): Promise<void> {
  await db
    .prepare('UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL')
    .bind(new Date().toISOString(), userId)
    .run();
}

/** Verify a Bearer access token and return the authenticated user row. */
export async function authenticate(
  request: Request,
  env: Env,
  db: D1Database,
): Promise<UserRow> {
  const header = request.headers.get('authorization');
  if (!header) throw HttpError.unauthenticated();

  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) throw HttpError.unauthenticated();

  let payload;
  try {
    payload = await verifyToken(match[1].trim(), env.ACCESS_TOKEN_SECRET);
  } catch (error) {
    if (error instanceof TokenError) {
      throw HttpError.unauthenticated(
        error.message === 'token expired'
          ? 'Your session expired. Please sign in again.'
          : 'Your session is not valid. Please sign in again.',
      );
    }
    throw error;
  }

  // Reject a refresh token presented where an access token is expected. The
  // prototype signed both with one secret and never checked the type.
  if (payload.typ !== 'access') throw HttpError.unauthenticated('Invalid token type.');

  const user = await db
    .prepare('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL')
    .bind(payload.sub)
    .first<UserRow>();

  if (!user) throw HttpError.unauthenticated('Account no longer exists.');
  if (user.status !== 'active') throw HttpError.forbidden('This account is suspended.');

  return user;
}
