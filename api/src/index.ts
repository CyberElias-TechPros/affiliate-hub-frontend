import type { Env } from './lib/env';
import type { Ctx } from './lib/context';
import { HttpError } from './lib/errors';
import {
  fail,
  fromHttpError,
  json,
  parseAllowedOrigins,
  securityHeaders,
  type HandlerResult,
  type RequestContext,
} from './lib/respond';
import { ERROR_CODES } from '../../shared/api-contract';

import * as auth from './routes/auth';
import * as products from './routes/products';
import * as links from './routes/links';
import * as wallet from './routes/wallet';
import * as stats from './routes/stats';
import * as profile from './routes/profile';
import * as notifications from './routes/notifications';
import * as content from './routes/content';
import { reconcileWallets, expireStaleWithdrawals, pruneExpiredSessions } from './jobs';
import { handlePayoutMessage } from './queue-consumer';

const API_PREFIX = '/api/v1';

/**
 * Route table.
 *
 * Matching is explicit rather than regex-driven so the ordering hazard that
 * broke the Express prototype is impossible to reintroduce: there,
 * `/products/:id` was declared before `/products/search` and
 * `/products/categories`, so both endpoints were silently unreachable and
 * returned "Product not found". Literal segments are always tested before
 * parameterised ones here, in one visible list.
 */
interface Route {
  method: string;
  /** Literal path segments, or `:name` for a parameter. */
  pattern: string[];
  handler: (c: Ctx, params: Record<string, string>) => HandlerResult | Response | Promise<HandlerResult | Response>;
}

const routes: Route[] = [
  { method: 'GET', pattern: ['health'], handler: (c) => content.health(c) },
  { method: 'GET', pattern: [], handler: (c) => json(content.apiIndex(c.env)) },

  { method: 'POST', pattern: ['auth', 'signup'], handler: (c) => auth.signup(c) },
  { method: 'POST', pattern: ['auth', 'login'], handler: (c) => auth.login(c) },
  { method: 'POST', pattern: ['auth', 'refresh'], handler: (c) => auth.refresh(c) },
  { method: 'POST', pattern: ['auth', 'logout'], handler: (c) => auth.logout(c) },
  { method: 'GET', pattern: ['auth', 'me'], handler: (c) => auth.me(c) },
  { method: 'POST', pattern: ['auth', 'password'], handler: (c) => auth.changePassword(c) },
  { method: 'POST', pattern: ['auth', 'onboarding'], handler: (c) => auth.completeOnboarding(c) },

  { method: 'GET', pattern: ['products'], handler: (c) => products.listProducts(c) },
  // Literal before parameterised.
  { method: 'GET', pattern: ['products', 'categories'], handler: (c) => products.listCategories(c) },
  { method: 'GET', pattern: ['products', ':slug'], handler: (c, p) => products.getProduct(c, p.slug) },
  {
    method: 'GET',
    pattern: ['products', ':slug', 'assets'],
    handler: (c, p) => products.productPromoAssets(c, p.slug),
  },

  // Returns a raw 302 Response rather than the JSON envelope.
  { method: 'GET', pattern: ['go', ':code'], handler: (c, p) => links.recordClick(c, p.code) },

  { method: 'GET', pattern: ['affiliate', 'links'], handler: (c) => links.listLinks(c) },
  { method: 'POST', pattern: ['affiliate', 'links'], handler: (c) => links.generateLink(c) },

  { method: 'GET', pattern: ['wallet', 'summary'], handler: (c) => wallet.summary(c) },
  { method: 'GET', pattern: ['wallet', 'transactions'], handler: (c) => wallet.transactions(c) },
  { method: 'GET', pattern: ['wallet', 'payout-options'], handler: (c) => wallet.options(c) },
  { method: 'POST', pattern: ['wallet', 'withdraw'], handler: (c) => wallet.withdraw(c) },

  { method: 'GET', pattern: ['stats', 'dashboard'], handler: (c) => stats.dashboard(c) },
  { method: 'GET', pattern: ['stats', 'leaderboard'], handler: (c) => stats.leaderboard(c) },

  { method: 'GET', pattern: ['profile'], handler: (c) => profile.getProfile(c) },
  { method: 'PATCH', pattern: ['profile'], handler: (c) => profile.updateProfile(c) },
  { method: 'PUT', pattern: ['profile', 'bank-details'], handler: (c) => profile.updateBankDetails(c) },
  { method: 'POST', pattern: ['profile', 'bank-details', 'verify'], handler: (c) => profile.verifyBankDetails(c) },
  { method: 'GET', pattern: ['profile', 'goal'], handler: (c) => profile.getGoal(c) },
  { method: 'PUT', pattern: ['profile', 'goal'], handler: (c) => profile.setGoal(c) },

  { method: 'GET', pattern: ['notifications'], handler: (c) => notifications.listNotifications(c) },
  { method: 'POST', pattern: ['notifications', 'read-all'], handler: (c) => notifications.markAllRead(c) },
  {
    method: 'POST',
    pattern: ['notifications', ':id', 'read'],
    handler: (c) => notifications.markRead(c),
  },
  { method: 'DELETE', pattern: ['notifications', ':id'], handler: (c) => notifications.removeNotification(c) },

  { method: 'GET', pattern: ['faqs'], handler: (c) => content.listFaqs(c) },
  { method: 'POST', pattern: ['support', 'tickets'], handler: (c) => content.createSupportTicket(c) },
];

function matchRoute(method: string, segments: string[]): { route: Route; params: Record<string, string> } | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pattern.length !== segments.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < route.pattern.length; i++) {
      const expected = route.pattern[i];
      if (expected.startsWith(':')) {
        params[expected.slice(1)] = decodeURIComponent(segments[i]);
      } else if (expected !== segments[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { route, params };
  }
  return null;
}

function buildRequestContext(request: Request): RequestContext {
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  return {
    requestId: request.headers.get('cf-ray')?.split('.')[0] ?? crypto.randomUUID(),
    ip: request.headers.get('cf-connecting-ip') ?? '0.0.0.0',
    userAgent: request.headers.get('user-agent') ?? '',
    country: cf?.country ?? null,
    startedAt: Date.now(),
  };
}

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const allowedOrigins = parseAllowedOrigins(env.ALLOWED_ORIGINS);
    const reqCtx = buildRequestContext(request);

    // CORS preflight: answer without touching the database.
    if (request.method === 'OPTIONS') {
      const headers = securityHeaders(origin, allowedOrigins);
      headers.set('x-request-id', reqCtx.requestId);
      return new Response(null, { status: 204, headers });
    }

    // Affiliate click redirect. Handled before the route table because it
    // returns a raw 302 rather than the JSON envelope.

    if (!url.pathname.startsWith(`${API_PREFIX}`)) {
      return notFoundResponse(reqCtx, origin, allowedOrigins);
    }

    const segments = url.pathname.slice(API_PREFIX.length).split('/').filter(Boolean);
    const match = matchRoute(request.method, segments);

    if (!match) {
      // Distinguish "wrong method" from "no such endpoint" — helpful for the
      // frontend during development, harmless to attackers.
      const pathExists = routes.some(
        (r) => r.pattern.length === segments.length && r.pattern.every((p, i) => p.startsWith(':') || p === segments[i]),
      );
      if (pathExists) {
        return fail(405, ERROR_CODES.NOT_FOUND, 'Method not allowed for this endpoint.', reqCtx, origin, allowedOrigins);
      }
      return notFoundResponse(reqCtx, origin, allowedOrigins);
    }

    const c = makeCtx(request, env, executionCtx, url, reqCtx);

    try {
      const result = await match.route.handler(c, match.params);

      // A handler may return a raw Response (the click redirect does).
      if (result instanceof Response) return result;

      const { body, status = 200, headers: extra } = result as HandlerResult;
      const headers = securityHeaders(origin, allowedOrigins);
      headers.set('x-request-id', reqCtx.requestId);
      headers.set('content-type', 'application/json; charset=utf-8');
      for (const [k, v] of Object.entries(extra ?? {})) headers.set(k, v);

      return new Response(JSON.stringify({ ok: true, data: body }), { status, headers });
    } catch (error) {
      return handleError(error, reqCtx, origin, allowedOrigins, c);
    }
  },

  /**
   * Nightly maintenance.
   *
   * Three jobs that would otherwise need a human: reconcile wallet counters
   * against the ledger, expire withdrawals that never settled, and drop
   * expired refresh tokens so the table cannot grow forever.
   */
  async scheduled(_controller: ScheduledController, env: Env, executionCtx: ExecutionContext): Promise<void> {
    executionCtx.waitUntil(
      (async () => {
        const startedAt = Date.now();
        const results = await Promise.allSettled([
          reconcileWallets(env),
          expireStaleWithdrawals(env),
          pruneExpiredSessions(env),
        ]);
        const failed = results.filter((r) => r.status === 'rejected');
        console.log('cron_complete', {
          durationMs: Date.now() - startedAt,
          jobs: results.length,
          failed: failed.length,
          errors: failed.map((r) => (r as PromiseRejectedResult).reason?.message),
        });
      })(),
    );
  },

  /**
   * Payout settlement consumer.
   *
   * Moving payouts off the request path means a slow or failing provider never
   * blocks the affiliate's UI, and Cloudflare's automatic retries handle
   * transient errors.
   */
  async queue(batch: MessageBatch<unknown>, env: Env, executionCtx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        await handlePayoutMessage(env, message.body);
        message.ack();
      } catch (error) {
        console.error('payout_message_failed', {
          messageId: message.id,
          attempts: message.attempts,
          error: (error as Error).message,
        });
        // Let Cloudflare retry; dead-letter handling is configured in
        // wrangler.toml once a DLQ exists.
        message.retry({ delaySeconds: 30 * message.attempts });
      }
    }
    void executionCtx;
  },
} satisfies ExportedHandler<Env>;

function makeCtx(
  request: Request,
  env: Env,
  executionCtx: ExecutionContext,
  url: URL,
  reqCtx: RequestContext,
): Ctx {
  return { env, request, url, reqCtx, executionCtx, db: env.DB };
}

function notFoundResponse(
  reqCtx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  return fail(404, ERROR_CODES.NOT_FOUND, 'That endpoint does not exist.', reqCtx, origin, allowedOrigins);
}

function handleError(
  error: unknown,
  reqCtx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
  c?: Ctx,
): Response {
  if (error instanceof HttpError) {
    // 5xx are our fault, not the client's — log them with context.
    if (error.status >= 500) {
      console.error('request_failed', {
        requestId: reqCtx.requestId,
        status: error.status,
        code: error.code,
        path: c?.url.pathname,
      });
    }
    return fromHttpError(error, reqCtx, origin, allowedOrigins);
  }

  // Never leak internals. The requestId ties this response to the log line.
  console.error('unhandled_error', {
    requestId: reqCtx.requestId,
    path: c?.url.pathname,
    message: error instanceof Error ? error.message : String(error),
  });

  return fail(
    500,
    ERROR_CODES.INTERNAL,
    'Something went wrong on our side. Please try again.',
    reqCtx,
    origin,
    allowedOrigins,
  );
}

/**
 * Durable Object class must be exported from the Worker's main module for
 * wrangler to bind it. See [[durable_objects.bindings]] in wrangler.toml.
 */
export { RateLimiter } from './rate-limiter';
