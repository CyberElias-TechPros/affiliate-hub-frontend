/**
 * Affiliate Hub — shared API contract.
 *
 * This file is the single source of truth for the wire format between the
 * Vercel-hosted frontend and the Cloudflare Worker API. Both sides import it
 * (frontend via the `@shared` alias, worker via a relative import) so the two
 * cannot drift apart.
 *
 * Conventions enforced here:
 *  - Money is ALWAYS an integer count of minor units (kobo / cents). Floating
 *    point money caused rounding drift in the original Express prototype.
 *  - Every envelope is `{ ok: true, data }` or `{ ok: false, error }`.
 *  - List endpoints always return a `Page<T>` envelope, never a bare array.
 */

export const API_VERSION = 1;

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

export const ERROR_CODES = {
  VALIDATION: 'validation_error',
  UNAUTHENTICATED: 'unauthenticated',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  CONFLICT: 'conflict',
  RATE_LIMITED: 'rate_limited',
  PAYLOAD_TOO_LARGE: 'payload_too_large',
  INSUFFICIENT_FUNDS: 'insufficient_funds',
  WITHDRAWAL_BELOW_MINIMUM: 'withdrawal_below_minimum',
  INTERNAL: 'internal_error',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiError {
  code: ErrorCode;
  message: string;
  /** Field-level detail for validation errors. */
  fields?: Record<string, string>;
  /** Opaque correlation id — safe to show to users and to log. */
  requestId: string;
}

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: ApiError };

/* -------------------------------------------------------------------------- */
/* Pagination                                                                  */
/* -------------------------------------------------------------------------- */

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

/* -------------------------------------------------------------------------- */
/* Domain enums                                                                */
/* -------------------------------------------------------------------------- */

export const CURRENCIES = ['NGN', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export interface Money {
  /** Integer amount in the currency's minor unit (kobo for NGN, cents for USD). */
  amountMinor: number;
  currency: Currency;
}

export const PRODUCT_CATEGORIES = [
  'digital',
  'physical',
  'services',
  'finance',
  'health',
  'beauty',
  'education',
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Category filter values accepted by the list endpoint, including "all". */
export const PRODUCT_FILTER_CATEGORIES = [...PRODUCT_CATEGORIES, 'all'] as const;
export type ProductFilterCategory = (typeof PRODUCT_FILTER_CATEGORIES)[number];

export const PRODUCT_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const TRANSACTION_TYPES = ['commission', 'withdrawal', 'adjustment', 'refund'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = ['pending', 'completed', 'failed', 'cancelled'] as const;
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

export const PAYOUT_METHODS = ['bank', 'paypal', 'usdt'] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

export const AFFILIATE_TIERS = ['starter', 'pro', 'elite'] as const;
export type AffiliateTier = (typeof AFFILIATE_TIERS)[number];

/* -------------------------------------------------------------------------- */
/* Entities                                                                    */
/* -------------------------------------------------------------------------- */

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  /** E.164, e.g. "+2348012345678". Null until the affiliate connects WhatsApp. */
  whatsapp: string | null;
  /** ISO-3166-1 alpha-2. */
  country: string;
  /** Affiliate referral slug used to build tracked links. */
  referralCode: string;
  tier: AffiliateTier;
  /** True once the affiliate has completed the onboarding wizard. */
  onboardingCompleted: boolean;
  niches: string[];
  createdAt: string;
}

export interface BankDetails {
  bankName: string | null;
  accountName: string | null;
  /** Masked on the way out — the API never returns a full account number. */
  accountNumberMasked: string | null;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: ProductCategory;
  status: ProductStatus;
  /** Merchant's retail price, integer minor units. */
  price: Money;
  /** Commission rate in basis points: 4500 === 45%. Integers avoid float drift. */
  commissionBps: number;
  /** Convenience field: price * commissionBps / 10000, computed server-side. */
  commissionAmount: Money;
  currency: Currency;
  imageUrl: string | null;
  gallery: string[];
  /** Merchant / advertiser name. */
  merchant: string;
  cookieDays: number;
  /** Persuasion bullets rendered on the product detail screen. */
  whyPromote: string[];
  /** True once the product's promo asset bundle exists in R2. */
  hasPromoAssets: boolean;
  totalPromotions: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProductSort = 'newest' | 'price-asc' | 'price-desc' | 'commission-desc';

export interface ProductListQuery extends PageQuery {
  category?: ProductCategory | 'all';
  sort?: ProductSort;
  /** Free-text search over title/summary/merchant. */
  q?: string;
  /** Only products paying at least this commission rate (basis points). */
  minCommissionBps?: number;
}

export interface AffiliateLink {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  /** Short, URL-safe, unguessable code. */
  code: string;
  /** Absolute public URL an affiliate copies and shares. */
  url: string;
  clicks: number;
  conversions: number;
  earnings: Money;
  createdAt: string;
}

export interface PromoAsset {
  id: string;
  kind: 'banner' | 'square' | 'story' | 'copy';
  label: string;
  /** Present for image assets. */
  url: string | null;
  /** Present for `copy` assets — the swipe text an affiliate pastes. */
  text: string | null;
  width: number | null;
  height: number | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: Money;
  description: string;
  /** Present on withdrawals. */
  payoutMethod: PayoutMethod | null;
  /** Idempotency key echoed back so the client can detect a duplicate submit. */
  idempotencyKey: string | null;
  productId: string | null;
  productTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WithdrawRequest {
  /** Integer minor units in `currency`. */
  amountMinor: number;
  currency: Currency;
  method: PayoutMethod;
  destination: string;
  /** Client-generated UUID. Re-sending the same key returns the original result. */
  idempotencyKey: string;
}

export interface WithdrawResult {
  transactionId: string;
  status: TransactionStatus;
  amount: Money;
  fee: Money;
  /** Client-provided key, echoed for correlation. */
  idempotencyKey: string;
  /** True when this response is a replay of an earlier identical request. */
  deduplicated: boolean;
  availableAfter: Money;
}

export interface PayoutOption {
  method: PayoutMethod;
  label: string;
  description: string;
  feeBps: number;
  /** Integer minor units. */
  minimumMinor: number;
  estimatedSettlement: string;
}

export interface WalletSummary {
  available: Money;
  pending: Money;
  lifetimeEarnings: Money;
  /** Server-side FX snapshot used for the secondary currency display. */
  availableSecondary: Money;
  fxRate: FxRate;
}

export interface FxRate {
  base: Currency;
  quote: Currency;
  /** How many quote minor units one base minor unit is worth, scaled by 1e6. */
  rateScaled: number;
  asOf: string;
  source: string;
}

export interface DashboardStats {
  clicks: number;
  conversions: number;
  conversionRateBps: number;
  earnings: Money;
  activeLinks: number;
  /** Day buckets, oldest first. Always length === range in days, zero-filled. */
  series: Array<{ date: string; clicks: number; conversions: number; earningsMinor: number }>;
  topProducts: Array<{ productId: string; title: string; clicks: number; conversions: number; earnings: Money }>;
  goal: { targetMinor: number; progressMinor: number; currency: Currency } | null;
}

export const STATS_RANGES = ['7d', '30d', '90d'] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export interface LeaderboardEntry {
  /** Pseudonymised handle — never a real name or email. */
  handle: string;
  tier: AffiliateTier;
  earnings: Money;
  conversions: number;
  rank: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  /** Optional deep link inside the app. */
  href: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  country?: string;
  /** Must match `referralCode` of an existing affiliate when provided. */
  referralCode?: string;
}

export interface AuthSession extends AuthTokens {
  user: PublicUser;
}

export interface OnboardingRequest {
  country: string;
  niches: string[];
  whatsapp: string | null;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/* -------------------------------------------------------------------------- */
/* Support / content                                                           */
/* -------------------------------------------------------------------------- */

export interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

export interface SupportTicketRequest {
  subject: string;
  message: string;
  contactEmail: string;
  category: string;
}

export interface FxRatesResponse {
  rates: FxRate[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  uptimeMs: number;
  database: 'up' | 'down';
  time: string;
}

/* -------------------------------------------------------------------------- */
/* Money helpers (isomorphic — safe in both the Worker and the browser)         */
/* -------------------------------------------------------------------------- */

export const MINOR_UNITS_PER_UNIT: Record<Currency, number> = { NGN: 100, USD: 100 };

export function toMinor(amount: number, currency: Currency): number {
  const factor = MINOR_UNITS_PER_UNIT[currency];
  return Math.round(amount * factor);
}

export function toMajor(amountMinor: number, currency: Currency): number {
  return amountMinor / MINOR_UNITS_PER_UNIT[currency];
}

/** Construct a Money value. Keeps call sites from hand-writing the shape. */
export function money(amountMinor: number, currency: Currency): Money {
  return { amountMinor, currency };
}

export function commissionFromBps(priceMinor: number, commissionBps: number): number {
  return Math.round((priceMinor * commissionBps) / 10_000);
}

/** Format integer minor units for display, e.g. 47250000 kobo -> "₦472,500.00". */
export function formatMoney(money: Money, opts: { compact?: boolean } = {}): string {
  const major = toMajor(money.amountMinor, money.currency);
  return new Intl.NumberFormat(money.currency === 'NGN' ? 'en-NG' : 'en-US', {
    style: 'currency',
    currency: money.currency,
    notation: opts.compact && Math.abs(major) >= 1000 ? 'compact' : 'standard',
    minimumFractionDigits: money.currency === 'USD' ? 2 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}
