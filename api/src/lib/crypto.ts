/**
 * Cryptographic primitives built on the WebCrypto API, which is the only
 * crypto surface available in Cloudflare Workers.
 *
 * Notable choices:
 *  - Passwords use PBKDF2-HMAC-SHA256 at 210,000 iterations. `bcrypt` (used by
 *    the original Express prototype) has no Workers-compatible implementation
 *    and relies on native bindings.
 *  - Access/refresh tokens are HS256 JWTs signed with separate secrets, so
 *    leaking the access secret does not let an attacker mint refresh tokens.
 *  - Only SHA-256 hashes of refresh tokens are persisted.
 *  - Visitor IPs are salted-hashed rather than stored, so click fraud can be
 *    deduplicated without retaining personal data.
 */

const PBKDF2_ITERATIONS = 210_000;
const PBKDF2_KEY_LENGTH_BITS = 256;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/* ------------------------------- base64url ------------------------------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function base64UrlEncodeString(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlDecodeString(value: string): string {
  return decoder.decode(base64UrlToBytes(value));
}

/* ------------------------------ randomness ------------------------------- */

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function uuid(): string {
  return crypto.randomUUID();
}

/** URL-safe, unguessable short code — used for affiliate link codes. */
export function randomCode(length = 12): string {
  return bytesToBase64Url(randomBytes(length)).slice(0, length);
}

/* ------------------------------- passwords ------------------------------- */

export interface PasswordHash {
  formatted: string;
  iterations: number;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  const salt = randomBytes(16);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    PBKDF2_KEY_LENGTH_BITS,
  );
  return {
    formatted: `pbkdf2$sha256$${PBKDF2_ITERATIONS}$${bytesToBase64Url(salt)}$${bytesToBase64Url(
      new Uint8Array(bits),
    )}`,
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Constant-time password verification. Always performs a derivation even when
 * the stored hash is malformed, so response timing does not reveal whether an
 * account exists.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 5 || parts[0] !== 'pbkdf2' || parts[1] !== 'sha256') {
    await hashPassword(password);
    return false;
  }
  const iterations = Number.parseInt(parts[2], 10);
  if (!Number.isFinite(iterations) || iterations < 1000) {
    await hashPassword(password);
    return false;
  }
  const salt = base64UrlToBytes(parts[3]);
  const expected = base64UrlToBytes(parts[4]);

  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    expected.byteLength * 8,
  );
  return constantTimeEqual(new Uint8Array(bits), expected);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/* --------------------------------- hashing -------------------------------- */

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Salted, non-reversible fingerprint of a visitor IP for fraud deduplication.
 * SHA-256 with a server-side secret salt so the stored value cannot be reversed
 * or rainbow-tabled back to an IP address.
 */
export async function visitorFingerprint(ip: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${ip}`);
}

/* ---------------------------------- HS256 --------------------------------- */

/**
 * Build the HMAC key for HS256 signing.
 *
 * An unset secret reaches here as an empty string, and WebCrypto rejects it with
 * "Imported HMAC key length (0) must be a non-zero value…", which surfaces as a
 * 500 on login with no hint about what is actually wrong. Failing here instead
 * names the missing variable and the command that fixes it.
 *
 * Deliberately not a silent fallback to a development default: a worker that
 * signs tokens with a predictable key is a total authentication bypass.
 */
async function hmacKey(secret: string): Promise<CryptoKey> {
  if (!secret) {
    throw new Error(
      'A token signing secret is not configured. Set ACCESS_TOKEN_SECRET and ' +
        'REFRESH_TOKEN_SECRET (they must differ) with `npx wrangler secret put <NAME>`, ' +
        'or add them to api/.dev.vars for local development.',
    );
  }
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export interface TokenPayload {
  /** Subject — the user id. */
  sub: string;
  /** Token type: 'access' | 'refresh'. */
  typ: 'access' | 'refresh';
  /** Issued at, unix seconds. */
  iat: number;
  /** Expires at, unix seconds. */
  exp: number;
  /** Refresh token id, present on refresh tokens for revocation. */
  jti?: string;
}

export async function signToken(payload: TokenPayload, secret: string): Promise<string> {
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64UrlEncodeString(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const key = await hmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export class TokenError extends Error {}

export async function verifyToken<T extends TokenPayload>(token: string, secret: string): Promise<T> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('malformed token');

  let header: { alg?: string };
  try {
    header = JSON.parse(base64UrlDecodeString(parts[0]));
  } catch {
    throw new TokenError('malformed header');
  }
  // Pin the algorithm: accepting attacker-chosen alg is the classic JWT bypass.
  if (header.alg !== 'HS256') throw new TokenError('unsupported algorithm');

  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(parts[2]) as unknown as BufferSource,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) throw new TokenError('invalid signature');

  let payload: T;
  try {
    payload = JSON.parse(base64UrlDecodeString(parts[1])) as T;
  } catch {
    throw new TokenError('malformed payload');
  }
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) {
    throw new TokenError('token expired');
  }
  return payload;
}

/* --------------------------- field-level encryption ------------------------ */

/**
 * AES-GCM encryption for the bank account number at rest. D1 offers no
 * column-level encryption, so sensitive PII is opaque ciphertext in the table.
 */
export async function encryptField(plaintext: string, keyBase64: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', base64UrlToBytes(keyBase64), 'AES-GCM', false, [
    'encrypt',
  ]);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    encoder.encode(plaintext),
  );
  return `v1:${bytesToBase64Url(iv)}:${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptField(packed: string, keyBase64: string): Promise<string> {
  const [version, ivPart, dataPart] = packed.split(':');
  if (version !== 'v1' || !ivPart || !dataPart) throw new Error('unsupported ciphertext');
  const key = await crypto.subtle.importKey('raw', base64UrlToBytes(keyBase64), 'AES-GCM', false, [
    'decrypt',
  ]);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(ivPart) as unknown as BufferSource },
    key,
    base64UrlToBytes(dataPart) as unknown as BufferSource,
  );
  return decoder.decode(plaintext);
}
