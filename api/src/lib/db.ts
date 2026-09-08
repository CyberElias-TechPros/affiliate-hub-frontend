/**
 * D1 helpers.
 *
 * `D1Database.batch()` types every result as `D1Result<unknown>`, which makes
 * the rows unusable without a cast. `batchAs` re-types the returned tuple to
 * match the statements, in order, so the cast lives in exactly one place
 * instead of at every call site.
 */
export async function batchAs<T extends readonly D1Result<unknown>[]>(
  db: D1Database,
  statements: D1PreparedStatement[],
): Promise<T> {
  return (await db.batch(statements)) as unknown as T;
}

/** Narrow a possibly-null aggregate row to a number. */
export function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * First row of a batch result, or null.
 *
 * `D1PreparedStatement` has a `.first()` method, but the `D1Result` returned
 * inside a `batch()` response does not — it only carries `results`. This is the
 * one place that encodes that difference.
 */
export function firstRow<T>(result: D1Result<T>): T | null {
  return result.results?.[0] ?? null;
}
