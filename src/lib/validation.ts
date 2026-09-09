/**
 * Client-side validation rules.
 *
 * These mirror the server's rules in `api/src/lib/validate.ts` so the user
 * gets the same feedback in the browser as the API would give. They are a
 * convenience, not a control — the server validates everything again.
 *
 * If a rule changes, change both. The password minimum is the one most likely
 * to drift, so it is named identically on both sides.
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

/**
 * Returns a human-readable problem with a password, or null when it is fine.
 *
 * An empty string returns null: "you did not type anything" is a required-field
 * concern that react-hook-form already reports, and returning a length message
 * there would produce two competing errors on one input.
 */
export function passwordIssue(password: string): string | null {
  if (password.length === 0) return null;
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters`;
  if (password.length > PASSWORD_MAX) return 'That password is too long';
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return 'Include at least one letter and one number';
  }
  return null;
}

/** Nigerian NUBAN account numbers are exactly 10 digits. */
export function nubanIssue(value: string): string | null {
  return /^\d{10}$/.test(value.trim()) ? null : 'Enter your 10-digit NUBAN account number';
}

/** TRC-20 addresses are 34 base58 characters starting with 'T'. */
export function trc20Issue(value: string): string | null {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value.trim())
    ? null
    : 'Enter a valid TRC-20 address starting with T';
}

export function emailIssue(value: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : 'Enter a valid email address';
}

/** E.164, as required by WhatsApp deep links. */
export function whatsappIssue(value: string): string | null {
  if (!value.trim()) return null; // optional
  return /^\+[1-9]\d{7,14}$/.test(value.trim())
    ? null
    : 'Enter a full international number, e.g. +2348012345678';
}

/**
 * Build a WhatsApp deep link.
 *
 * The number must be digits only with no '+', spaces or dashes, or wa.me
 * silently opens a "phone number is invalid" screen.
 */
export function whatsappLink(number: string, text?: string): string {
  const digits = number.replace(/[^\d]/g, '');
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * A fresh idempotency key for a withdrawal.
 *
 * Stored per attempt so a retry of the *same* intent reuses the key (and the
 * server deduplicates it), while a genuinely new withdrawal gets a new one.
 */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
