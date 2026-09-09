import type { ApiResponse } from '../../../shared/api-contract';
import { ERROR_CODES } from '../../../shared/api-contract';
import { HttpError } from './errors';

export interface RequestContext {
  /** Correlation id surfaced in every response and log line. */
  requestId: string;
  ip: string;
  userAgent: string;
  country: string | null;
  startedAt: number;
}

/**
 * Security headers applied to every response.
 *  - `nosniff` / `frame-ancestors 'none'`: the API is never embedded or sniffed.
 *  - CORS is an allowlist resolved per-request in `cors.ts`, never `*` with
 *    credentials (the Express prototype used `cors()` with no origin check).
 */
export function securityHeaders(origin: string | null, allowedOrigins: Set<string>): Headers {
  const headers = new Headers({
    'x-content-type-options': 'nosniff',
    'x-request-id': '',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
    'permissions-policy': 'geolocation=(), microphone=(), camera=()',
    vary: 'Origin',
  });
  if (origin && allowedOrigins.has(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('access-control-allow-headers', 'Authorization, Content-Type, Idempotency-Key');
    headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.set('access-control-max-age', '86400');
  }
  return headers;
}

export function parseAllowedOrigins(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  );
}

function buildResponse<T>(
  status: number,
  body: ApiResponse<T>,
  ctx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
  extra: Record<string, string> = {},
): Response {
  const headers = securityHeaders(origin, allowedOrigins);
  headers.set('x-request-id', ctx.requestId);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [k, v] of Object.entries(extra)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

/**
 * What a route handler returns. Handlers never construct a `Response` and
 * never see CORS state — the router in `index.ts` owns the envelope, the
 * security headers and the error mapping, so every endpoint is consistent by
 * construction rather than by convention.
 */
export interface HandlerResult<T = unknown> {
  body: T;
  status?: number;
  headers?: Record<string, string>;
}

export function json<T>(body: T, status = 200, headers?: Record<string, string>): HandlerResult<T> {
  return { body, status, headers };
}

export function ok<T>(
  data: T,
  ctx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
  extra: Record<string, string> = {},
): Response {
  return buildResponse(200, { ok: true, data }, ctx, origin, allowedOrigins, extra);
}

export function created<T>(
  data: T,
  ctx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  return buildResponse(201, { ok: true, data }, ctx, origin, allowedOrigins);
}

export function fail(
  status: number,
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  message: string,
  ctx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
  fields?: Record<string, string>,
): Response {
  return buildResponse(
    status,
    { ok: false, error: { code, message, requestId: ctx.requestId, ...(fields ? { fields } : {}) } },
    ctx,
    origin,
    allowedOrigins,
  );
}

export function fromHttpError(
  err: HttpError,
  ctx: RequestContext,
  origin: string | null,
  allowedOrigins: Set<string>,
): Response {
  return buildResponse(
    err.status,
    {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        requestId: ctx.requestId,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    },
    ctx,
    origin,
    allowedOrigins,
  );
}
