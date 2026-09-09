-- Affiliate Hub — Cloudflare D1 schema
-- Migration 0001: initial schema
--
-- Design rules:
--   * Money is stored as INTEGER minor units (kobo / cents). The original
--     Express prototype used REAL + floating point commission math, which
--     silently drifts. INTEGER is exact.
--   * Commission rates are basis points (4500 = 45%), never floats.
--   * Public identifiers are random UUIDs, not AUTOINCREMENT integers, so
--     object ids cannot be enumerated (the prototype exposed /products/1..N).
--   * All timestamps are ISO-8601 TEXT in UTC.
--   * Foreign keys are declared; `PRAGMA foreign_keys = ON` is enforced by the
--     worker on every connection (D1 defaults it off).
--   * Personal data is soft-deleted (deleted_at) so a forgotten-user request
--     can be honoured without breaking referential history for audit.

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------------
-- Users & authentication
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  -- Format: pbkdf2$sha256$<iterations>$<b64salt>$<b64hash>
  password_hash        TEXT NOT NULL,
  whatsapp             TEXT,
  country              TEXT NOT NULL DEFAULT 'NG',
  referral_code        TEXT NOT NULL,
  tier                 TEXT NOT NULL DEFAULT 'starter'
                       CHECK (tier IN ('starter', 'pro', 'elite')),
  onboarding_completed INTEGER NOT NULL DEFAULT 0,
  niches               TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  avatar_key           TEXT,                          -- R2 object key
  status               TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'suspended', 'deleted')),
  last_login_at        TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  deleted_at           TEXT
);

-- Emails are matched case-insensitively, so store and index them lower-cased.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email
  ON users (email) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON users (referral_code) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at DESC);

-- Rotating refresh tokens. Only the SHA-256 hash of the token is stored, so a
-- database leak does not yield usable sessions.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash     TEXT NOT NULL,
  expires_at     TEXT NOT NULL,
  revoked_at     TEXT,
  replaced_by_id TEXT,
  user_agent     TEXT,
  ip_address     TEXT,
  created_at     TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id, expires_at);

CREATE TABLE IF NOT EXISTS bank_details (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  bank_name      TEXT,
  account_name   TEXT,
  -- Stored encrypted-at-rest by the application layer; only a masked value is
  -- ever returned over the API.
  account_number_enc TEXT,
  account_number_mask TEXT,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_destinations (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method       TEXT NOT NULL CHECK (method IN ('bank', 'paypal', 'usdt')),
  label        TEXT NOT NULL,
  destination  TEXT NOT NULL,
  is_default   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payout_dest_user ON payout_destinations (user_id, method);

-- --------------------------------------------------------------------------
-- Catalogue
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY,
  slug              TEXT NOT NULL,
  title             TEXT NOT NULL,
  summary           TEXT NOT NULL DEFAULT '',
  description       TEXT NOT NULL DEFAULT '',
  category          TEXT NOT NULL
                    CHECK (category IN ('digital','physical','services',
                                        'finance','health','beauty','education')),
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','active','paused','archived')),
  price_minor       INTEGER NOT NULL CHECK (price_minor >= 0),
  currency          TEXT NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN','USD')),
  commission_bps    INTEGER NOT NULL CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  image_url         TEXT,
  gallery           TEXT NOT NULL DEFAULT '[]',   -- JSON array of URLs
  merchant          TEXT NOT NULL DEFAULT '',
  cookie_days       INTEGER NOT NULL DEFAULT 30,
  why_promote       TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  total_promotions  INTEGER NOT NULL DEFAULT 0,
  has_promo_assets  INTEGER NOT NULL DEFAULT 0,
  published_at      TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_slug ON products (slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (status, category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_commission ON products (status, commission_bps DESC);

-- --------------------------------------------------------------------------
-- Affiliate links, clicks, conversions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS affiliate_links (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
-- One link per affiliate per product: prevents link spam and makes
-- "generate link" naturally idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_user_product ON affiliate_links (user_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_links_code ON affiliate_links (code);

CREATE TABLE IF NOT EXISTS clicks (
  id          TEXT PRIMARY KEY,
  link_id     TEXT NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
  -- Salted hash of the visitor IP: enough to dedupe fraud, not enough to
  -- identify a person. Never store the raw IP.
  visitor_hash TEXT NOT NULL,
  user_agent  TEXT,
  country     TEXT,
  referrer    TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clicks_link_time ON clicks (link_id, created_at DESC);
-- Dedupe window: the same visitor hitting the same link within the window
-- counts once.
CREATE UNIQUE INDEX IF NOT EXISTS idx_clicks_dedupe ON clicks (link_id, visitor_hash, created_at);

CREATE TABLE IF NOT EXISTS conversions (
  id               TEXT PRIMARY KEY,
  link_id          TEXT NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
  order_reference  TEXT NOT NULL,
  order_total_minor INTEGER NOT NULL CHECK (order_total_minor >= 0),
  commission_minor INTEGER NOT NULL CHECK (commission_minor >= 0),
  currency         TEXT NOT NULL CHECK (currency IN ('NGN','USD')),
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','approved','rejected','reversed')),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversions_order ON conversions (order_reference);
CREATE INDEX IF NOT EXISTS idx_conversions_link_time ON conversions (link_id, created_at DESC);

-- --------------------------------------------------------------------------
-- Wallet
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('commission','withdrawal','adjustment','refund')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','completed','failed','cancelled')),
  -- Signed: credits positive, debits negative. Balance is a SUM, and holding
  -- the sign here removes the CASE expression that let a negative withdrawal
  -- *increase* a balance in the prototype.
  amount_minor    INTEGER NOT NULL,
  fee_minor       INTEGER NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL CHECK (currency IN ('NGN','USD')),
  description     TEXT NOT NULL DEFAULT '',
  payout_method   TEXT CHECK (payout_method IN ('bank','paypal','usdt')),
  payout_reference TEXT,
  -- Replaying an identical withdrawal request must return the original result
  -- rather than paying out twice.
  idempotency_key TEXT,
  product_id      TEXT REFERENCES products(id) ON DELETE SET NULL,
  conversion_id   TEXT REFERENCES conversions(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tx_user_time ON transactions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_user_status ON transactions (user_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tx_idempotency
  ON transactions (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- --------------------------------------------------------------------------
-- Notifications, audit, content, FX
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL DEFAULT '',
  href        TEXT,
  read_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (user_id, read_at);

CREATE TABLE IF NOT EXISTS audit_events (
  id            TEXT PRIMARY KEY,
  actor_id      TEXT,
  action        TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  metadata      TEXT NOT NULL DEFAULT '{}',  -- JSON
  ip_address    TEXT,
  created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_actor_time ON audit_events (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_events (resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events (created_at);

CREATE TABLE IF NOT EXISTS fx_rates (
  id           TEXT PRIMARY KEY,
  base         TEXT NOT NULL CHECK (base IN ('NGN','USD')),
  quote        TEXT NOT NULL CHECK (quote IN ('NGN','USD')),
  -- rate * 1e6, stored as INTEGER. Replaces the hardcoded "/ 450".
  rate_scaled  INTEGER NOT NULL CHECK (rate_scaled > 0),
  as_of        TEXT NOT NULL,
  source       TEXT NOT NULL,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_fx_pair_time ON fx_rates (base, quote, as_of DESC);

CREATE TABLE IF NOT EXISTS faqs (
  id         TEXT PRIMARY KEY,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'general',
  position   INTEGER NOT NULL DEFAULT 0,
  published  INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_faqs_category ON faqs (category, position);

CREATE TABLE IF NOT EXISTS support_tickets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject      TEXT NOT NULL,
  message      TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general',
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  ip_address   TEXT,
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON support_tickets (status, created_at DESC);

-- Goals let the dashboard render a real progress bar instead of the hardcoded
-- "₦472,500 / ₦500,000" from the prototype.
CREATE TABLE IF NOT EXISTS affiliate_goals (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  target_minor   INTEGER NOT NULL CHECK (target_minor > 0),
  currency       TEXT NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN','USD')),
  period         TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('weekly','monthly','yearly')),
  updated_at     TEXT NOT NULL
);
