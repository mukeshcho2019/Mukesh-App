/*
# Add accounts table and account_id + status columns to transactions

## Purpose
Support multiple accounts (bank, cash) so user can track per-account balance,
filter dashboard/transactions by account, and see Payable (pending expenses)
and Receivable (pending income) on the dashboard.

## New Tables
- `accounts`
  - `id` (uuid, primary key)
  - `name` (text, not null) — e.g. "HDFC Bank", "Cash Wallet"
  - `type` (text, not null) — 'bank' or 'cash'
  - `icon` (text) — emoji for display
  - `color` (text) — hex color
  - `created_at` (timestamptz)

## Modified Tables
- `transactions` — added:
  - `account_id` (uuid, references accounts, nullable for backward compat)
  - `status` (text, default 'settled') — 'settled' or 'pending'
    - 'pending' + type='expense' = Payable (you owe someone)
    - 'pending' + type='income' = Receivable (someone owes you)

## Security
- RLS enabled on accounts, same anon/authenticated pattern.
- New columns on transactions are covered by existing policies.
*/

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('bank', 'cash')),
  icon text DEFAULT '🏦',
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_accounts" ON accounts;
CREATE POLICY "anon_select_accounts" ON accounts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_accounts" ON accounts;
CREATE POLICY "anon_insert_accounts" ON accounts FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_accounts" ON accounts;
CREATE POLICY "anon_update_accounts" ON accounts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_accounts" ON accounts;
CREATE POLICY "anon_delete_accounts" ON accounts FOR DELETE
  TO anon, authenticated USING (true);

-- Add columns to transactions
DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN status text NOT NULL DEFAULT 'settled' CHECK (status IN ('settled', 'pending'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);

-- Seed default accounts
INSERT INTO accounts (name, type, icon, color) VALUES
  ('Cash', 'cash', '💵', '#f59e0b'),
  ('Bank Account', 'bank', '🏦', '#3b82f6')
ON CONFLICT DO NOTHING;
