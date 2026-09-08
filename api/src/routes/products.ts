import type { Page, Product, ProductListQuery, PromoAsset } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { buildPage, money, productOrderBy, toProduct, type ProductRow } from '../lib/repo';
import { parse, productListSchema, slugParamSchema } from '../lib/validate';
import { batchAs, firstRow } from '../lib/db';

const DEFAULT_PAGE_SIZE = 20;

/**
 * Public catalogue listing.
 *
 * Cached in KV because it is the highest-traffic read in the app and is
 * identical for every visitor. The cache key includes every input that
 * influences the result, so a filter change can never serve a stale page.
 * Writes bust the prefix via `invalidateCatalogueCache`.
 */
export async function listProducts(c: Ctx): Promise<HandlerResult<Page<Product>>> {
  const query = parse(productListSchema, Object.fromEntries(c.url.searchParams)) as ProductListQuery;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  const sort = query.sort ?? 'newest';
  const category = query.category ?? 'all';

  const version = await catalogueVersion(c.env);
  const cacheKey = cacheKeyFor(version, category, sort, query.q ?? '', query.minCommissionBps ?? 0, page, pageSize);
  const ttl = Number.parseInt(c.env.CATALOGUE_CACHE_TTL_SECONDS ?? '120', 10) || 120;

  const cached = await c.env.CACHE.get<Page<Product>>(cacheKey, 'json');
  if (cached) return json(cached, 200, { 'x-cache': 'HIT' });

  const where: string[] = ["status = 'active'"];
  const bindings: (string | number)[] = [];

  if (category !== 'all') {
    where.push('category = ?');
    bindings.push(category);
  }
  if (query.minCommissionBps && query.minCommissionBps > 0) {
    where.push('commission_bps >= ?');
    bindings.push(query.minCommissionBps);
  }
  if (query.q) {
    // Parameter-bound LIKE: no string interpolation of user input.
    where.push('(title LIKE ? OR summary LIKE ? OR merchant LIKE ?)');
    const like = `%${escapeLike(query.q)}%`;
    bindings.push(like, like, like);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  const orderSql = productOrderBy(sort);

  const [listRes, countRes] = await batchAs<
    [D1Result<ProductRow>, D1Result<{ total: number }>]
  >(c.db, [
    c.db
      .prepare(`SELECT * FROM products ${whereSql} ORDER BY ${orderSql} LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize),
    c.db.prepare(`SELECT COUNT(*) AS total FROM products ${whereSql}`).bind(...bindings),
  ]);

  const rows = listRes.results ?? [];
  const countRow = firstRow(countRes);

  const result = buildPage(
    rows.map(toProduct),
    page,
    pageSize,
    countRow?.total ?? 0,
  );

  await c.env.CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: ttl });
  return json(result, 200, { 'x-cache': 'MISS' });
}

export async function getProduct(c: Ctx, slugParam: string): Promise<HandlerResult<Product>> {
  const slug = parse(slugParamSchema, slugParam);
  const version = await catalogueVersion(c.env);
  const detailKey = `product:${version}:${slug}`;

  const cached = await c.env.CACHE.get<Product>(detailKey, 'json');
  if (cached) return json(cached, 200, { 'x-cache': 'HIT' });

  const row = await c.db
    .prepare("SELECT * FROM products WHERE slug = ? AND status = 'active'")
    .bind(slug)
    .first<ProductRow>();

  if (!row) throw HttpError.notFound('We could not find that product.');

  const product = toProduct(row);
  await c.env.CACHE.put(detailKey, JSON.stringify(product), { expirationTtl: 120 });
  return json(product, 200, { 'x-cache': 'MISS' });
}

export async function listCategories(
  c: Ctx,
): Promise<HandlerResult<Array<{ category: string; count: number }>>> {
  const version = await catalogueVersion(c.env);
  const categoriesKey = `categories:${version}`;
  const cached = await c.env.CACHE.get<Array<{ category: string; count: number }>>(categoriesKey, 'json');
  if (cached) return json(cached, 200, { 'x-cache': 'HIT' });

  const { results } = await c.db
    .prepare(
      `SELECT category, COUNT(*) AS count FROM products
       WHERE status = 'active' GROUP BY category ORDER BY count DESC`,
    )
    .all<{ category: string; count: number }>();

  const list = results ?? [];
  await c.env.CACHE.put(categoriesKey, JSON.stringify(list), { expirationTtl: 300 });
  return json(list, 200, { 'x-cache': 'MISS' });
}

/**
 * Promo assets for a product, including a ready-to-paste caption.
 *
 * Images live in R2 (served through the public site or a signed path) — D1
 * stores only metadata. The prototype returned `product.image_url` twice and
 * labelled them "banner" and "square".
 */
export async function productPromoAssets(
  c: Ctx,
  slug: string,
): Promise<HandlerResult<{ productSlug: string; assets: PromoAsset[] }>> {
  const row = await c.db
    .prepare("SELECT id, slug, title, summary, price_minor, currency, commission_bps, image_url, gallery FROM products WHERE slug = ? AND status = 'active'")
    .bind(slug)
    .first<{
      id: string;
      slug: string;
      title: string;
      summary: string;
      price_minor: number;
      currency: string;
      commission_bps: number;
      image_url: string | null;
      gallery: string;
    }>();

  if (!row) throw HttpError.notFound('We could not find that product.');

  let gallery: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.gallery || '[]');
    if (Array.isArray(parsed)) gallery = parsed.filter((v): v is string => typeof v === 'string');
  } catch {
    gallery = [];
  }

  const images = [row.image_url, ...gallery].filter((v): v is string => Boolean(v));
  const commissionPct = (row.commission_bps / 100).toFixed(row.commission_bps % 100 === 0 ? 0 : 1);
  const price = money(row.price_minor, row.currency as 'NGN' | 'USD');

  const assets: PromoAsset[] = [
    ...images.slice(0, 4).map((url, index) => ({
      id: `${row.id}-img-${index}`,
      kind: index === 0 ? ('square' as const) : ('story' as const),
      label: index === 0 ? 'Square post (1080×1080)' : `Story / status image ${index}`,
      url,
      text: null,
      width: index === 0 ? 1080 : 1080,
      height: index === 0 ? 1080 : 1920,
    })),
    {
      id: `${row.id}-copy-whatsapp`,
      kind: 'copy',
      label: 'WhatsApp caption',
      url: null,
      text: `🔥 ${row.title}\n${row.summary}\n\nGrab it here 👉 {link}\n\nI earn ${commissionPct}% when you buy through my link — same price for you.`,
      width: null,
      height: null,
    },
    {
      id: `${row.id}-copy-short`,
      kind: 'copy',
      label: 'Short link text',
      url: null,
      text: `${row.title} — ${price.currency} ${(price.amountMinor / 100).toLocaleString('en-NG')}. Details: {link}`,
      width: null,
      height: null,
    },
  ];

  return json({ productSlug: row.slug, assets });
}

/**
 * Bust catalogue caches after an admin write.
 *
 * KV has no prefix delete, so the list cache is namespaced by a version
 * counter that is bumped on write. Readers include the version in the key.
 */
export async function invalidateCatalogueCache(env: { CACHE: KVNamespace }): Promise<void> {
  const current = Number.parseInt((await env.CACHE.get('catalogue:version')) ?? '1', 10) || 1;
  await env.CACHE.put('catalogue:version', String(current + 1));
}

async function catalogueVersion(env: { CACHE: KVNamespace }): Promise<number> {
  const raw = await env.CACHE.get('catalogue:version');
  return Number.parseInt(raw ?? '1', 10) || 1;
}

function cacheKeyFor(
  version: number,
  category: string,
  sort: string,
  q: string,
  minBps: number,
  page: number,
  pageSize: number,
): string {
  return `products:${version}:${category}:${sort}:${minBps}:${encodeURIComponent(q)}:${page}:${pageSize}`;
}

/** Escape LIKE wildcards so "%" or "_" in a search cannot widen the match. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export { catalogueVersion };
