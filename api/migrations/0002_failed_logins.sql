-- Migration 0002: durable failed-login counters
--
-- Brute-force protection needs a counter that cannot "fail open". The
-- rate-limiter Durable Object is allowed to degrade to fail-open so a DO
-- hiccup never takes the site down; credential throttling therefore lives
-- here in D1 instead.
--
-- Rows are self-pruning: `pruneFailedLogins()` deletes anything older than the
-- window on every write, and the nightly cron sweeps stragglers.

CREATE TABLE IF NOT EXISTS failed_logins (
  id          TEXT PRIMARY KEY,
  -- Either "email:<lowercased email>" or "ip:<client ip>".
  bucket_key  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_failed_logins_bucket ON failed_logins (bucket_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_failed_logins_created ON failed_logins (created_at);
