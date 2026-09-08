# Deployment

Two services: a Cloudflare Worker (API) and a Vercel app (frontend). No other cloud
platform is involved.

---

## 0. Prerequisites

```bash
npm install -g wrangler
wrangler login                      # browser auth
npm install                         # frontend deps
npm --prefix api install            # worker deps
```

---

## 1. Cloudflare Worker

### 1a. Create the D1 database

```bash
cd api
npx wrangler d1 create affiliate-hub-db
```

The command prints a `database_id`. Paste it into `wrangler.toml`, replacing
`REPLACE_WITH_DATABASE_ID`.

### 1b. Create the Durable Object

```bash
npx wrangler deploy --dry-run --outdir /tmp/do-check   # validates config
```

The RateLimiter Durable Object needs a stable id in `wrangler.toml` under
`[[durable_objects.bindings]]`. On first deploy Cloudflare assigns it; replace
`REPLACE_WITH_DO_ID` with the value from `npx wrangler deployments list` or the deploy
output.

> Deploying without a real DO id will fail at startup. This is the one placeholder you
> cannot leave.

### 1c. Apply migrations remotely

```bash
npx wrangler d1 migrations apply affiliate-hub-db --remote
```

Migrations are **additive only**. `0001_init.sql` creates the schema,
`0002_failed_logins.sql` adds the brute-force lockout table, `0003_wallets.sql` adds the
wallet counters. None drops a column or a table, so applying them to a database with
live records is safe.

To roll back, you write a *new* forward migration. There is no `down` step, because a
down migration that drops a column destroys data that cannot be recovered — that is a
decision to make deliberately with a backup, not a script to run casually.

### 1d. Set secrets

```bash
npx wrangler secret put ACCESS_TOKEN_SECRET       # 32+ random bytes
npx wrangler secret put REFRESH_TOKEN_SECRET      # different from the above
npx wrangler secret put VISITOR_HASH_SALT         # 32+ random bytes
npx wrangler secret put FIELD_ENCRYPTION_KEY      # exactly 32 bytes, base64url
```

Generate them:

```bash
openssl rand -base64 32                                    # token secrets, salt
openssl rand 32 | basenc --base64url | tr -d '=' | head -c 43   # 32-byte key
```

`ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` **must differ**. If they match, a
refresh token becomes a valid access token and the whole rotation scheme is pointless.

Optional:

```bash
npx wrangler secret put PAYOUT_PROVIDER_WEBHOOK
npx wrangler secret put PAYOUT_PROVIDER_SECRET
npx wrangler secret put ALLOWED_ORIGINS     # comma-separated, e.g. https://your.app
```

Without the payout provider secrets, withdrawals are created and left `pending` with a
`payout_awaiting_provider_configuration` log. They are **not** silently marked
settled.

### 1e. Seed (optional, non-production only)

```bash
npm run seed:remote -- --confirm
```

The script refuses to run without `--confirm`, and refuses again if the database
already contains users unless you also pass `--force`. Do not seed a production
database.

### 1f. Deploy

```bash
npm run deploy
```

Note the printed `https://<name>.<subdomain>.workers.dev` URL.

### 1g. Custom domain (recommended)

In the Cloudflare dashboard, attach your own domain (e.g. `api.yourapp.com`) to the
Worker. A `workers.dev` URL works but is shared infrastructure and looks wrong in a
`connect-src` CSP.

---

## 2. Vercel

### 2a. Import the repository

Framework preset **Vite**, build command `npm run build`, output directory `dist`.

### 2b. Point the rewrite at your Worker

`vercel.json` ships with a placeholder:

```json
{ "source": "/api/:path*",
  "destination": "https://affiliate-hub-api.REPLACE_ME.workers.dev/api/:path*" }
```

Replace `REPLACE_ME` with your Worker URL.

Keeping the API behind the same origin means the browser never makes a cross-origin
call — no CORS preflight, no cookie/credential edge cases, and `VITE_API_BASE_URL` can
stay at its `/api/v1` default.

If you would rather call the Worker directly, set `VITE_API_BASE_URL` to its absolute
URL **and** add your Vercel domain to the Worker's `ALLOWED_ORIGINS`.

### 2c. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `VITE_SITE_URL` | **yes** | Your production domain. Drives canonicals, sitemap and OG tags. |
| `VITE_API_BASE_URL` | no | Defaults to `/api/v1`. |
| `VITE_TWITTER_HANDLE` | no | Omit the `twitter:site` tag if blank. |
| `VITE_ADSENSE_CLIENT` | no | Both this and the slot must be set for ads to render. |
| `VITE_ADSENSE_SLOT` | no | |
| `VITE_SUPPORT_EMAIL` | no | Shown on the contact page. |
| `VITE_SUPPORT_WHATSAPP` | no | E.164 digits, no `+`. |

Every `VITE_*` value is compiled into the public bundle. Nothing secret belongs here.

### 2d. Deploy

Push to the production branch. Vercel builds and deploys automatically.

---

## 3. Post-deploy checklist

- [ ] `https://<your-domain>/api/v1/health` returns `200` with `database: "ok"`
- [ ] `https://<your-domain>/robots.txt` serves and references the right sitemap host
- [ ] `https://<your-domain>/sitemap.xml` resolves, and its `<loc>` hosts match
      `VITE_SITE_URL`
- [ ] Sign up a real account, generate a link, and follow it — `/api/v1/go/<code>`
      should 302 and record a click
- [ ] Confirm the CSP in the response headers did not break fonts or the share sheet
- [ ] `wrangler deployments list` shows the expected version
- [ ] Cron is registered: `wrangler triggers list` (or the dashboard Triggers tab)

### Editing sitemap.xml

`public/sitemap.xml` lists hardcoded URLs. If you add a public page, add it there too —
a page absent from the sitemap is still crawlable via links, so this is a nudge to
crawlers, not a gate.

---

## 4. Rollback

**Frontend.** Vercel keeps prior deployments; promote one from the dashboard.

**Worker.** `wrangler rollback` reverts to the previous version. Migrations are not
automatically reverted — see 1c.

**Database.** D1 has point-in-time restore in the dashboard. Take a snapshot before any
manual data change.

---

## 5. Local development

```bash
npm --prefix api run migrate:local
npm --prefix api run seed:local
npm --prefix api run dev        # 127.0.0.1:8787
npm run dev                     # localhost:8080, proxies /api -> :8787
```

Local state lives in `api/.wrangler/state/`, which is gitignored. Delete it for a clean
database, then re-run migrate and seed.
