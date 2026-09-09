#!/usr/bin/env node
/**
 * Deployment preflight — fail loudly on unfilled placeholders.
 *
 * Why this exists
 * ---------------
 * `vercel.json` cannot use environment variables: Vercel substitutes env vars in
 * code only, never in config, so the `/api/*` rewrite destination has to be a
 * literal URL in the committed file. Until a real Worker URL is put there it
 * reads `https://affiliate-hub-api.REPLACE_ME.workers.dev`.
 *
 * That is not detectable at build time and produces no error. Vercel builds
 * green, deploys green, and then every `/api` call from the browser 404s against
 * a host that does not exist. The site renders, so it looks fine until someone
 * tries to sign in.
 *
 * This script turns that silent failure into a build failure with the exact line
 * to fix. It runs as part of `build:vercel`, which is the `buildCommand` in
 * vercel.json, so the deploy stops before it ships rather than after.
 *
 * Usage:
 *   node scripts/check-deploy.mjs vercel    # before a Vercel build
 *   node scripts/check-deploy.mjs worker    # before `wrangler deploy`
 *   node scripts/check-deploy.mjs           # check everything
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Directory the check runs against.
 *
 * Overridable so tests can point it at a scratch directory. The first version had
 * no override, so the test rewrote `api/wrangler.toml` in place — a file
 * `wrangler dev` watches — and running the test suite killed the dev server. A
 * test should not mutate tracked files that a live process depends on.
 */
const root = process.env.DEPLOY_CHECK_ROOT
  ? path.resolve(process.env.DEPLOY_CHECK_ROOT)
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * A literal placeholder token that must be replaced before deploying.
 *
 * The token class includes digits: `REPLACE_WITH_D1_DATABASE_ID` matched only as
 * `REPLACE_WITH_D` without them, which would have let the ALLOWED list miss and
 * reported a token that does not appear in the file.
 */
const PLACEHOLDER = /REPLACE_ME|REPLACE_WITH_[A-Z0-9_]+/g;

/**
 * Files to check for a given deploy target.
 *
 * Scoped per target because a Vercel build cannot fix `wrangler.toml` and
 * vice versa; reporting both would bury the one that actually blocks this deploy.
 */
const TARGETS = {
  vercel: ['vercel.json'],
  worker: ['api/wrangler.toml'],
};

/** Known placeholders that are harmless locally, with the reason. */
const ALLOWED = [
  {
    file: 'api/wrangler.toml',
    token: 'REPLACE_WITH_KV_NAMESPACE_ID',
    // Miniflare ignores the id locally, so `wrangler dev --local` works fine.
    // Only `wrangler deploy` needs the real namespace id.
    allowWhen: (target) => target === 'vercel',
  },
];

const read = (rel) => {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, 'utf8');
};

/** Line numbers for every placeholder occurrence, for an actionable message. */
const findPlaceholders = (rel, contents) => {
  const hits = [];
  contents.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(PLACEHOLDER)) {
      hits.push({ line: i + 1, token: match[0], text: line.trim().slice(0, 120) });
    }
  });
  return hits.map((h) => ({ ...h, file: rel }));
};

const target = process.argv[2];
const targets = target ? [target] : Object.keys(TARGETS);

const unknown = targets.filter((t) => !TARGETS[t]);
if (unknown.length) {
  console.error(`  unknown deploy target: ${unknown.join(', ')}\n  valid: ${Object.keys(TARGETS).join(', ')}`);
  process.exit(2);
}

const files = [...new Set(targets.flatMap((t) => TARGETS[t]))];
const findings = [];

for (const rel of files) {
  const contents = read(rel);
  if (contents === null) {
    console.error(`  cannot check ${rel}: file not found`);
    process.exit(2);
  }
  for (const hit of findPlaceholders(rel, contents)) {
    const allowed = ALLOWED.some(
      (a) => a.file === rel && a.token === hit.token && a.allowWhen(target),
    );
    if (!allowed) findings.push(hit);
  }
}

if (findings.length === 0) {
  console.log(`  deploy preflight: ${files.length} file(s) clean`);
  process.exit(0);
}

const byFile = findings.reduce((acc, f) => {
  (acc[f.file] ??= []).push(f);
  return acc;
}, {});

console.error('\n  Deploy preflight FAILED — unfilled placeholders:\n');
for (const [file, hits] of Object.entries(byFile)) {
  console.error(`  ${file}`);
  for (const hit of hits) {
    console.error(`    line ${hit.line}: ${hit.token}`);
    console.error(`      ${hit.text}`);
  }
  console.error('');
}

console.error(
  '  These are literal values in the committed file, not variables: Vercel\n' +
    '  substitutes environment variables in code only, never in config. The\n' +
    '  build would otherwise succeed and deploy a site whose every /api call\n' +
    '  fails against a host that does not exist.\n' +
    '\n' +
    '  Replace each one, then re-run. See docs/DEPLOYMENT.md for where the real\n' +
    '  values come from.\n',
);

process.exit(1);
