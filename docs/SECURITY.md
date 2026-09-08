# Security

This document describes the controls that are actually implemented, not an aspiration
list. Where a control is absent or partially implemented, it says so.

---

## 1. Authentication

**Passwords.** PBKDF2-HMAC-SHA256, 210,000 iterations, per-user 16-byte salt, stored as
`pbkdf2$sha256$<iterations>$<salt>$<hash>` so the parameters travel with the hash and
can be raised later without invalidating existing credentials.

`verifyPassword` always performs a derivation. On an unknown email it derives against
a fixed `DUMMY_HASH` before returning, so a login attempt against a non-existent
account takes the same time as one against a real one and cannot be used to enumerate
users. Comparison is constant-time.

**Tokens.** HS256 JWT with `alg` pinned — a token presenting `alg: none` or a swapped
RS/HS algorithm is rejected rather than interpreted. Access and refresh tokens use
**separate secrets** and carry a `typ` claim that is checked, so a refresh token
presented as an access token is refused.

- Access token: 15 minutes.
- Refresh token: 30 days, stored server-side as a **SHA-256 hash only**. The raw value
  is never persisted, so a database leak does not yield usable sessions.

**Rotation with reuse detection.** Every refresh issues a new pair and invalidates the
presented token. If a token that has already been rotated is presented again, the
entire token family is revoked — the signature of a stolen token being replayed after
the legitimate user has moved on.

The prototype used one secret, one token type, and a refresh token identical to the
access token. Any leaked token was permanent.

**Brute force.** Two layers, deliberately different:

1. A Durable Object per-IP sliding window (10 logins/min, 5 signups/hr). Fast, but it
   **fails open** if the DO is unavailable, because locking every user out during an
   infrastructure blip is worse than the risk.
2. A durable D1 `failed_logins` lockout: 5 failures per 15 minutes, keyed by *both*
   email and IP. This one **cannot fail open** — it is the backstop.

Both paths return the identical error message, so a rate limit cannot be used as an
account-existence oracle.

**Known tradeoff.** Signup returns `409` with "An account with that email already
exists", which does disclose registration status. This is bounded by the signup rate
limit and accepted: a signup flow that silently succeeds without creating an account
is a worse user experience. Recorded in `DECISIONS.md` as D-12.

## 2. Authorization

Every route that touches user data calls `requireAuth(c)` server-side. Route guards in
the React app are a UX affordance only — they hide UI, they are not a boundary. There
is no endpoint that trusts a user id from the request body; the identity always comes
from the verified token.

Wallet, link, stats and profile queries are all scoped by the authenticated user's id
in the `WHERE` clause, not filtered after retrieval.

## 3. Money integrity

The critical finding in the prototype was a wallet that could print money: a negative
withdrawal amount increased the balance, and the balance check was a `SELECT` followed
by a separate `UPDATE` with no transaction, so two concurrent requests could both pass
the check and both spend the same funds.

Both are fixed:

- `amountMinor` is validated `.positive()`, so a negative withdrawal is rejected at the
  schema layer.
- The debit is **atomic within a single D1 batch**, using a guarded
  `INSERT … WHERE EXISTS (… available_minor >= ?)` followed by
  `UPDATE … AND available_minor >= ?`, then reading `meta.changes`. If the guard fails,
  nothing is written.

  Note the ordering is deliberate: the INSERT runs first so both conditions evaluate
  against the pre-decrement value. This is not a candidate for simplification back into
  a SELECT — a pre-batch SELECT is *not* inside the transaction and reintroduces the
  TOCTOU window.

- The `transactions` ledger is authoritative. The `wallets` counters are a cache for
  fast reads; a nightly cron reconciles them and records any drift in
  `wallet_reconciliations` rather than silently correcting it.

**Idempotency.** Withdrawals accept an `Idempotency-Key`. Replaying the same key
returns the original result with `deduplicated: true` instead of paying twice. The key
is stored inline on the transaction row with a partial unique index.

## 4. Data protection

- **Bank account numbers** are AES-GCM encrypted (`v1:<iv>:<ciphertext>`, versioned so
  the scheme can rotate) and returned masked (`••••••6789`). Support staff cannot read
  them.
- **Visitor IPs** are salted-SHA-256 hashed before storage and bucketed hourly for
  click de-duplication. The raw IP is never written.
- **Leaderboard** entries are pseudonymised ("Chinedu N."), with the viewer shown as
  "You". The prototype leaked full names and earnings of every affiliate.
- **No secret is ever logged.** Passwords, tokens and the field-encryption key are
  excluded from all log paths.
- Soft-delete via `deleted_at`; records are not hard-deleted.

## 5. Transport and headers

The Worker sets `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
`X-Frame-Options: DENY` and a Content-Security-Policy. CORS is a per-origin allowlist
driven by `ALLOWED_ORIGINS`, not `*`. Request bodies are size-limited.

Vercel sets a matching CSP and `frame-ancestors 'none'` for the frontend, with
`Cache-Control: immutable` on hashed assets.

The prototype ran `cors()` wide open with no rate limit, no helmet and no body limits.

## 6. Secrets

`backend/.env` was committed containing `JWT_SECRET=your-secret-key-here`. It is now
untracked and `.gitignore` covers `.env` / `.env.*` while preserving `.env.example`.

> **Action still required.** The file remains in git history. The correct remediation
> is to **rotate every secret**, not to rewrite history — and in any case the committed
> value was a placeholder, so the real exposure is the *pattern*, not the key.
> The new architecture has no committed secret to rotate: the Worker reads all secrets
> from `wrangler secret`, which never touches the repository.

## 7. What is NOT implemented

Stated plainly, because an unstated gap is how people get hurt:

- **No real payout provider integration.** Without `PAYOUT_PROVIDER_WEBHOOK` and
  `PAYOUT_PROVIDER_SECRET`, a withdrawal is created, debited, and left `pending` with a
  `payout_awaiting_provider_configuration` log. Nothing is marked settled that was not.
- **No email delivery.** Password reset and notifications persist to D1; no SMTP
  provider is wired.
- **No conversion ingestion webhook.** Conversions are created by the seeded data and
  by tests. A merchant-facing signed webhook is the obvious next step.
- **No 2FA.** Not present, not stubbed.
- **AdSense is disabled by default.** Ads render only when both `VITE_ADSENSE_CLIENT`
  and `VITE_ADSENSE_SLOT` are configured. The prototype hardcoded a publisher id, which
  meant every fork served someone else's ads, and showed a full-screen interstitial on
  app open. Both are gone.

## 8. Threat model summary

| Threat | Control | Status |
|---|---|---|
| Credential stuffing | DO throttle + durable lockout | Implemented, tested |
| Token replay after rotation | Reuse detection revokes family | Implemented, tested |
| Wallet double-spend | Atomic guarded debit in one batch | Implemented, tested |
| Duplicate payout on retry | Idempotency key + unique index | Implemented, tested |
| Account enumeration via login | Uniform error + dummy-hash timing | Implemented |
| Account enumeration via signup | **Not mitigated** (accepted, D-12) | Documented |
| PII leak via leaderboard | Pseudonymisation | Implemented, tested |
| Bank number disclosure | AES-GCM + masking | Implemented |
| Secret leakage via git | Untracked + ignored | Implemented; **history still contains it — rotate** |
| SQL injection | Parameterised statements throughout | Implemented |
| LIKE wildcard widening | Escaped in search | Implemented, tested |
