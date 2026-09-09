import type { AffiliateLink, Currency, Money } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { requireAuth } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import {
  buildPage,
  money,
  toAffiliateLink,
  type LinkRow,
  type LinkStats,
} from '../lib/repo';
import { parse, generateLinkSchema, idParamSchema } from '../lib/validate';
import { randomCode, visitorFingerprint } from '../lib/crypto';
import { batchAs, firstRow } from '../lib/db';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Public base for affiliate URLs.
 *
 * Built from `PUBLIC_SITE_URL`, a configured secret-free setting. The prototype
 * used `req.headers.origin`, which the client controls — an attacker could
 * generate links pointing at their own domain and harvest the commissions.
 */
function publicSiteUrl(env: { PUBLIC_SITE_URL: string }): string {
  return env.PUBLIC_SITE_URL.replace(/\/+$/, '');
}

export function affiliateUrl(env: { PUBLIC_SITE_URL: string }, code: string): string {
  return `${publicSiteUrl(env)}/r/${code}`;
}

export async function listLinks(c: Ctx): Promise<HandlerResult<ReturnType<typeof buildPage<AffiliateLink>>>> {
  const user = await requireAuth(c);
  const page = Math.max(1, Number.parseInt(c.url.searchParams.get('page') ?? '1', 10) || 1);
  const pageSize = Math.min(
    50,
    Math.max(1, Number.parseInt(c.url.searchParams.get('pageSize') ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE),
  );

  const [listRes, countRes] = await batchAs<
    [D1Result<LinkRow>, D1Result<{ total: number }>]
  >(c.db, [
    c.db
      .prepare(
        `SELECT al.id, al.user_id, al.product_id, al.code, al.created_at,
                p.title AS product_title, p.slug AS product_slug
           FROM affiliate_links al
           JOIN products p ON p.id = al.product_id
          WHERE al.user_id = ?
          ORDER BY al.created_at DESC
          LIMIT ? OFFSET ?`,
      )
      .bind(user.id, pageSize, (page - 1) * pageSize),
    c.db.prepare('SELECT COUNT(*) AS total FROM affiliate_links WHERE user_id = ?').bind(user.id),
  ]);

  const rows = listRes.results ?? [];
  const countRow = firstRow(countRes);

  const statsByLink = await loadLinkStats(c.db, rows.map((r) => r.id));

  const items = rows.map((row) =>
    toAffiliateLink(row, affiliateUrl(c.env, row.code), statsByLink.get(row.id) ?? emptyStats()),
  );

  return json(buildPage(items, page, pageSize, countRow?.total ?? 0));
}

/**
 * Generate (or return the existing) tracked link for a product.
 *
 * Idempotent by construction: the unique index on (user_id, product_id) means
 * asking twice yields the same link instead of accumulating link spam.
 */
export async function generateLink(c: Ctx): Promise<HandlerResult<{ link: AffiliateLink }>> {
  const user = await requireAuth(c);
  const input = parse(generateLinkSchema, await readBody(c));

  const product = await c.db
    .prepare("SELECT id, slug, title, currency FROM products WHERE id = ? AND status = 'active'")
    .bind(input.productId)
    .first<{ id: string; slug: string; title: string; currency: string }>();

  // Validating existence closes an integrity hole: the prototype inserted the
  // link without checking the product, so foreign keys could point at nothing.
  if (!product) throw HttpError.notFound('We could not find that product.');

  const existing = await c.db
    .prepare(
      `SELECT id, code, created_at FROM affiliate_links WHERE user_id = ? AND product_id = ?`,
    )
    .bind(user.id, product.id)
    .first<{ id: string; code: string; created_at: string }>();

  if (existing) {
    const stats = (await loadLinkStats(c.db, [existing.id])).get(existing.id) ?? emptyStats();
    return json({
      link: toAffiliateLink(
        {
          id: existing.id,
          user_id: user.id,
          product_id: product.id,
          code: existing.code,
          created_at: existing.created_at,
          product_title: product.title,
          product_slug: product.slug,
        },
        affiliateUrl(c.env, existing.code),
        stats,
      ),
    });
  }

  const code = await allocateLinkCode(c.db);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.db
    .prepare(
      `INSERT INTO affiliate_links (id, user_id, product_id, code, created_at) VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(id, user.id, product.id, code, now)
    .run();

  await c.db
    .prepare('UPDATE products SET total_promotions = total_promotions + 1 WHERE id = ?')
    .bind(product.id)
    .run();

  return json(
    {
      link: toAffiliateLink(
        {
          id,
          user_id: user.id,
          product_id: product.id,
          code,
          created_at: now,
          product_title: product.title,
          product_slug: product.slug,
        },
        affiliateUrl(c.env, code),
        emptyStats(),
      ),
    },
    201,
  );
}

/**
 * Public click redirect: `GET /go/:code`.
 *
 * This is the endpoint an affiliate actually shares. It records a click and
 * 302s to the product page carrying the referral code. The prototype had a
 * `stats` table that nothing ever wrote to, so every dashboard number was
 * invented in the React component.
 *
 * Fraud controls: the visitor IP is salted-hashed (never stored raw) and a
 * unique index on (link_id, visitor_hash, created_at-bucket) deduplicates
 * repeated hits inside the window.
 */
export async function recordClick(c: Ctx, code: string): Promise<Response> {
  const linkCode = parse(idParamSchema, code);

  const link = await c.db
    .prepare(
      `SELECT al.id, al.product_id, p.slug FROM affiliate_links al
         JOIN products p ON p.id = al.product_id
        WHERE al.code = ?`,
    )
    .bind(linkCode)
    .first<{ id: string; product_id: string; slug: string }>();

  if (!link) {
    return new Response('That link is no longer active.', { status: 404 });
  }

  const fingerprint = await visitorFingerprint(c.reqCtx.ip, c.env.VISITOR_HASH_SALT);
  // Bucketed to the hour so the unique index dedupes within a window without
  // blocking a genuine returning visitor days later.
  const bucket = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();

  try {
    await c.db
      .prepare(
        `INSERT INTO clicks (id, link_id, visitor_hash, user_agent, country, referrer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        link.id,
        fingerprint,
        c.reqCtx.userAgent.slice(0, 300),
        c.reqCtx.country,
        c.request.headers.get('referer')?.slice(0, 300) ?? null,
        bucket,
      )
      .run();
  } catch (error) {
    // A duplicate within the bucket is the dedupe working, not a failure.
    if (!/UNIQUE constraint failed/i.test(error instanceof Error ? error.message : String(error))) {
      console.error('click_insert_failed', { linkId: link.id, error: (error as Error).message });
    }
  }

  const target = new URL(`${publicSiteUrl(c.env)}/products/${link.slug}`);
  target.searchParams.set('ref', linkCode);

  return new Response(null, {
    status: 302,
    headers: {
      location: target.toString(),
      // Affiliate clicks must not be cached per-visitor, or the first visitor
      // would consume everyone else's redirect.
      'cache-control': 'no-store',
    },
  });
}

/* -------------------------------- helpers -------------------------------- */

function emptyStats(): LinkStats {
  return { clicks: 0, conversions: 0, earningsMinor: 0, currency: 'NGN' };
}

async function loadLinkStats(db: D1Database, linkIds: string[]): Promise<Map<string, LinkStats>> {
  const map = new Map<string, LinkStats>();
  if (linkIds.length === 0) return map;

  const placeholders = linkIds.map(() => '?').join(',');

  const [clickRes, convRes] = await batchAs<
    [
      D1Result<{ link_id: string; clicks: number }>,
      D1Result<{ link_id: string; conversions: number; earnings: number; currency: string }>,
    ]
  >(db, [
    db
      .prepare(
        `SELECT link_id, COUNT(*) AS clicks FROM clicks
          WHERE link_id IN (${placeholders}) GROUP BY link_id`,
      )
      .bind(...linkIds),
    db
      .prepare(
        `SELECT link_id,
                COUNT(*) AS conversions,
                COALESCE(SUM(CASE WHEN status = 'approved' THEN commission_minor ELSE 0 END), 0) AS earnings,
                MAX(currency) AS currency
           FROM conversions
          WHERE link_id IN (${placeholders}) GROUP BY link_id`,
      )
      .bind(...linkIds),
  ]);

  const clickRows = clickRes.results ?? [];
  const convRows = convRes.results ?? [];

  for (const row of clickRows ?? []) {
    map.set(row.link_id, { clicks: row.clicks, conversions: 0, earningsMinor: 0, currency: 'NGN' });
  }
  for (const row of convRows ?? []) {
    const existing = map.get(row.link_id);
    map.set(row.link_id, {
      clicks: existing?.clicks ?? 0,
      conversions: row.conversions,
      earningsMinor: row.earnings,
      currency: (row.currency as Currency) ?? 'NGN',
    });
  }
  return map;
}

async function allocateLinkCode(db: D1Database): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = randomCode(10);
    const clash = await db.prepare('SELECT 1 FROM affiliate_links WHERE code = ?').bind(candidate).first();
    if (!clash) return candidate;
  }
  throw HttpError.internal('Could not allocate a unique link code. Please try again.');
}

async function readBody(c: Ctx): Promise<unknown> {
  try {
    return await c.request.json();
  } catch {
    throw HttpError.validation('Expected a JSON request body.');
  }
}

export type { Money };
