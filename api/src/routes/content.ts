import type { FaqItem, HealthResponse } from '../../../shared/api-contract';
import type { Env } from '../lib/env';
import type { Ctx } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { parse, supportTicketSchema } from '../lib/validate';
import { enforceRateLimit } from '../lib/rate-limit';

const STARTED_AT = Date.now();

/**
 * Liveness + dependency health.
 *
 * The database check is a real query, not a constant `ok`, so an orchestrator
 * can detect a broken D1 binding rather than a process that merely started.
 */
export async function health(c: Ctx): Promise<HandlerResult<HealthResponse>> {
  let database: 'up' | 'down' = 'down';
  try {
    const row = await c.db.prepare('SELECT 1 AS ok').first<{ ok: number }>();
    database = row?.ok === 1 ? 'up' : 'down';
  } catch {
    database = 'down';
  }

  const body: HealthResponse = {
    status: database === 'up' ? 'ok' : 'degraded',
    version: c.env.BUILD_VERSION ?? 'dev',
    uptimeMs: Date.now() - STARTED_AT,
    database,
    time: new Date().toISOString(),
  };

  // 503 while the database is unreachable so uptime monitoring reacts.
  return json(body, database === 'up' ? 200 : 503);
}

export async function listFaqs(c: Ctx): Promise<HandlerResult<{ items: FaqItem[] }>> {
  const category = c.url.searchParams.get('category');
  const cached = await c.env.CACHE.get<FaqItem[]>(`faqs:${category ?? 'all'}`, 'json');
  if (cached) return json({ items: cached }, 200, { 'x-cache': 'HIT' });

  const statement = category
    ? c.db
        .prepare('SELECT question, answer, category FROM faqs WHERE published = 1 AND category = ? ORDER BY position')
        .bind(category)
    : c.db.prepare('SELECT question, answer, category FROM faqs WHERE published = 1 ORDER BY category, position');

  const { results } = await statement.all<{ question: string; answer: string; category: string }>();
  const items = (results ?? []).map((row) => ({
    question: row.question,
    answer: row.answer,
    category: row.category,
  }));

  await c.env.CACHE.put(`faqs:${category ?? 'all'}`, JSON.stringify(items), { expirationTtl: 600 });
  return json({ items }, 200, { 'x-cache': 'MISS' });
}

/**
 * Public support form.
 *
 * Rate limited per IP because it is unauthenticated and writes to the database
 * — an obvious spam target.
 */
export async function createSupportTicket(
  c: Ctx,
): Promise<HandlerResult<{ ticketId: string; status: string }>> {
  await enforceRateLimit(c.env, 'support', c.reqCtx.ip, 3, 60 * 60);

  const input = parse(supportTicketSchema, await readBody(c));

  const id = crypto.randomUUID();
  await c.db
    .prepare(
      `INSERT INTO support_tickets (id, user_id, subject, message, contact_email, category, status, ip_address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    )
    .bind(
      id,
      c.user?.id ?? null,
      input.subject,
      input.message,
      input.contactEmail,
      input.category ?? 'general',
      c.reqCtx.ip,
      new Date().toISOString(),
    )
    .run();

  return json({ ticketId: id, status: 'open' }, 201);
}

/** Route table exposed for documentation and smoke tests. */
export function apiIndex(env: Env) {
  return {
    name: 'Affiliate Hub API',
    version: env.BUILD_VERSION ?? 'dev',
    site: env.PUBLIC_SITE_URL,
    endpoints: [
      'POST   /api/v1/auth/signup',
      'POST   /api/v1/auth/login',
      'POST   /api/v1/auth/refresh',
      'POST   /api/v1/auth/logout',
      'GET    /api/v1/auth/me',
      'POST   /api/v1/auth/password',
      'POST   /api/v1/auth/onboarding',
      'GET    /api/v1/products',
      'GET    /api/v1/products/categories',
      'GET    /api/v1/products/:slug',
      'GET    /api/v1/products/:slug/assets',
      'GET    /api/v1/affiliate/links',
      'POST   /api/v1/affiliate/links',
      'GET    /api/v1/go/:code',
      'GET    /api/v1/wallet/summary',
      'GET    /api/v1/wallet/transactions',
      'GET    /api/v1/wallet/payout-options',
      'POST   /api/v1/wallet/withdraw',
      'GET    /api/v1/stats/dashboard',
      'GET    /api/v1/stats/leaderboard',
      'GET    /api/v1/profile',
      'PATCH  /api/v1/profile',
      'PUT    /api/v1/profile/bank-details',
      'GET    /api/v1/profile/goal',
      'PUT    /api/v1/profile/goal',
      'GET    /api/v1/notifications',
      'POST   /api/v1/notifications/:id/read',
      'POST   /api/v1/notifications/read-all',
      'DELETE /api/v1/notifications/:id',
      'GET    /api/v1/faqs',
      'POST   /api/v1/support/tickets',
      'GET    /api/v1/health',
    ],
  };
}

async function readBody(c: Ctx): Promise<unknown> {
  try {
    return await c.request.json();
  } catch {
    throw HttpError.validation('Expected a JSON request body.');
  }
}
