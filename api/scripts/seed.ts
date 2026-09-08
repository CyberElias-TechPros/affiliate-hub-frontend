#!/usr/bin/env npx tsx
/**
 * Seed CLI.
 *
 * Usage:
 *   npx wrangler d1 execute affiliate-hub-db --local --file=migrations/0001_init.sql
 *   npm run seed:local                 # seeds the local D1 database
 *   npm run seed:remote -- --confirm   # seeds a real D1 database
 *
 * This wrapper exists because `seedDatabase()` takes a live `D1Database`
 * binding, which only exists inside a Worker. To seed from a terminal we spin
 * up Miniflare against the same wrangler.toml, hand the worker its real binding,
 * and run the seeder inside that context.
 *
 * Seeding is deliberately idempotent-by-check rather than destructive: it
 * refuses to run against a database that already has users, because blowing
 * away someone's real records is not a recoverable mistake.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Miniflare } from 'miniflare';
import { parseSqlStatements } from '../src/lib/sql';

const apiRoot = resolve(import.meta.dirname, '..');
const repoRoot = resolve(apiRoot, '..');

const args = process.argv.slice(2);
const isRemote = args.includes('--remote');
const hasConfirm = args.includes('--confirm');

if (isRemote && !hasConfirm) {
  console.error(
    '\nRefusing to seed a REMOTE database without --confirm.\n' +
      'Seeding writes demo users, products and transactions.\n' +
      'Re-run with: npm run seed:remote -- --confirm\n',
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const wranglerToml = readFileSync(resolve(apiRoot, 'wrangler.toml'), 'utf8');
  const databaseIdMatch = /database_id\s*=\s*"([^"]+)"/.exec(wranglerToml);

  const mf = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("ok"); } }',
    d1Databases: { DB: databaseIdMatch?.[1] ?? 'seed-local-db' },
    kvNamespaces: ['CACHE'],
    r2Buckets: ['ASSETS'],
    durableObjects: { RATE_LIMIT: 'RateLimiter' },
    /**
     * Persist D1 into wrangler's own local state directory.
     *
     * Three things here were each individually wrong, and every one failed
     * silently — the seed printed accurate row counts from its own in-memory
     * database while the dev server read an empty one:
     *
     *  - `d1Persist` must be an absolute **path**, not `true`. Miniflare 3's
     *    `Persistence` type is `boolean | string`; `true` persists to a temp
     *    directory that is discarded, and `persistTo` on its own does nothing
     *    for D1 at all. Verified by probing each combination directly.
     *  - Miniflare appends `miniflare-D1DatabaseObject/<hash>.sqlite` to whatever
     *    path it is given, and the hash is derived from the database id. Wrangler
     *    keeps an extra `d1/` segment above that, so the target is
     *    `.wrangler/state/v3/d1` — which resolves to byte-for-byte the same file
     *    `wrangler dev --local` opens.
     *  - Setting `persistTo` alongside it disables the D1 persist path entirely.
     *
     * If any of these regress, `seed:local` appears to succeed and the printed
     * demo login then fails against an empty database.
     */
    ...(isRemote ? {} : { d1Persist: resolve(apiRoot, '.wrangler/state/v3/d1') }),
  });

  try {
    const db = (await mf.getD1Database('DB')) as unknown as {
      exec: (sql: string) => Promise<unknown>;
      prepare: (sql: string) => { first: <T>() => Promise<T | null> };
    };

    // Apply every migration in order, so seeding works on a fresh database.
    const { readdirSync } = await import('node:fs');
    const migrationDir = resolve(apiRoot, 'migrations');
    const migrations = readdirSync(migrationDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of migrations) {
      const sql = readFileSync(resolve(migrationDir, file), 'utf8');
      for (const statement of parseSqlStatements(sql)) {
        try {
          await db.exec(statement);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // "already exists" means the migration was applied on a previous run.
          if (!/already exists/i.test(message)) throw error;
        }
      }
      console.log(`  ✓ ${file}`);
    }

    const { seedDatabase, DEMO_AFFILIATE, DEMO_PASSWORD_DEFAULT } = await import('./seed-data');

    const existing = await db
      .prepare('SELECT COUNT(*) AS count FROM users')
      .first<{ count: number }>();

    if ((existing?.count ?? 0) > 0 && !args.includes('--force')) {
      console.log(
        `\nDatabase already contains ${existing?.count} user(s).\n` +
          'Refusing to seed over existing data. Use --force if you are certain ' +
          'this database holds nothing you need.\n',
      );
      return;
    }

    await seedDatabase(db as never);

    // `seedDatabase` returns void (it is shared with the test suite, which does
    // not need counts). Rather than change a verified function's contract, the
    // CLI reads back what it wrote — which has the side benefit of reporting
    // what is actually in the database, not what the seeder intended to write.
    const count = async (table: string): Promise<number> => {
      const row = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).first<{ count: number }>();
      return row?.count ?? 0;
    };

    console.log('\nSeeded:');
    console.log(`  ${await count('users')} user(s)`);
    console.log(`  ${await count('products')} product(s)`);
    console.log(`  ${await count('affiliate_links')} affiliate link(s)`);
    console.log(`  ${await count('clicks')} click(s)`);
    console.log(`  ${await count('conversions')} conversion(s)`);
    console.log(`  ${await count('transactions')} transaction(s)`);
    console.log(`  ${await count('faqs')} FAQ(s)`);
    console.log('\nSign in with:');
    console.log(`  email:    ${DEMO_AFFILIATE.email}`);
    console.log(`  password: ${DEMO_PASSWORD_DEFAULT}`);
    console.log(
      `\nChange the demo password before this database is reachable from the internet.`,
    );
    void repoRoot;
  } finally {
    await mf.dispose();
  }
}

main().catch((error) => {
  console.error('\nSeeding failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
