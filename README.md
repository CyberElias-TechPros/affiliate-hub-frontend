# Affiliate Hub

An affiliate marketing marketplace for Nigerian creators. Affiliates browse merchant
products, generate tracked links, share them (WhatsApp first), and withdraw their
commission to a Nigerian bank account, PayPal, or USDT.

**Frontend:** React 18 + TypeScript + Vite + Tailwind, deployed to Vercel.
**API:** Cloudflare Worker (Hono) with D1, KV, R2, a Durable Object, a Queue and a Cron Trigger.

---

## Quick start

```bash
npm install                 # frontend
npm --prefix api install    # API

# 1. Local secrets. wrangler dev reads api/.dev.vars automatically.
cp api/.dev.vars.example api/.dev.vars   # then fill in the four values

# 2. Start the Worker with a local D1 database
npm --prefix api run migrate:local
npm --prefix api run seed:local     # demo data + credentials
npm --prefix api run dev            # http://127.0.0.1:8787

# 3. In a second terminal, start the frontend
npm run dev                         # http://localhost:8080
```

The four values in `.dev.vars` are `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`
(which **must** differ), `VISITOR_HASH_SALT` and `FIELD_ENCRYPTION_KEY`. Generate them
with `openssl rand -base64 32`. Without them the Worker starts but login fails with a
configuration error naming the missing variable.

Vite proxies `/api` to the Worker, so the browser only ever talks to one origin and
there is no CORS setup to get wrong.

> Seed **before** starting `wrangler dev`. Both open the same SQLite file, and seeding
> while the dev server holds it will not stick.

**Seeded demo login** (printed by the seed script):

```
email:    demo@affiliatehub.test
password: Demo1234567
```

Change this before the database is reachable from anywhere but your machine.

### Verify everything

```bash
npm run verify     # lint + typecheck + frontend tests + build
npm run test:api   # backend integration tests (spins up the real Worker)
```

---

## Architecture

```
affiliate-hub-frontend/
├── src/                  React app
│   ├── components/       UI (shadcn/ui + custom), layout, routing, seo
│   ├── contexts/         AuthContext (session), AdContext (ad gating)
│   ├── hooks/
│   ├── lib/              api client, config, validation
│   └── pages/
├── shared/
│   └── api-contract.ts   The wire contract. Imported by BOTH sides.
├── api/                  Cloudflare Worker
│   ├── migrations/       D1 schema (applied in order, additive only)
│   ├── src/
│   │   ├── routes/       auth, products, wallet, links, stats, profile, …
│   │   ├── lib/          crypto, auth, rate-limit, payouts, fx, repo, …
│   │   ├── jobs.ts       cron work
│   │   └── queue-consumer.ts
│   ├── scripts/seed.ts   Seed CLI
│   └── test/             46 integration tests against the real Worker
└── docs/                 ADRs, decision ledger, security notes
```

### The shared contract is the important bit

`shared/api-contract.ts` defines every request, response, enum and money type once.
The frontend imports it as `@shared/api-contract`; the Worker imports it by relative
path. A field renamed on one side is a compile error on the other, which is the whole
point — the prototype's client typed every response `any`, so a backend change could
silently break the UI with nothing to catch it.

### Money

**All money is integer minor units** (kobo, cents). Commission rates are **basis
points** (`4500` = 45%). Floats never touch the ledger: `toMinor`, `toMajor`,
`formatMoney` and `commissionFromBps` are the only places conversion happens, and they
are shared so both sides round identically.

---

## Cloudflare services

Each one is here because something specifically needed it, not because it was
available:

| Service | Why |
|---|---|
| **D1** | Primary store. Relational — wallets, ledger, links, conversions all reference each other. |
| **KV** | Cache for the public product catalogue. Read-heavy, write-rare, staleness-tolerant. |
| **R2** | Promo artwork and avatars. No egress fees matters when affiliates download assets repeatedly. |
| **Durable Object** | Per-IP login/signup rate limiting needs shared mutable state across isolates. |
| **Queue** | Payout settlement, so a slow provider can't hold an HTTP request open. |
| **Cron Trigger** | Nightly wallet reconciliation, stale-withdrawal expiry, session pruning. |

Deliberately **not** used: Hyperdrive, Vectorize, D1 replicas, AI — nothing in this
product needs them.

---

## Environment

Copy `.env.example` to `.env.local`. Every `VITE_*` value is compiled into the client
bundle and is therefore public — never put a secret there.

The Worker's secrets are set separately and are **never** committed:

```bash
cd api
npx wrangler secret put ACCESS_TOKEN_SECRET
npx wrangler secret put REFRESH_TOKEN_SECRET
npx wrangler secret put VISITOR_HASH_SALT
npx wrangler secret put FIELD_ENCRYPTION_KEY   # 32 bytes, base64url
```

Without `PAYOUT_PROVIDER_WEBHOOK` / `PAYOUT_PROVIDER_SECRET`, withdrawals are created
and left `pending` with an honest `payout_awaiting_provider_configuration` log rather
than being marked as settled. **There is no fake provider integration.**

---

## Deployment

1. **Worker** — fill in `database_id` and the Durable Object `id` in
   `api/wrangler.toml` (both are `REPLACE_WITH_…` placeholders), create the D1
   database, apply migrations remotely, set the secrets, then `npm --prefix api run deploy`.
2. **Vercel** — import the repo, set `VITE_SITE_URL` to your real domain, and point the
   `/api/*` rewrite in `vercel.json` at your Worker URL.

Full walkthrough in `docs/DEPLOYMENT.md`.

---

## Security

Server-side authorization on every route; no client-side-only guards. PBKDF2-HMAC-SHA256
at 210,000 iterations with constant-time comparison. Separate access and refresh
secrets with `typ` and `alg` pinned; refresh tokens stored as SHA-256 hashes and
rotated with reuse detection that revokes the whole family. Bank account numbers
encrypted at rest and returned masked. Visitor IPs salted-hashed before storage.

Withdrawals use an atomic guarded debit inside a single D1 batch, so a double submit
cannot double-spend — and an idempotency key means a retry is deduplicated rather than
paid twice.

Details and threat model in `docs/SECURITY.md`.

---

## Status

See `docs/FINAL_REPORT.md` for what was found, what was fixed, what was verified by
running it, and what remains open. That document distinguishes **Implemented** from
**Verified** from **Environment-dependent** from **Not verified** — the difference
matters and the report does not blur it.
