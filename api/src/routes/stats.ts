import type { DashboardStats, LeaderboardEntry, StatsRange } from '../../../shared/api-contract';
import type { Ctx } from '../lib/context';
import { requireAuth } from '../lib/context';
import { json, type HandlerResult } from '../lib/respond';
import { money, type UserRow } from '../lib/repo';
import { parse, statsQuerySchema } from '../lib/validate';
import { batchAs, firstRow } from '../lib/db';

const RANGE_DAYS: Record<StatsRange, number> = { '7d': 7, '30d': 30, '90d': 90 };

/**
 * Dashboard statistics computed from real click and conversion rows.
 *
 * Two correctness details that the prototype got wrong:
 *  - The series is zero-filled for every day in the range. Summing only the
 *    days that have rows makes a chart's x-axis lie about gaps.
 *  - Earnings count only `approved` conversions. Pending merchant approval is
 *    not money yet.
 */
export async function dashboard(c: Ctx): Promise<HandlerResult<DashboardStats>> {
  const user = await requireAuth(c);
  const query = parse(statsQuerySchema, Object.fromEntries(c.url.searchParams));
  const range = query.range ?? '30d';
  const days = RANGE_DAYS[range];
  const since = daysAgo(days);

  const [totalsRes, dailyRes, conversionsRes, linkCountRes, approvedCountRes, goalRes] =
    await batchAs<
      [
        D1Result<{ clicks: number }>,
        D1Result<{ day: string; clicks: number }>,
        D1Result<{
          id: string;
          product_id: string;
          title: string;
          commission_minor: number;
          currency: string;
          status: string;
          day: string;
        }>,
        D1Result<{ total: number }>,
        D1Result<{ total: number }>,
        D1Result<{ target_minor: number; currency: string }>,
      ]
    >(c.db, [
      c.db
        .prepare(
          `SELECT COUNT(*) AS clicks FROM clicks
            WHERE link_id IN (SELECT id FROM affiliate_links WHERE user_id = ?)
              AND created_at >= ?`,
        )
        .bind(user.id, since),
      c.db
        .prepare(
          `SELECT substr(c.created_at, 1, 10) AS day, COUNT(*) AS clicks
             FROM clicks c
             JOIN affiliate_links al ON al.id = c.link_id
            WHERE al.user_id = ? AND c.created_at >= ?
            GROUP BY day ORDER BY day`,
        )
        .bind(user.id, since),
      c.db
        .prepare(
          `SELECT cv.id, al.product_id, p.title, cv.commission_minor, cv.currency, cv.status,
                  substr(cv.created_at, 1, 10) AS day
             FROM conversions cv
             JOIN affiliate_links al ON al.id = cv.link_id
             JOIN products p ON p.id = al.product_id
            WHERE al.user_id = ? AND cv.created_at >= ?`,
        )
        .bind(user.id, since),
      c.db.prepare('SELECT COUNT(*) AS total FROM affiliate_links WHERE user_id = ?').bind(user.id),
      c.db
        .prepare(
          `SELECT COUNT(*) AS total FROM conversions cv
             JOIN affiliate_links al ON al.id = cv.link_id
            WHERE al.user_id = ? AND cv.created_at >= ? AND cv.status = 'approved'`,
        )
        .bind(user.id, since),
      c.db.prepare('SELECT target_minor, currency FROM affiliate_goals WHERE user_id = ?').bind(user.id),
    ]);

  const totals = firstRow(totalsRes);
  const daily = dailyRes.results ?? [];
  const allConversions = conversionsRes.results ?? [];
  const linkCount = firstRow(linkCountRes);
  const conversions = firstRow(approvedCountRes);
  const goalRow = firstRow(goalRes);

  const currency = (goalRow?.currency ?? 'NGN') as 'NGN' | 'USD';
  const approved = allConversions.filter((row) => row.status === 'approved');

  const clicksByDay = new Map<string, number>(daily.map((row) => [row.day, row.clicks] as [string, number]));
  const conversionsByDay = new Map<string, number>();
  const earningsByDay = new Map<string, number>();
  for (const row of approved) {
    conversionsByDay.set(row.day, (conversionsByDay.get(row.day) ?? 0) + 1);
    earningsByDay.set(row.day, (earningsByDay.get(row.day) ?? 0) + row.commission_minor);
  }

  const series = Array.from({ length: days }, (_, index) => {
    const date = daysAgo(days - 1 - index).slice(0, 10);
    return {
      date,
      clicks: clicksByDay.get(date) ?? 0,
      conversions: conversionsByDay.get(date) ?? 0,
      earningsMinor: earningsByDay.get(date) ?? 0,
    };
  });

  const totalClicks = totals?.clicks ?? 0;
  const totalConversions = conversions?.total ?? 0;
  const totalEarnings = approved.reduce((sum, row) => sum + row.commission_minor, 0);

  const perProduct = new Map<string, { title: string; clicks: number; conversions: number; earnings: number }>();
  for (const row of approved) {
    const entry = perProduct.get(row.product_id) ?? { title: row.title, clicks: 0, conversions: 0, earnings: 0 };
    entry.conversions += 1;
    entry.earnings += row.commission_minor;
    perProduct.set(row.product_id, entry);
  }

  return json({
    clicks: totalClicks,
    conversions: totalConversions,
    // Basis points, integer: 350 = 3.50%.
    conversionRateBps: totalClicks > 0 ? Math.round((totalConversions / totalClicks) * 10_000) : 0,
    earnings: money(totalEarnings, currency),
    activeLinks: linkCount?.total ?? 0,
    series,
    topProducts: [...perProduct.entries()]
      .sort((a, b) => b[1].earnings - a[1].earnings)
      .slice(0, 5)
      .map(([productId, value]) => ({
        productId,
        title: value.title,
        clicks: value.clicks,
        conversions: value.conversions,
        earnings: money(value.earnings, currency),
      })),
    goal: goalRow
      ? {
          targetMinor: goalRow.target_minor,
          progressMinor: totalEarnings,
          currency: (goalRow.currency ?? 'NGN') as 'NGN' | 'USD',
        }
      : null,
  });
}

/**
 * Public leaderboard.
 *
 * The prototype returned real user names and exact earnings for every account.
 * That is a privacy leak, so entries are pseudonymised to a handle and ranked
 * rather than attributed.
 */
export async function leaderboard(c: Ctx): Promise<HandlerResult<{ entries: LeaderboardEntry[] }>> {
  const limit = Math.min(25, Math.max(1, Number.parseInt(c.url.searchParams.get('limit') ?? '10', 10) || 10));

  const { results } = await c.db
    .prepare(
      `SELECT u.id, u.name, u.tier,
              COALESCE(SUM(cv.commission_minor), 0) AS earnings,
              COUNT(cv.id) AS conversions
         FROM users u
         LEFT JOIN affiliate_links al ON al.user_id = u.id
         LEFT JOIN conversions cv ON cv.link_id = al.id AND cv.status = 'approved'
        WHERE u.deleted_at IS NULL AND u.status = 'active'
        GROUP BY u.id
       HAVING earnings > 0
        ORDER BY earnings DESC
        LIMIT ?`,
    )
    .bind(limit)
    .all<{ id: string; name: string; tier: string; earnings: number; conversions: number }>();

  const viewer = c.user ?? null;

  const entries: LeaderboardEntry[] = (results ?? []).map((row, index) => ({
    handle: pseudonym(row.name, row.id === viewer?.id),
    tier: (row.tier as LeaderboardEntry['tier']) ?? 'starter',
    earnings: money(row.earnings, 'NGN'),
    conversions: row.conversions,
    rank: index + 1,
  }));

  return json({ entries });
}

/** "Chinedu Nwankwo" -> "Chinedu N." — recognisable, not identifying. */
function pseudonym(name: string, isViewer: boolean): string {
  if (isViewer) return 'You';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

export type { UserRow };
