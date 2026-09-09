-- Migration 0003: materialised wallet balances
--
-- Why this table exists
-- ---------------------
-- The prototype computed the balance as `SELECT SUM(...) FROM transactions`
-- and then inserted the withdrawal in a *separate* statement. Two concurrent
-- requests could both read the same balance and both succeed, overdrawing the
-- account. A read can never be made atomic with a later write this way.
--
-- `wallets.available_minor` is a counter that is only ever moved by a single
-- guarded statement:
--
--   UPDATE wallets SET available_minor = available_minor - ?
--    WHERE user_id = ? AND available_minor >= ?
--
-- SQLite applies that statement atomically, so exactly one of two racing
-- withdrawals sees `changes = 1` and the other sees `changes = 0` and is
-- rejected. That is the fix for the double-spend.
--
-- The `transactions` ledger remains the authoritative history. A nightly cron
-- reconciles the counter against the ledger and alerts on drift, so the
-- optimisation can never silently become the source of truth.

CREATE TABLE IF NOT EXISTS wallets (
  user_id          TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  currency         TEXT NOT NULL DEFAULT 'NGN' CHECK (currency IN ('NGN','USD')),
  -- Spendable now: completed credits minus completed debits.
  available_minor  INTEGER NOT NULL DEFAULT 0,
  -- Commission recorded but not yet approved by the merchant.
  pending_minor    INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_wallets_currency ON wallets (currency);

-- Reconciliation history, so drift is auditable rather than silently patched.
CREATE TABLE IF NOT EXISTS wallet_reconciliations (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  counter_minor     INTEGER NOT NULL,
  ledger_minor      INTEGER NOT NULL,
  delta_minor       INTEGER NOT NULL,
  action_taken      TEXT NOT NULL,
  created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recon_created ON wallet_reconciliations (created_at DESC);
