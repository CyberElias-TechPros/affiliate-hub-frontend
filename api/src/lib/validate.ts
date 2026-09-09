import { z } from 'zod';
import {
  PAYOUT_METHODS,
  PRODUCT_FILTER_CATEGORIES,
  STATS_RANGES,
  TRANSACTION_STATUSES,
} from '../../../shared/api-contract';
import { HttpError } from './errors';

/**
 * Every value crossing the trust boundary is validated here. The Express
 * prototype destructured `req.body` straight into SQL parameters with no
 * shape, type, or range checks — including the withdrawal amount.
 */

const EMAIL_MAX = 254;
export const PASSWORD_MIN = 10;
const PASSWORD_MAX = 200;

const trimmed = (max: number) => z.string().trim().min(1, 'Required').max(max);

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(EMAIL_MAX),
  password: z.string().min(1, 'Enter your password').max(PASSWORD_MAX),
});

export const signupSchema = z.object({
  name: trimmed(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(EMAIL_MAX),
  // zxcvbn-style minimums: length is the strongest cheap signal, and requiring
  // a mix of character classes mostly annoys users without adding much entropy.
  password: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX, 'Password is too long')
    .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
  country: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, 'Country must be a 2-letter code')
    .optional(),
  referralCode: z.string().trim().regex(/^[A-Za-z0-9_-]{4,24}$/).optional(),
});

export const onboardingSchema = z.object({
  country: z.string().trim().regex(/^[A-Z]{2}$/, 'Country must be a2-letter code'),
  niches: z
    .array(z.string().trim().regex(/^[a-z0-9-]{2,32}$/))
    .min(1, 'Pick at least one niche')
    .max(6, 'Pick at most six niches'),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Enter a full international number, e.g. +2348012345678')
    .nullish(),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password').max(PASSWORD_MAX),
  newPassword: z
    .string()
    .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters`)
    .max(PASSWORD_MAX)
    .refine((p) => /[a-zA-Z]/.test(p) && /\d/.test(p), 'Include at least one letter and one number'),
});

export const bankDetailsSchema = z.object({
  bankName: trimmed(80),
  accountName: trimmed(80),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, 'Enter a valid account number'),
});

export const productListSchema = z.object({
  category: z.enum(PRODUCT_FILTER_CATEGORIES).optional(),
  sort: z.enum(['newest', 'price-asc', 'price-desc', 'commission-desc']).optional(),
  q: z.string().trim().max(120).optional(),
  minCommissionBps: z.coerce.number().int().min(0).max(10000).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  // Capped hard: an uncapped pageSize is a cheap denial-of-service on D1.
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const productSortSchema = z.enum(['newest', 'price-asc', 'price-desc', 'commission-desc']);

export const statsQuerySchema = z.object({
  range: z.enum(STATS_RANGES).optional(),
});

export const transactionQuerySchema = z.object({
  status: z.enum(TRANSACTION_STATUSES).optional(),
  type: z.enum(['commission', 'withdrawal', 'adjustment', 'refund']).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

export const withdrawSchema = z.object({
  amountMinor: z
    .number({ invalid_type_error: 'Enter a valid amount' })
    .int('Amounts must be whole kobo')
    // Positive-only. The prototype accepted negative amounts, and because the
    // balance was `SUM(-amount)` for debits, a negative withdrawal *credited*
    // the wallet. This is the single most important validation in the app.
    .positive('Enter an amount greater than zero')
    .max(100_000_000_000, 'Amount is too large'),
  currency: z.enum(['NGN', 'USD']),
  method: z.enum(PAYOUT_METHODS),
  destination: z
    .string()
    .trim()
    .min(3, 'Enter your payout destination')
    .max(120, 'Destination is too long'),
  idempotencyKey: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_-]{16,64}$/, 'Idempotency key must be 16-64 URL-safe characters'),
});

export const generateLinkSchema = z.object({
  productId: trimmed(64),
});

export const supportTicketSchema = z.object({
  subject: trimmed(120),
  message: z.string().trim().min(10, 'Tell us a little more').max(4000),
  contactEmail: z.string().trim().toLowerCase().email('Enter a valid email address').max(EMAIL_MAX),
  category: z.string().trim().regex(/^[a-z0-9-]{2,32}$/).optional(),
});

export const profileUpdateSchema = z.object({
  name: trimmed(80).optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, 'Enter a full international number, e.g. +2348012345678')
    .nullish(),
  country: z.string().trim().regex(/^[A-Z]{2}$/).optional(),
  niches: z.array(z.string().trim().regex(/^[a-z0-9-]{2,32}$/)).max(6).optional(),
});

export const goalSchema = z.object({
  targetMinor: z.number().int().positive().max(100_000_000_000),
  currency: z.enum(['NGN', 'USD']),
  period: z.enum(['weekly', 'monthly', 'yearly']).optional(),
});

export const idParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Invalid identifier');
export const slugParamSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{1,120}$/, 'Invalid slug');
export const referralParamSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{4,24}$/, 'Invalid referral code');

/**
 * Query strings arrive as text. `z.coerce.boolean()` would map the string
 * "false" to `true`, so parse the flag explicitly.
 */
const booleanFlag = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true' || value === '1';
}, z.boolean().optional());

export const notificationQuerySchema = z.object({
  unreadOnly: booleanFlag,
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

/**
 * Parse with `schema`, converting Zod's error tree into the API's
 * field-keyed validation error so the UI can highlight the offending input.
 */
export function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw HttpError.validation('Some details need correcting.', fields);
}
