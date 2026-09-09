import type { Env } from './env';
import type { RequestContext } from './respond';
import type { UserRow } from './repo';
import { authenticate } from './auth';

/**
 * Everything a route handler needs. Kept intentionally small: no `req`/`res`
 * objects, no framework — a handler reads `c.url`, queries `c.db`, and returns
 * data.
 */
export interface Ctx {
  env: Env;
  request: Request;
  url: URL;
  reqCtx: RequestContext;
  executionCtx: ExecutionContext;
  db: D1Database;
  /** Populated by `requireAuth()`. */
  user?: UserRow;
}

/** Resolve and attach the authenticated user, or throw 401. */
export async function requireAuth(c: Ctx): Promise<UserRow> {
  if (c.user) return c.user;
  c.user = await authenticate(c.request, c.env, c.db);
  return c.user;
}

/** Non-throwing variant, for endpoints that personalise but permit anonymous. */
export async function optionalAuth(c: Ctx): Promise<UserRow | null> {
  if (c.user) return c.user;
  try {
    c.user = await authenticate(c.request, c.env, c.db);
    return c.user;
  } catch {
    return null;
  }
}

/** Best-effort audit trail. Never fails the request that produced it. */
export async function audit(
  c: Ctx,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await c.db
      .prepare(
        `INSERT INTO audit_events (id, actor_id, action, resource_type, resource_id, metadata, ip_address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        crypto.randomUUID(),
        c.user?.id ?? null,
        action,
        resourceType,
        resourceId,
        JSON.stringify(metadata),
        c.reqCtx.ip,
        new Date().toISOString(),
      )
      .run();
  } catch (error) {
    console.error('audit_write_failed', { action, error: (error as Error).message });
  }
}

/** Create a user-facing notification. */
export async function notify(
  c: Ctx,
  userId: string,
  title: string,
  body: string,
  href: string | null = null,
): Promise<void> {
  try {
    await c.db
      .prepare(
        `INSERT INTO notifications (id, user_id, title, body, href, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), userId, title, body, href, new Date().toISOString())
      .run();
  } catch (error) {
    console.error('notification_write_failed', { userId, error: (error as Error).message });
  }
}
