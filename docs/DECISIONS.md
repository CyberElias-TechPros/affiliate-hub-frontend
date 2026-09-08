# Decision Ledger

Every consequential choice, with the reasoning and the alternative that was rejected.

Provenance tags used throughout:
- **FACT** — read directly from the repository.
- **HIGH-CONFIDENCE INFERENCE** — strongly implied by the evidence.
- **INDUSTRY-STANDARD** — what any competent implementation of this does.
- **REASONABLE ENHANCEMENT** — a judgement call that improves the product.
- **SPECULATIVE** — a guess. Not implemented.

Scope tags: **REQUIRED**, **STRONGLY JUSTIFIED**, **OPTIONAL**, **SPECULATIVE**.
Only the first two were auto-implemented.

---

## D-1. Vercel + Cloudflare Workers, not another platform
**Scope:** REQUIRED · **Provenance:** FACT

The brief mandates this stack. The repo's `BACKEND_IMPLEMENTATION_PLAN.md` specifies
Express + Postgres + Redis + Kubernetes; that document was treated as an **endpoint
specification only**, not an architecture. Its feature list was honoured; its stack was
discarded.

**Rejected:** keeping the Express monolith. It cannot run on Workers, and `backend/index.js`
uses `fs`, `sqlite3` and Node's HTTP server directly.

## D-2. Integer minor units for all money
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

Naira and cents are both 2-decimal currencies. Storing `472500.00` as a float invites
`0.1 + 0.2 !== 0.3` in a ledger. All money is an integer count of kobo/cents; rates are
basis points (`4500` = 45%).

**Rejected:** `REAL` columns. SQLite has no `DECIMAL`, so a decimal type would be a
string with hand-rolled arithmetic — more code, more risk.

## D-3. The ledger is authoritative; wallet counters are a cache
**Scope:** STRONGLY JUSTIFIED · **Provenance:** REASONABLE ENHANCEMENT

`available_minor` is derivable from `SUM(amount_minor) WHERE status='completed'`. Keeping
it as a column makes wallet reads one query instead of a scan, but it can drift.

So: a nightly cron recomputes from the ledger and writes any discrepancy to
`wallet_reconciliations` **without silently correcting it**. A silent fix hides the bug
that caused the drift.

## D-4. Atomic guarded debit, not SELECT-then-UPDATE
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

`D1.batch()` is one transaction, but a SELECT issued *before* the batch is not inside it.
The working pattern is `INSERT … WHERE EXISTS(… available_minor >= ?)` then
`UPDATE … AND available_minor >= ?` in the same batch, then read `meta.changes`.

The INSERT comes first so both conditions see the pre-decrement value. **This must not be
simplified back into a SELECT** — that reintroduces the TOCTOU double-spend.

## D-5. PBKDF2 at 210,000 iterations, not bcrypt or plain SHA-256
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

Workers has no native bcrypt. `crypto.subtle` provides PBKDF2-HMAC-SHA256, which is an
OWASP-recommended KDF. Parameters are embedded in the stored hash
(`pbkdf2$sha256$<iter>$<salt>$<hash>`) so the cost can be raised later without
invalidating existing credentials.

## D-6. Separate access and refresh secrets, with `typ` checked
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

The prototype used one secret and one token type, with refresh == access. Any leaked
token was permanent and omnipotent. Now: two secrets, `typ` claim, `alg` pinned to HS256.

## D-7. Refresh tokens stored as SHA-256 hashes
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

A database dump must not yield usable sessions. The hash is indexed and unique, so
lookup stays O(1).

## D-8. Two-layer brute-force protection with different failure modes
**Scope:** STRONGLY JUSTIFIED · **Provenance:** REASONABLE ENHANCEMENT

- Durable Object per-IP sliding window — fast, **fails open** deliberately. Locking every
  user out because a DO is unavailable is a worse outcome than the residual risk.
- D1 `failed_logins` lockout (5/15min, keyed by email *and* IP) — **cannot fail open**.
  This is the backstop.

Both return the identical error message.

## D-9. Idempotency keys on withdrawals
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

Mobile users double-tap. Without a key, a double-tap is two payouts. The key is stored
inline on the transaction with a partial unique index, so dedupe is enforced by the
database rather than by application logic that can race.

## D-10. Pseudonymised leaderboard
**Scope:** REQUIRED · **Provenance:** FACT (privacy leak in the prototype)

Full names and earnings of every affiliate were exposed to every other affiliate. Now
"Chinedu N.", with the viewer shown as "You".

## D-11. Bank numbers encrypted at rest, returned masked
**Scope:** REQUIRED · **Provenance:** INDUSTRY-STANDARD

AES-GCM, `v1:<iv>:<ciphertext>`. Versioned so the scheme can rotate without a migration.
Support staff cannot read full numbers — that is the point.

## D-12. Signup 409 discloses email existence — ACCEPTED
**Scope:** OPTIONAL · **Provenance:** REASONABLE ENHANCEMENT (declined)

Returning a generic "if that email is free we'll create it" avoids the oracle but creates
a flow that appears to succeed while doing nothing — users then wait for a password email
that never comes.

The oracle is bounded by the signup rate limit (5/hr/IP). Accepted tradeoff, recorded
here rather than left implicit.

## D-13. No fake payout provider
**Scope:** REQUIRED · **Provenance:** FACT (the brief forbids fake completion)

Without provider credentials, a withdrawal is created, debited, and left `pending` with a
`payout_awaiting_provider_configuration` log. Nothing is marked settled that was not.

**Rejected:** a simulated provider that marks payouts `completed` after a timer. That is
exactly the class of fake the prototype was full of.

## D-14. KV cache keyed by a bumpable version counter
**Scope:** STRONGLY JUSTIFIED · **Provenance:** REASONABLE ENHANCEMENT

Catalogue reads are hot and staleness-tolerant. Keys are `products:<v>:…`, so publishing
a product bumps `<v>` and every stale entry is orphaned instantly.

**Earlier attempt, abandoned:** a documented invalidation that deleted specific keys. It
never worked — the key omitted the version counter, so the delete missed. Discovered by
reading the code against its own docblock.

## D-15. Rate limiting via Durable Object, not KV
**Scope:** STRONGLY JUSTIFIED · **Provenance:** INDUSTRY-STANDARD

A sliding window needs read-modify-write with atomicity. KV is eventually consistent and
would under-count under exactly the burst conditions rate limiting exists for.

## D-16. Cron for reconciliation, not on-read repair
**Scope:** STRONGLY JUSTIFIED · **Provenance:** REASONABLE ENHANCEMENT

Reconciling on read would put a full ledger scan in the path of every wallet page view.
A nightly cron (`15 3 * * *`) also handles stale-withdrawal expiry (72h) and expired
session pruning.

## D-17. `strict: true` on both sides
**Scope:** REQUIRED · **Provenance:** FACT (frontend shipped `strict: false`)

This is what allowed `any` through the entire API layer. Turning it on surfaced real
bugs immediately — including four test assertions that read fields never verified to
exist.

## D-18. Relative API base URL by default
**Scope:** STRONGLY JUSTIFIED · **Provenance:** REASONABLE ENHANCEMENT

`/api/v1` means dev proxies to the Worker and production rewrites on the same origin.
The browser never makes a cross-origin call, so there is no CORS preflight and no
hardcoded `localhost` leaking into a bundle.

## D-19. AdSense off unless explicitly configured
**Scope:** REQUIRED · **Provenance:** FACT

The prototype hardcoded `ca-pub-9117572925263537` in `index.html`, used one slot id for
every placement, and fired a full-screen interstitial on app open. Every fork served
someone else's ads. Now env-gated, with no interstitial and no refresh timer.

## D-20. Marketing copy de-fabricated
**Scope:** REQUIRED · **Provenance:** FACT

The landing page claimed "₦50M+ paid", "15,000+ affiliates", "500+ products", "98%
on-time payouts" and carried named testimonials for people who do not exist. These are
verifiable claims about a product that has never processed a payout. Removed.

**Note:** no claim in this repo promises search rankings, traffic, Page 1 placement or
indexing. None should be added.

---

## Decisions deliberately NOT made

- **No 2FA.** Not implemented, not stubbed. Adding a half-wired 2FA flow is worse than
  none.
- **No email provider.** Notifications persist; nothing is sent.
- **No merchant conversion webhook.** The obvious next feature, but its signing scheme
  is a business decision (who may post conversions, and on what authority).
- **No `down` migrations.** A destructive rollback should be a deliberate act with a
  backup, not a script.
- **No new features to make the project look larger.** The brief is explicit.
