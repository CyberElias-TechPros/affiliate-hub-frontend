import type { Notification, Page } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { requireAuth } from '../lib/context';
import { HttpError } from '../lib/errors';
import { json, type HandlerResult } from '../lib/respond';
import { buildPage, toNotification, type NotificationRow } from '../lib/repo';
import { idParamSchema, notificationQuerySchema, parse } from '../lib/validate';
import { batchAs, firstRow } from '../lib/db';

export async function listNotifications(
  c: Ctx,
): Promise<HandlerResult<Page<Notification> & { unreadCount: number }>> {
  const user = await requireAuth(c);
  const query = parse(notificationQuerySchema, Object.fromEntries(c.url.searchParams));
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const where = ['user_id = ?'];
  const bindings: (string | number)[] = [user.id];
  if (query.unreadOnly) where.push('read_at IS NULL');
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const [listRes, countRes, unreadRes] = await batchAs<
    [
      D1Result<NotificationRow>,
      D1Result<{ total: number }>,
      D1Result<{ total: number }>,
    ]
  >(c.db, [
    c.db
      .prepare(`SELECT * FROM notifications ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(...bindings, pageSize, (page - 1) * pageSize),
    c.db.prepare(`SELECT COUNT(*) AS total FROM notifications ${whereSql}`).bind(...bindings),
    c.db
      .prepare('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL')
      .bind(user.id),
  ]);

  const rows = listRes.results ?? [];
  const countRow = firstRow(countRes);
  const unreadRow = firstRow(unreadRes);

  const base = buildPage((rows ?? []).map(toNotification), page, pageSize, countRow?.total ?? 0);
  return json({ ...base, unreadCount: unreadRow?.total ?? 0 });
}

export async function markRead(c: Ctx): Promise<HandlerResult<{ marked: number }>> {
  const user = await requireAuth(c);
  const id = parse(idParamSchema, pathParam(c, 3));

  // Scoped to the authenticated user: without `AND user_id = ?` any signed-in
  // affiliate could mark someone else's notifications read.
  const result = await c.db
    .prepare('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL')
    .bind(new Date().toISOString(), id, user.id)
    .run();

  return json({ marked: result.meta.changes });
}

export async function markAllRead(c: Ctx): Promise<HandlerResult<{ marked: number }>> {
  const user = await requireAuth(c);
  const result = await c.db
    .prepare('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL')
    .bind(new Date().toISOString(), user.id)
    .run();
  return json({ marked: result.meta.changes });
}

export async function removeNotification(c: Ctx): Promise<HandlerResult<{ deleted: boolean }>> {
  const user = await requireAuth(c);
  const id = parse(idParamSchema, pathParam(c, 3));

  const result = await c.db
    .prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?')
    .bind(id, user.id)
    .run();

  if (result.meta.changes === 0) throw HttpError.notFound('We could not find that notification.');
  return json({ deleted: true });
}

function pathParam(c: Ctx, index: number): string {
  return c.url.pathname.split('/').filter(Boolean)[index] ?? '';
}
