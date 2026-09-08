import type {
  AffiliateLink,
  Currency,
  Money,
  Notification,
  Page,
  Product,
  ProductCategory,
  ProductSort,
  Transaction,
  TransactionStatus,
  TransactionType,
  AffiliateTier,
} from '../../../shared/api-contract';
import { commissionFromBps } from '../../../shared/api-contract';

/* --------------------------------- rows ---------------------------------- */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  whatsapp: string | null;
  country: string;
  referral_code: string;
  tier: string;
  onboarding_completed: number;
  niches: string;
  avatar_key: string | null;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ProductRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  description: string;
  category: string;
  status: string;
  price_minor: number;
  currency: string;
  commission_bps: number;
  image_url: string | null;
  gallery: string;
  merchant: string;
  cookie_days: number;
  why_promote: string;
  total_promotions: number;
  has_promo_assets: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  amount_minor: number;
  fee_minor: number;
  currency: string;
  description: string;
  payout_method: string | null;
  payout_reference: string | null;
  idempotency_key: string | null;
  product_id: string | null;
  conversion_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkRow {
  id: string;
  user_id: string;
  product_id: string;
  code: string;
  created_at: string;
  product_title?: string;
  product_slug?: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  href: string | null;
  read_at: string | null;
  created_at: string;
}

/* -------------------------------- helpers -------------------------------- */

export function money(amountMinor: number, currency: Currency): Money {
  return { amountMinor, currency };
}

function parseJsonArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function toPublicUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    country: row.country,
    referralCode: row.referral_code,
    tier: row.tier as AffiliateTier,
    onboardingCompleted: row.onboarding_completed === 1,
    niches: parseJsonArray(row.niches),
    createdAt: row.created_at,
  };
}

export function toProduct(row: ProductRow): Product {
  const currency = row.currency as Currency;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    description: row.description,
    category: row.category as ProductCategory,
    status: row.status as Product['status'],
    price: money(row.price_minor, currency),
    commissionBps: row.commission_bps,
    commissionAmount: money(commissionFromBps(row.price_minor, row.commission_bps), currency),
    currency,
    imageUrl: row.image_url,
    gallery: parseJsonArray(row.gallery),
    merchant: row.merchant,
    cookieDays: row.cookie_days,
    whyPromote: parseJsonArray(row.why_promote),
    hasPromoAssets: row.has_promo_assets === 1,
    totalPromotions: row.total_promotions,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toTransaction(row: TransactionRow, productTitle: string | null = null): Transaction {
  return {
    id: row.id,
    type: row.type as TransactionType,
    status: row.status as TransactionStatus,
    amount: money(row.amount_minor, row.currency as Currency),
    description: row.description,
    payoutMethod: (row.payout_method as Transaction['payoutMethod']) ?? null,
    idempotencyKey: row.idempotency_key,
    productId: row.product_id,
    productTitle,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toAffiliateLink(row: LinkRow, url: string, stats: LinkStats): AffiliateLink {
  return {
    id: row.id,
    productId: row.product_id,
    productTitle: row.product_title ?? '',
    productSlug: row.product_slug ?? '',
    code: row.code,
    url,
    clicks: stats.clicks,
    conversions: stats.conversions,
    earnings: money(stats.earningsMinor, stats.currency),
    createdAt: row.created_at,
  };
}

export interface LinkStats {
  clicks: number;
  conversions: number;
  earningsMinor: number;
  currency: Currency;
}

export function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    read: row.read_at !== null,
    href: row.href,
    createdAt: row.created_at,
  };
}

export function buildPage<T>(items: T[], page: number, pageSize: number, totalItems: number): Page<T> {
  return {
    items,
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };
}

/** Maps the API's sort vocabulary onto SQL. Never interpolates client input. */
export function productOrderBy(sort: ProductSort | undefined): string {
  switch (sort) {
    case 'price-asc':
      return 'price_minor ASC, created_at DESC';
    case 'price-desc':
      return 'price_minor DESC, created_at DESC';
    case 'commission-desc':
      return 'commission_bps DESC, price_minor DESC';
    case 'newest':
    default:
      return 'COALESCE(published_at, created_at) DESC, created_at DESC';
  }
}

/**
 * Available balance, in integer minor units.
 *
 * Only `completed` rows count as spendable. The prototype summed every row
 * regardless of status, so a `pending` withdrawal reduced the balance before
 * it had actually settled and a `failed` one never came back.
 */
export function availableBalanceQuery(userId: string) {
  return {
    sql: `SELECT COALESCE(SUM(amount_minor), 0) AS available
          FROM transactions
          WHERE user_id = ? AND status = 'completed'`,
    bindings: [userId],
  };
}

export function pendingBalanceQuery(userId: string) {
  return {
    sql: `SELECT COALESCE(SUM(amount_minor), 0) AS pending
          FROM transactions
          WHERE user_id = ? AND status = 'pending' AND type IN ('commission','adjustment')`,
    bindings: [userId],
  };
}

export function lifetimeEarningsQuery(userId: string) {
  return {
    sql: `SELECT COALESCE(SUM(amount_minor), 0) AS lifetime
          FROM transactions
          WHERE user_id = ? AND status = 'completed' AND amount_minor > 0`,
    bindings: [userId],
  };
}
