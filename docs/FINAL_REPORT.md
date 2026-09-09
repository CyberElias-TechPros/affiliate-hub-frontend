# Affiliate Hub — Final Report

Autonomous reconstruction and productionization of `CyberElias-TechPros/affiliate-hub-frontend`.

Every claim below is tagged with a verification state. The distinction is deliberate:
**Implemented** means the code exists; **Verified** means it was executed here and
observed; **Environment-dependent** means it cannot be exercised without live
credentials; **Not verified** means it was not run. A clean exit code is not treated as
a pass when the output was wrong — several items below were caught that way.

---

## A. Product Reconstruction

**What this product is.** An affiliate marketing marketplace for Nigerian creators. An
affiliate signs up, completes onboarding (country, niches, WhatsApp), browses merchant
products in a marketplace, generates a tracked link per product, shares it — WhatsApp is
the primary channel, with ready-made captions — and earns commission when someone buys
through their link. Commission moves from *pending* to *available* once the merchant
approves the sale. The affiliate then withdraws to a Nigerian bank account (free,
min ₦5,000), USDT (1% fee, min $50) or PayPal (2% fee, min $50).

**Monetisation.** A take-rate on the commission the merchant already pays, plus optional
display advertising.

**Provenance.** *FACT* for the flows above — each is directly evidenced by a page, a
route or a table in the repository. *HIGH-CONFIDENCE INFERENCE* for the WhatsApp-first
emphasis, which is inferable from the share components and the NGN-primary currency but
is never stated in a document.

**Maturity at handoff: prototype / UI shell.** Nineteen pages existed and rendered, but
the majority were hardcoded — a fixed ₦472,500 balance, five fabricated transactions
dated December 2024, a leaderboard of invented names. `MASTER_IMPLEMENTATION_PLAN.md`
claimed "✅ Implementation Complete". It was not. That document was treated as evidence
of intent, not as a statement of fact.

---

## B. Initial State (measured, not estimated)

| Check | Result at baseline |
|---|---|
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 — but `strict: false` |
| `npm run lint` | **exit 1** — 10 errors, 8 warnings |
| `npm run build` | exit 0 — with a CSS `@import` error in the output |
| Bundle | 520.47 kB / **157.54 kB gzip**, single chunk |
| Test runner | **none** — no test script, no test dependency |
| Backend | `backend/index.js`, an 854-line Express + SQLite monolith |
| Secrets | `backend/.env` **committed**, `JWT_SECRET=your-secret-key-here` |
| Dead code | `src/App.css` (unimported), `use-toast.ts`, `NavLink.tsx` |
| Undefined CSS | `safe-area-pb`, `safe-bottom`, `scrollbar-hide` — 5 uses, 0 definitions |

The build "succeeded" while shipping a bundle in which the web fonts had been silently
dropped. That is the central lesson of this repo: **its own checks were too weak to
detect its own breakage.** `strict: false` let `any` through the entire API layer; there
were no tests to fail.

---

## C. Problems Found, by Severity

### CRITICAL

| # | Problem | Evidence |
|---|---|---|
| C1 | **Wallet could print money.** A negative withdrawal amount *increased* the balance, and the balance check was a `SELECT` followed by a separate `UPDATE` with no transaction — two concurrent requests could both pass and both spend. | `backend/index.js` withdrawal handler |
| C2 | **Fake social auth minted valid JWTs.** An unverified endpoint issued real tokens for any claimed identity. | `backend/index.js` `social-auth` |
| C3 | **Refresh token == access token.** One secret, no `typ` claim, no rotation. Any leaked token was permanent. | `backend/index.js` token issuance |
| C4 | **Committed secret.** `backend/.env` in git with a placeholder `JWT_SECRET`. | `git ls-files backend/` |
| C5 | **Route shadowing.** `/products/:id` was registered before `/products/search` and `/products/categories`, making both unreachable. | `backend/index.js` route order |

### HIGH

| # | Problem |
|---|---|
| H1 | No auth provider, no route guards — every "private" page was publicly reachable |
| H2 | `WithdrawPage.handleWithdraw` faked a 2-second `setTimeout`, made no API call, and reported success against a hardcoded ₦472,500 |
| H3 | `OnboardingPage.handleComplete` collected country/niches/WhatsApp then discarded all three |
| H4 | Affiliate link URLs built from client-controlled `req.headers.origin` with guessable codes (`AFF${Date.now()}${rand}`) |
| H5 | Leaderboard leaked real names and earnings across all affiliates |
| H6 | `authenticateToken` returned 403 with an empty body instead of 401 |
| H7 | `cors()` wide open; no rate limiting, no helmet, no body-size limits |
| H8 | Fabricated marketing: "₦50M+ paid", "15,000+ affiliates", "500+ products", "98% on-time payouts", plus named testimonials for people who do not exist |
| H9 | SEO: title "Lovable App", description "Lovable Generated Project", OG image and `twitter:site` pointing at lovable.dev, no canonical, no sitemap, no structured data, blanket-allow `robots.txt` |

### MEDIUM / LOW

Ad slot keys copied from an unrelated fintech app (`'send'`, `'bills'`, `'invest'`);
`maxRefreshes=5` declared but never enforced (infinite 30 s `setInterval`); marketplace
search state never sent to the API and "New" implemented as `filtered.slice(0, 2)`;
`page` and `limit` accepted then ignored; `/products/:id` returning fabricated
`whyPromote`; USD conversion hardcoded at `balance / 450`; no click-tracking endpoint;
dual lockfiles; dead UI controls throughout.

---

## D. Problems Fixed

Format: **Problem → Evidence → Root Cause → Solution → Result.**

### D1. Wallet double-spend (C1)
**Problem.** Negative withdrawal amounts increased the balance; concurrent withdrawals could both succeed.
**Evidence.** `backend/index.js` — `SELECT balance` … `UPDATE balance` with no transaction, and no sign check on the amount.
**Root cause.** A read-then-write pattern that is only safe inside a transaction, used outside one. SQLite made this survivable in single-user local testing; it would not survive two users.
**Solution.** `amountMinor` validated `.positive()` at the schema layer. The debit is a guarded `INSERT … WHERE EXISTS(… available_minor >= ?)` followed by `UPDATE … AND available_minor >= ?` in a single `D1.batch()`, then `meta.changes` is read to confirm the guard held. The INSERT is deliberately first so both conditions see the pre-decrement value.
**Result.** **Verified** — `api/test/api.test.ts` includes a concurrent-withdrawal test; the second request fails and the balance is debited exactly once.

### D2. Fake social auth (C2)
**Problem.** An unverified endpoint minted valid JWTs.
**Evidence.** `backend/index.js` `social-auth`.
**Root cause.** A stub shipped to make a demo work and never gated.
**Solution.** Endpoint removed entirely. The only credential paths are email+password, refresh, and password change.
**Result.** **Verified** — no route in `api/src/index.ts` issues a token without verifying a password hash or a stored refresh token.

### D3. Token model (C3)
**Problem.** One secret, one token type, refresh == access.
**Root cause.** No separation between "who are you right now" and "prove you can stay".
**Solution.** HS256 with `alg` pinned; separate `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET`; `typ` checked on every verification; access 15 min, refresh 30 days stored as a SHA-256 hash; rotation with reuse detection that revokes the whole token family.
**Result.** **Verified** — refresh rotation and reuse revocation are both covered by tests.

### D4. Committed secret (C4)
**Problem.** `backend/.env` tracked in git.
**Root cause.** No `.env` rule in `.gitignore`.
**Solution.** `git rm --cached backend/.env`; `.gitignore` now covers `.env` and `.env.*` while preserving `.env.example`. The Worker reads secrets from `wrangler secret`, so the new architecture has no committed secret at all.
**Result.** **Verified** — `git ls-files backend/` returns zero `.env` files.

> **Correction.** This was first reported as verified when it was not. `backend/.env` was
> still tracked, and the command used to check it could not have detected that:
> `git check-ignore` consults the index by default, so a *tracked* path reports as
> "ignored" — the ignore rule and the tracked file are not mutually exclusive, and reading
> only the former is meaningless. The removal also had to be re-applied, because a
> `.gitignore` entry never untracks a path already in the index.
>
> It is now genuinely untracked (`git ls-files --error-unmatch backend/.env` fails, and
> `git check-ignore --no-index` confirms the pattern matches independently of the index).
> `test/repo-hygiene.test.ts` asserts this against the index directly, because a claim
> verified by a command that cannot fail is not a verification. The file remains in git
> history at `ab2624d`, so the secret must still be treated as public.
**Open item.** The file remains in git history. The correct remediation is to **rotate secrets**, not rewrite history. Recorded in `SECURITY.md`.

### D5. Route shadowing (C5)
**Problem.** Literal routes unreachable behind parameterised ones.
**Solution.** Literal segments are matched before parameterised ones, and the ordering is commented at the call site so it is not "tidied" later.
**Result.** **Verified** — `/products/categories` and `/products/:slug` are both exercised.

### D6. Withdrawal never called an API (H2)
**Problem.** `setTimeout` + success toast, no request.
**Solution.** Real `WalletAPI.withdraw` with the amount converted to integer minor units, an idempotency key generated once per attempt and reused on retry (regenerated only on failure), fees and minimums read from the server, and query invalidation on success.
**Result.** **Verified** — the withdrawal path is covered end-to-end in the backend suite, including idempotent replay returning `deduplicated: true`.

### D7. Onboarding discarded its input (H3)
**Problem.** Three fields collected, none saved.
**Solution.** `POST /auth/onboarding` persists country, niches and WhatsApp; the response updates the session.
**Result.** **Implemented**, **Verified** at the API layer.

### D8. Fabricated marketing (H8)
**Problem.** Verifiable claims about a product that has never processed a payout, plus invented testimonials.
**Evidence.** `LandingPage.tsx` (stats array, three named testimonials, "Nigeria's #1"), `AboutPage.tsx` (founded 2022, "15K+ affiliates", "₦50M+ paid", "500+ products"), `HowItWorksPage.tsx` ("Join 15,000+ affiliates").
**Root cause.** Placeholder marketing copy from a template that was never reconciled against reality.
**Solution.** Every unverifiable figure replaced with something checkable from the product itself — the commission ceiling, the three payout methods, the cookie window, the cost. The three named testimonials with earnings claims ("₦2M in 6 months", "doubled my earnings") attributed to people who do not exist were replaced with a section describing what the platform does, since invented endorsements are a consumer-protection problem rather than a copywriting one. "Nigeria's #1 Affiliate Platform" became "Built for Nigerian creators".
**Result.** **Verified** — a `grep` sweep across `src/` and `index.html` for `15,000+`, `15K+`, `₦50M+`, `500+ products`, `98%`, `Nigeria's #1` and each fabricated name returns nothing outside the code comments that explain the removal.

> **Correction.** An earlier draft of this report marked D8 verified after only
> `index.html` had been cleaned; the page components still carried every fabricated
> figure. The claim was wrong, the sweep is now actually run, and the pages are fixed.
> The lesson generalises: this defect survived because nothing in the repo tested
> marketing copy, and it was caught only by grepping rather than by any check.

### D9. SEO baseline (H9)
**Problem.** "Lovable App" title, lovable.dev OG image, no canonical/sitemap/structured data.
**Solution.** `index.html` rewritten with real meta/OG/Twitter/JSON-LD; a `Seo` component sets per-route title, description, canonical, robots and JSON-LD; `robots.txt` rewritten to disallow authenticated routes; `sitemap.xml` added; a real `og-image.png` (1200×630, 102 kB) and app icons created.
**Result.** **Verified** — `test/seo.test.tsx` asserts distinct titles per route, canonical output, robots directives and parsable JSON-LD.
**Not promised.** None of this guarantees indexing or ranking. It removes the things that would have *prevented* correct indexing.

### D10. Fonts silently dropped in production
**Problem.** `src/index.css` had a Google Fonts `@import` positioned after `@tailwind`, which Vite discarded.
**Evidence.** `grep -bo "@import" dist/assets/*.css` → **no matches** in the built output.
**Root cause.** CSS spec requires `@import` to precede all other rules; the build was warning and nobody read the warning.
**Solution.** Fonts moved to `<link>` with `preconnect` in `index.html`.
**Result.** **Verified** — built CSS contains no `@import`; the font `<link>` and three `preconnect` tags are present in `dist/index.html`.

### D11. Undefined Tailwind utilities
**Problem.** `safe-area-pb`, `safe-bottom`, `scrollbar-hide` used in five places, defined nowhere — so they compiled to nothing.
**Solution.** All three defined in `src/index.css`.
**Result.** **Verified** — each appears in the built CSS.

### D12. AdSense contamination
**Problem.** Hardcoded `ca-pub-9117572925263537`, one slot id for every placement, and a full-screen interstitial on `app_open`.
**Solution.** Ads gated behind `adsEnabled()` requiring both client and slot; no interstitial; no refresh timer.
**Result.** **Verified** — `grep` finds no hardcoded publisher id in `dist/`, `src/` or `index.html`.

### D13. The documented quick start did not actually work
**Problem.** Following the README in order produced an app with an empty catalogue and a demo login that failed.
**Evidence.** Run end-to-end against `wrangler dev --local`: `/api/v1/products` returned `totalItems: 0` and `/api/v1/auth/login` returned **500** with `Imported HMAC key length (0) must be a non-zero value…`.
**Root cause — three independent defects, each failing silently:**

1. **The seed script never persisted anything.** It passed `d1Persist: true` to Miniflare, but Miniflare 3's `Persistence` type is `boolean | string` and `true` targets a temp directory that is discarded. The seed printed accurate row counts read back from its own in-memory database, so it *looked* like it worked. Probing all three option combinations directly showed only `d1Persist: <absolute path>` persists, and that Miniflare appends `miniflare-D1DatabaseObject/<hash>.sqlite` — so the path must be `.wrangler/state/v3/d1`, one segment above Miniflare's own default, to resolve to the exact file `wrangler dev --local` opens. Setting `persistTo` alongside it disables D1 persistence entirely.
2. **No local secrets.** The Worker starts without them; the empty string reached WebCrypto at token-signing time and surfaced as an opaque 500 on login. `hmacKey()` now throws an error naming the missing variables and the command that fixes them — with no silent development fallback, since a worker signing tokens with a predictable key is a total authentication bypass. `api/.dev.vars` (gitignored) plus a committed `.dev.vars.example` now make local development work.
3. **`miniflare` was undeclared as a direct dependency** of the script that imports it, so it resolved only transitively through wrangler.

**Result.** **Verified** — after the fix, running the documented sequence and then querying through wrangler's own view of the database returns `users: 1, products: 6, clicks: 427, faqs: 8`. Against the live local Worker: products return `totalItems: 6`; login with the printed demo credentials succeeds and returns `Chinedu Nwankwo <demo@affiliatehub.test>`, tier `pro`; the wallet shows `₦67,500.00` available from the seeded commission; `/go/demoaff01` returns **302** to the product page with `?ref=demoaff01` and the link's click count increments.

> **Why this matters more than the individual bugs.** This was the *only* path a new
> developer would take, and it was broken in three places that each reported success.
> It was found by running the quick start and reading the response bodies, not by any
> test — the backend suite constructs its own Miniflare instance with explicit test
> bindings, so it never exercised the seed script or the local secret path at all.

---

## E. Completed Features

All of the following are **Implemented**; those marked ✓ are also **Verified** by an executed test.

- ✓ Email/password signup and login with field-level validation errors
- ✓ Token refresh with rotation and reuse detection
- ✓ Logout that actually clears the token
- ✓ Onboarding wizard persisting country, niches, WhatsApp
- ✓ Product catalogue with server-side search, category filter, sort and pagination
- ✓ Product detail with real promo assets
- ✓ Affiliate link generation — idempotent per `(user_id, product_id)`, 10-char random code with collision retry
- ✓ Click tracking via `/go/:code` → 302, with salted-hashed visitor IPs and hourly dedupe
- ✓ Wallet summary: available, pending, lifetime, FX-converted secondary balance
- ✓ Transaction history, paginated
- ✓ Withdrawal with atomic debit, idempotency, per-method fees and minimums
- ✓ Payout options served by the API rather than hardcoded in the client
- ✓ Dashboard stats and pseudonymised leaderboard
- ✓ Profile, bank details (encrypted, masked), monthly goal, password change
- ✓ Notifications with mark-all-read
- ✓ FAQs and support tickets
- ✓ Health endpoint
- ✓ Seed CLI producing a working demo database

**34 API routes** (18 GET, 12 POST, 2 PUT, 1 PATCH, 1 DELETE) across **18 D1 tables**.

---

## F. Inferred Features

Implemented because the evidence pointed at them, not because a spec asked:

| Feature | Provenance | Scope |
|---|---|---|
| Click-tracking redirect | FACT (link codes existed with no endpoint to record a click) | REQUIRED |
| Notification persistence | HIGH-CONFIDENCE INFERENCE (a `notifications` table existed) | STRONGLY JUSTIFIED |
| Support tickets | HIGH-CONFIDENCE INFERENCE (contact form existed, submitted nowhere) | STRONGLY JUSTIFIED |
| FX rate table replacing `balance / 450` | INDUSTRY-STANDARD | STRONGLY JUSTIFIED |
| Links management page | REASONABLE ENHANCEMENT (links were created then unreachable) | STRONGLY JUSTIFIED |
| Settings page | REASONABLE ENHANCEMENT (four profile menu items were wired to `onClick={() => {}}`) | STRONGLY JUSTIFIED |
| Wallet reconciliation cron | REASONABLE ENHANCEMENT (D3 makes counters derivable) | STRONGLY JUSTIFIED |

**Not implemented as speculative:** 2FA, email delivery, a merchant conversion webhook,
multi-currency wallets beyond NGN/USD, an admin panel.

---

## G. Design

The existing visual language — dark navy/indigo gradient, violet accents, card-based
mobile-first layout, DM Sans + Plus Jakarta Sans — was coherent and was kept. Rewriting
it would have been churn without benefit.

What changed was correctness and accessibility:

- **Skip link** to `#main-content`; every page provides that target.
- `:focus-visible` rings; `.skip-link` styling.
- `prefers-reduced-motion` honoured.
- Form inputs have real `<label htmlFor>`, `aria-describedby` for errors, and
  `aria-invalid` when failing.
- Buttons are `<button>` with `aria-pressed` where they toggle; icons that decorate are
  `aria-hidden`.
- `safe-area-pb` / `safe-bottom` / `scrollbar-hide` now actually exist.
- Balance privacy toggle carries `aria-pressed` and a real accessible name.
- Loading, empty and error states are distinct components rather than inline conditionals,
  and error states offer a retry **only when a retry could help**.

---

## H. SEO

**Fixed:** real titles and descriptions per route; canonical URLs; Open Graph and
Twitter cards pointing at a real `og-image.png`; JSON-LD for Organization, WebSite,
Breadcrumb and FAQ; a sitemap listing only public pages; `robots.txt` disallowing
authenticated routes and `/api/`; a web app manifest with real icons.

**Verified** by `test/seo.test.tsx` (8 tests), and by an audit of `src/pages/*.tsx`
confirming all **19** pages render a `<Seo>` block and provide the `id="main-content"`
skip-link target.

> **Correction.** This section originally claimed per-route metadata site-wide when only
> 10 of 19 pages had it. The component tests passed because they render `<Seo>` directly
> and never assert that a given *page* uses it — a unit test on a component cannot catch
> a page that forgot to render it. The gap was found by auditing the pages, not by the
> suite. Landing, About, How It Works, Help, Terms, Privacy and NotFound have since been
> given real metadata, and `NotFound` is `noindex` so a 404 shell cannot enter the index.

**Honestly scoped.** Correct metadata and structured data make a page *eligible* to be
understood and indexed. They do not guarantee rankings, traffic, Page 1 placement or
indexing, and nothing here claims otherwise.

---

## I. Security

Summarised; full detail in `SECURITY.md`.

Server-side authorization on every route. PBKDF2-HMAC-SHA256 at 210,000 iterations with
constant-time comparison and a dummy-hash path that equalises timing for unknown emails.
Separate access/refresh secrets, `typ` and `alg` pinned, refresh stored as a SHA-256
hash, rotation with family-wide reuse revocation. Two-layer brute-force protection with
deliberately different failure modes — the Durable Object layer **fails open**, the
durable D1 lockout **cannot**. Bank numbers AES-GCM encrypted and returned masked.
Visitor IPs salted-hashed. Leaderboard pseudonymised. Atomic guarded debit plus
idempotency keys on withdrawals.

**Documented, not hidden:** signup 409 discloses email existence (accepted, D-12); no
2FA; no email delivery; no real payout provider — without provider credentials a
withdrawal stays `pending` with an honest `payout_awaiting_provider_configuration` log
rather than being marked settled.

---

## J. Performance

| Metric | Before | After |
|---|---|---|
| First-load gzip | 157.54 kB | **120.22 kB** (−23.7%) |
| First-load raw | 520.47 kB | 403.20 kB |
| Chunks loaded on first paint | 1 (everything) | 5 |
| Total chunks | 1 | 29 |
| Largest first-paint chunk | 520 kB | 160 kB (`react`) |
| `og-image.png` | — | 102 kB (1200×630) |
| App icons | — | 7.3 kB total (was 744 kB before compression) |

**Verified** by measuring `dist/` after build. Route-level code splitting via
`React.lazy`; vendor splitting for react / react-query / charts / forms; `immutable`
cache headers on hashed assets; KV caching for the public catalogue with a bumpable
version key.

**Not measured here:** Lighthouse / Core Web Vitals. There is no deployed origin in this
environment, and a lab score from a sandbox would be meaningless. Stated rather than
guessed.

---

## K. Database

18 tables across 3 additive migrations: `users`, `refresh_tokens`, `bank_details`,
`payout_destinations`, `products`, `affiliate_links`, `clicks`, `conversions`,
`transactions`, `notifications`, `audit_events`, `fx_rates`, `faqs`, `support_tickets`,
`affiliate_goals`, `failed_logins`, `wallets`, `wallet_reconciliations`.

Design points: UUID string PKs; money as integer minor units; commission in basis
points; `idempotency_key` inlined on `transactions` with a partial unique index;
soft-delete via `deleted_at`; the `transactions` ledger authoritative with wallet
counters as a reconciled cache.

**Migrations are additive only** and were applied to a fresh local database — **Verified**
(`wrangler d1 migrations apply --local` → 3/3 ✅). No migration drops a column or table,
so applying them to a database holding live records preserves it.

There are no `down` migrations, deliberately: a destructive rollback should be a
considered act taken with a backup, not a script run casually.

---

## L. Architecture

```
shared/api-contract.ts   ← imported by BOTH sides; the single source of wire truth
        │
        ├── src/           React 18 + TS + Vite + Tailwind  (Vercel)
        └── api/           Cloudflare Worker, Hono          (Workers)
             ├── routes/   34 routes
             ├── lib/      crypto, auth, rate-limit, payouts, fx, repo, db, …
             ├── jobs.ts   cron work
             └── queue-consumer.ts
```

The shared contract is the load-bearing decision. The prototype typed every API
response `any`, so a backend change could silently break the UI with nothing to catch
it. Now a field renamed on one side is a compile error on the other.

The Worker owns the envelope, CORS, security headers and error mapping; literal route
segments match before parameterised ones; `strict: true` on both sides.

---

## M. Vercel

`vercel.json` ships with: Vite framework, `npm ci` install, `dist` output; an `/api/:path*`
rewrite to the Worker (placeholder URL to be replaced) so the browser stays same-origin;
an SPA fallback that excludes `assets/` and `api/`; `immutable` caching on hashed assets;
and security headers including a CSP with `frame-ancestors 'none'`.

**Not verified** — deploying requires a Vercel project and a real Worker URL. The
configuration is complete and reviewed; the deploy itself is outside this environment.

---

## N. Cloudflare Services Actually Used

| Service | Justification |
|---|---|
| **D1** | Primary store. Relational by necessity — wallets, ledger, links and conversions all reference each other. |
| **KV** | Public catalogue cache: read-heavy, write-rare, staleness-tolerant. Keyed by a bumpable version counter, 120 s / 300 s TTL, `x-cache: HIT\|MISS`. |
| **R2** | Promo artwork and avatars. Zero egress fees matter when affiliates download assets repeatedly. |
| **Durable Object** | Per-IP login/signup rate limiting needs shared mutable state across isolates. |
| **Queue** | Payout settlement, so a slow provider cannot hold an HTTP request open. |
| **Cron Trigger** | `15 3 * * *` — wallet reconciliation, stale-withdrawal expiry (72 h), session pruning. |

**Deliberately not used:** Hyperdrive (no external database), Vectorize (no embeddings),
D1 replicas (single region suffices), Workers AI (no inference). Each was considered and
none had a job to do.

---

## O. Testing

Everything below was **actually executed in this environment**. Nothing is projected.

| Suite | Command | Result |
|---|---|---|
| Backend integration | `npm --prefix api run test` | **60 / 60 passed** |
| Frontend unit + component | `npm run test` | **100 / 100 passed** |
| Frontend typecheck (`strict`) | `npm run typecheck` | exit 0 |
| Backend typecheck (`strict`) | `npm --prefix api run typecheck` | exit 0 |
| Lint | `npm run lint` | **0 errors**, 14 warnings |
| Build | `npm run build` | exit 0 |
| Full pipeline | `npm run verify` | **exit 0** |
| Migrations | `wrangler d1 migrations apply --local` | 3 / 3 ✅ |
| Seed CLI | `tsx scripts/seed.ts --local` | 1 user, 6 products, 1 link, 427 clicks, 1 conversion, 1 transaction, 8 FAQs |
| Seed **persistence** | `wrangler d1 execute --local --command "SELECT COUNT(*)…"` | Same counts read back through wrangler's own view — proves the seed wrote the database the dev server reads, not a private in-memory one |
| Quick start, live | `wrangler dev --local` + curl | products `totalItems: 6`; demo login 200 → `Chinedu Nwankwo`, tier `pro`; wallet `₦67,500.00` available; `/go/demoaff01` → **302** with `?ref=demoaff01` and click count increments |

The backend suite spins up the **real Worker** via Miniflare against the real migrations
— it is not a mock. The frontend suite covers validation rules, money arithmetic, HTTP
error semantics and per-route SEO.

**Bugs the tests found that reasoning did not.** Six were real defects in shipping code,
caught only by execution:

1. `auth.parseSignup` called Zod's `.parse()` directly, so a weak password raised an
   unhandled `ZodError` → **500 instead of a 400** with field messages.
2. `products.getProduct` and `links.recordClick` derived the path segment positionally,
   returning the literal string `'products'` / `'go'` instead of the slug → **404 on
   every product page**.
3. An infinite `notifyUnauthenticated()` recursion introduced by my own find-and-replace,
   which meant **a 401 never signed the user out**.
4. `ApiClientError.retryable` was tested behaviour that had never been implemented —
   error screens would have offered a retry for a 404.
5. A 401 storm: three concurrent queries each tore down session state.
6. `commissionFromBps` rounding, and the seed script's SQL parser silently truncating
   `CREATE TABLE` at the first inline `-- comment`.

**The tests were mutation-checked.** A green suite proves nothing on its own — an
assertion that cannot fail is decoration. Two controls claimed in `SECURITY.md` had code
but no test, so tests were written for them and then deliberately broken to confirm the
tests bite:

| Control or claim | Mutation applied | Result |
|---|---|---|
| Refresh-token family revocation | Reuse-detection branch neutered to return instead of revoking | **2 tests failed** ✓ |
| Visitor-IP hashing | `visitorFingerprint(...)` replaced with the raw `c.reqCtx.ip` | **1 test failed** ✓ |
| Payout never faked as settled | Consumer marks the tx `completed` with no provider configured | **4 tests failed** ✓ |
| Advertised payout minimums | HelpPage's `$50` reverted to the wrong `$10` | **2 tests failed** ✓ |
| Support contact from config | Landing page hardcoded to a different domain | **1 test failed** ✓ |
| WhatsApp deep link from config | `href` pointed at an unconfigured number | **1 test failed** ✓ |
| Guarded routes excluded from crawlers | `Disallow: /products/` dropped | **2 tests failed** ✓ |
| Sitemap origin matches config | Generator default diverged from `config.ts` | **3 tests failed** ✓ |
| Refresh serialisation | `refreshInFlight ??=` changed to `=` | **1 test failed** ✓ |
| Refresh-then-retry | Retry after a successful refresh disabled | **4 tests failed** ✓ |
| No secret file tracked | `backend/.env` re-added to the index with `git add -f` | **1 test failed** ✓ |
| Legacy backend marked vulnerable | `SUPERSEDED` banner stripped from `backend/README.md` | **1 test failed** ✓ |

Every mutated file was restored and verified byte-identical to its pre-mutation state
(`diff` clean, no `MUTATED` markers left in `src/`).

The first two rows are why the backend count went from 46 to 47: the family-revocation and
IP-hashing claims were previously **Implemented but not Verified**, and this report had
already been wrong three times about the difference. The remaining rows were added as each
control was written, because four separate times a test suite passed while asserting
nothing — the vacuous-pass table in the claims section below records all four. That
repetition is the argument for mutation-checking as a standing step rather than a one-off.

**The app was also proven to mount.** Every other frontend test rendered a component in
isolation, and `npm run build` succeeding only means the module graph resolves and the
types line up — not that the tree renders. A missing provider, a hook used outside its
context, or an undefined import all compile and build cleanly, then throw on first paint
in front of a user. `test/render.test.tsx` (8 tests) now renders the landing, wallet,
stats, profile, marketplace and 404 pages inside the real provider stack with `fetch`
stubbed at the network boundary, so the data-loading paths run too. It asserts the
wallet shows the seeded `₦67,500.00` and never the prototype's hardcoded `₦472,500`.

That suite immediately found a real robustness gap: **there was no error boundary**. Any
throw during render propagated to React's root and unmounted the entire tree — a
completely blank page with no way back, which is the worst possible failure mode for a
money app, since the user cannot even see that something failed. `ErrorBoundary` now
wraps the route tree, keeps a recovery UI with retry and home on screen, and re-logs the
error rather than swallowing it. Two tests pin both behaviours.

**Fabricated-claim drift is now a test failure, not a review chore.**
`test/claims.test.tsx` (10 tests) renders every public marketing page and asserts two
things: no unverifiable claim appears, and every advertised payout figure equals the value
in `PAYOUT_CONFIG` that the Worker actually enforces. This exists because the same class of
defect survived three separate review passes — the only defence was a grep sweep someone had
to remember to run.

Writing it found a fourth batch of live fabrications that earlier passes had missed:

| Claim | Where | Reality |
|---|---|---|
| "paid out over ₦50 million" | AboutPage | no payout has ever been made |
| "top affiliates earn ₦500,000+ monthly" | HowItWorksPage | no affiliate earnings exist |
| "marketplace of 500+ products" | HowItWorksPage | the catalogue holds 6 |
| "Link your WhatsApp for instant sale notifications" | HowItWorksPage | no outbound provider exists |
| "$10 for PayPal/USDT withdrawals" | HelpPage | **the Worker enforces $50** |
| "Nigeria's most trusted", "Nigeria's leading", "among the highest in Nigeria" | About/Landing | unverifiable superlatives |

The `$10` was the serious one: unlike the others it was not puffery but a wrong number about
a rule the server owns, so a user following the page would have had their withdrawal
rejected.

The same duplication existed for contact details and produced a second, subtler defect: the
app published **three addresses on two different domains at once** — `support@affiliatehub.ng`
on the landing page, `support@affiliatehub.test` in config, and `privacy@`/`legal@` hardcoded
on the legal pages. A visitor could not tell which address was real, and setting
`VITE_SUPPORT_EMAIL` changed the config without changing what anyone saw. All published
addresses and the WhatsApp deep link now resolve through `src/lib/config.ts`, with
`VITE_PRIVACY_EMAIL` and `VITE_LEGAL_EMAIL` added and documented.

Three bugs in the test itself had to be found by mutation-checking it, and each one made the
suite pass vacuously — including on the exact claim it exists to catch:

| Bug in the test | Effect |
|---|---|
| FAQ answers are conditionally rendered behind a single-select accordion | initial DOM never contained the text being policed |
| the collector fragmented each snapshot and rejoined it with spaces | `"$10 for PayPal"` became `"$ 1 0 for P a y P a l"`, so nothing could match |
| `textContent` concatenates adjacent nodes with no separator | `Support` + `support@x.test` became `supportsupport@x.testwhatsapp` |
| the WhatsApp number lives in an `href` attribute, not in text | the deep-link assertion could never see it |

The harness now walks text nodes to preserve boundaries and scans link attributes separately.
After the fixes, restoring `$10` fails **2** tests, a wrong support domain fails **1**, and a
wrong WhatsApp number fails **1** — each verified by patching the source, running the suite,
and restoring byte-identical.

**The SEO artefacts were generating their own origin.** `Seo.tsx` derives every canonical
from `config.siteUrl` (`VITE_SITE_URL`), but `index.html` hardcoded the origin six times —
canonical, `og:url`, `og:image`, `twitter:image` and two JSON-LD urls — and `sitemap.xml`
and `robots.txt` hardcoded it again. Setting `VITE_SITE_URL` for a real deployment would
have changed the canonicals while the sitemap kept advertising a different host, which is
worse than having no sitemap: it actively sends crawlers somewhere else.

`sitemap.xml` also carried a comment claiming `scripts/generate-sitemap.mjs` set `lastmod`
at build time. **That script did not exist**, and there was no `sitemap` entry in
`package.json` — another claim in the repository that nothing checked.

Fixed at the root rather than by editing five files:

- `scripts/site-config.mjs` holds `DEFAULT_SITE_URL`, `ROUTES` and `DISALLOWED` — the single
  source, side-effect free and shebang-free so `vite.config.ts` can import it.
- `scripts/generate-sitemap.mjs` (now real, and run by `npm run build`) emits
  `sitemap.xml` and `robots.txt` for the configured origin, with `lastmod`.
- `index.html` uses Vite's `%VITE_SITE_URL%` substitution.
- `vite.config.ts` defaults `VITE_SITE_URL` from the same constant when `.env` is absent.

That last one was a build break I introduced and had to fix: `.env` is gitignored, so a
fresh clone has no `VITE_SITE_URL`, Vite left the literal `%VITE_SITE_URL%` in the HTML, and
`%VI` is an invalid percent-escape — Vite's HTML parser threw `URI malformed` and the build
failed. Verified both ways: no `.env` builds and substitutes the default; with
`VITE_SITE_URL=https://demo.example.org` the built `index.html`, `sitemap.xml` and
`robots.txt` all carry that origin.

`test/seo-artifacts.test.ts` (11 tests) parses the real `<Route>` declarations out of
`src/App.tsx` and asserts every guarded route is disallowed, every public route is in the
sitemap, the generator default equals the `config.ts` default, and the committed artefacts
are the generator's output. Writing it reproduced my own regression: my first
`robots.txt` dropped `Disallow: /products/`, and `/products/:slug` sits behind
`ProtectedRoute`, so a crawler would have indexed empty shells. Mutation-checked — dropping
that rule again fails **2** tests, and diverging the generator default fails **3**.

**The `vercel.json` placeholder is now a build failure rather than a broken deploy.**
Vercel does not substitute environment variables in `vercel.json` — only in code — so the
`/api/*` rewrite destination has to be a literal, and it currently reads
`affiliate-hub-api.REPLACE_ME.workers.dev`. Left alone that is undetectable: the build
succeeds, the deploy succeeds, the site renders, and then every API call fails against a
host that does not exist. `scripts/check-deploy.mjs` now runs before the Vercel build
(`build:vercel` is the `buildCommand`) and fails with the file, line and token. The plain
`npm run build` deliberately does *not* run it, so `npm run verify` still works without a
Cloudflare account — a check people have to disable is worse than no check.
`test/deploy-preflight.test.ts` (9 tests) covers both targets, the pass path with real ids
substituted, and that the guard is actually wired into the build command.

**The client token-refresh path was untested.** Access tokens live 15 minutes and refresh
tokens 30 days, so an active user hits the refresh path constantly. A defect there does not
produce an error message — it produces a signed-out user every fifteen minutes with no
indication of why. `test/api.test.tsx` now covers it directly (7 tests): transparent retry
with the rotated token, exactly one refresh for a burst of concurrent 401s, single sign-out
when the refresh token is rejected, network failure during refresh, and no retry loop when
the rotated token is also rejected.

The concurrency case is the dangerous one. Rotating a refresh token is destructive
server-side — the first rotation invalidates the token the other in-flight requests would
send, and the server's reuse detection then revokes the entire family. A dashboard loading
five queries at once would sign the user out. `refreshInFlight` already serialised this
correctly; mutation-checking confirms removing the `??=` fails the test.

**The queue and cron paths are now covered too.** `test/jobs.test.ts` (13 tests) drives
the payout consumer and all four cron jobs against the worker's *real* bindings — `Env`
is assembled from live Miniflare D1/KV/R2/Queue objects, not stand-ins — plus the
`scheduled` and `queue` handlers on the default export. It pins the claims this report
makes about them:

- Without provider credentials a withdrawal **stays `pending`** and logs
  `payout_awaiting_provider_configuration`. Mutation-checked: faking it as `completed`
  fails **4** tests.
- A redelivered settlement does not double-settle or double-notify.
- `reconcileWallets` recomputes a corrupted counter from the ledger (199,999 → 100,000)
  **and** writes a `wallet_reconciliations` row, so drift is recorded rather than
  silently corrected.
- `expireStaleWithdrawals` fails and refunds a withdrawal older than 72 h, and leaves a
  recent one alone.
- `pruneExpiredSessions` deletes tokens past the 7-day cutoff but **keeps** one that
  expired an hour ago — freshly-expired tokens are the evidence reuse detection needs.
- `ensureFxSeed` is idempotent across repeated cron runs.

Writing these corrected two of my own wrong assumptions: withdrawals answer **201**, not
200, and `refresh_tokens` has no `family_id` column — the family chain is expressed
through `replaced_by_id`.

**Not covered:** browser E2E (no Playwright), visual regression, and load testing. The
queue and cron tests invoke the handlers directly rather than through a real Cloudflare
delivery, so batch timing and retry backoff under production conditions remain
unverified. These are named as gaps, not implied as done.

---

## P. Documentation

- `README.md` — rewritten from the Lovable boilerplate; quick start, architecture,
  money model, Cloudflare rationale, security summary.
- `docs/SECURITY.md` — controls that exist, the threat model table, and an explicit
  "What is NOT implemented" section.
- `docs/DEPLOYMENT.md` — step-by-step for both services, with a post-deploy checklist
  and rollback notes.
- `docs/DECISIONS.md` — 20 numbered decisions, each with the rejected alternative and
  provenance/scope tags, plus a list of decisions deliberately *not* made.
- Code comments explain *why*, and call out the traps — the guarded-debit ordering, the
  literal-before-parameterised route order, the `exec()` newline behaviour.

**Superseded:** `MASTER_IMPLEMENTATION_PLAN.md` and `BACKEND_IMPLEMENTATION_PLAN.md`
remain in the tree as historical evidence. They are **not** accurate descriptions of the
system and should not be followed.

---

## Q. Remaining Issues

Stated plainly.

**Requires action before production**
1. `wrangler.toml` carries `REPLACE_WITH_…` placeholders for `database_id` and the
   Durable Object `id`. The Worker will not start without a real DO id.
2. `vercel.json` carries a placeholder Worker URL in the `/api/*` rewrite.
3. All Worker secrets must be set via `wrangler secret`.
4. **Rotate secrets.** `backend/.env` is untracked but still in git history.
5. The seeded demo password (`Demo1234567`) must be changed if the database is reachable
   from anywhere but a developer machine.

**Environment-dependent — cannot be exercised here**
6. Payout settlement needs a real provider; withdrawals stay `pending`.
7. Vercel and Workers deploys were not performed.
8. Live Core Web Vitals were not measured.

**Known gaps, by design**
9. No 2FA, no email delivery, no merchant conversion webhook, no admin panel.
10. 14 lint warnings remain, all `react-refresh/only-export-components` — 11 in shadcn/ui
    vendor files, and 3 in `Seo.tsx`, `AuthContext.tsx` and `AdContext.tsx`, which export a
    hook or constant alongside a component. Cosmetic: it only means Fast Refresh reloads the
    module instead of hot-swapping it. Fixing it means splitting files for no behavioural
    gain, and the two contexts follow the conventional colocated provider + hook shape.

    > **Correction.** This was originally written as "15 warnings, all cosmetic". Checking it
    > rather than repeating it found that 4 of the 15 were in files I wrote, not vendor code,
    > and one of those was a genuine defect: `ContactPage` computed `faqItems` as
    > `faqs.data?.items ?? []`, which allocates a fresh array every render, so the `useMemo`
    > keyed on it recomputed every time and memoised nothing. Fixed with a module-level
    > `EMPTY_FAQS`. The lint output was the only thing that surfaced it — treating the
    > warnings as uniformly cosmetic had hidden a real bug for several passes.
11. No browser E2E or visual regression tests.

**Resolved since the first draft of this report**
12. ~~`bun.lockb` and `package-lock.json` both present~~ — `bun.lockb` removed. Nothing
    referenced Bun, and two lockfiles means two possible dependency trees.
13. ~~Legacy plan documents were inaccurate~~ — both now carry a `SUPERSEDED` banner
    explaining exactly what is wrong with them and pointing at the current docs. They
    are retained rather than deleted because they are the evidence for several findings
    in section C, and deleting evidence makes a report unauditable.

---

## R. Deployment Steps

Full detail in `docs/DEPLOYMENT.md`. Summary:

```bash
# 1. Worker
cd api
npx wrangler d1 create affiliate-hub-db        # paste database_id into wrangler.toml
# set the Durable Object id in wrangler.toml (required — deploy fails without it)
npx wrangler secret put ACCESS_TOKEN_SECRET
npx wrangler secret put REFRESH_TOKEN_SECRET   # must differ from the above
npx wrangler secret put VISITOR_HASH_SALT
npx wrangler secret put FIELD_ENCRYPTION_KEY   # exactly 32 bytes, base64url
npx wrangler d1 migrations apply affiliate-hub-db --remote
npm run deploy

# 2. Vercel
#    Import the repo (Vite / `npm run build` / `dist`), set VITE_SITE_URL,
#    and point the /api/* rewrite in vercel.json at the Worker URL.
```

Then verify: `/api/v1/health` returns 200 with `database: "ok"`; sign up; generate a
link; follow it and confirm the 302 records a click; check the CSP did not break fonts.

---

## Closing note on method

The repository was treated as evidence, not truth. Its own documentation claimed
completion; its own build passed; both were wrong. Almost every serious defect here was
found by **running** something — a `grep` against the built CSS, a migration applied to
a real database, a test that asserted a field existed. Six genuine bugs surfaced only at
execution time, including two of my own.

Where something could not be verified, this report says so rather than implying
otherwise.
