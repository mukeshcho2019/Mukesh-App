/*
# Add ledgers table and voucher_type column to transactions

## Purpose
Make the app work like Tally — user can create ledgers (parties/people),
record Payment (money given) and Receipt (money received) against a ledger,
and view each ledger's running balance. Investments can also be tracked
as ledger entries.

## New Tables
- `ledgers`
  - `id` (uuid, primary key)
  - `name` (text, not null) — e.g. "Ramesh", "HDFC Bank", "Mutual Fund"
  - `type` (text, not null) — 'party' (person/entity), 'bank', 'cash', 'investment'
  - `opening_balance` (numeric, default 0) — starting balance for this ledger
  - `icon` (text) — emoji for display
  - `color` (text) — hex color
  - `created_at` (timestamptz)

## Modified Tables
- `transactions` — added:
  - `voucher_type` (text, default 'expense') — 'expense', 'income', 'payment', 'receipt'
    - 'payment' = money given to a party (reduces cash/bank, increases what they owe back or reduces what we owe)
    - 'receipt' = money received from a party (increases cash/bank, reduces what they owe or increases what we owe)
  - `ledger_id` (uuid, references ledgers, nullable) — which ledger/party this transaction is linked to

## Security
- RLS enabled on ledgers, same anon/authenticated pattern as existing tables.
- New columns on transactions are covered by existing policies.
*/

-- Ledgers table
CREATE TABLE IF NOT EXISTS ledgers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'party' CHECK (type IN ('party', 'bank', 'cash', 'investment')),
  opening_balance numeric(12,2) NOT NULL DEFAULT 0,
  icon text DEFAULT '👤',
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ledgers" ON ledgers;
CREATE POLICY "anon_select_ledgers" ON ledgers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ledgers" ON ledgers;
CREATE POLICY "anon_insert_ledgers" ON ledgers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ledgers" ON ledgers;
CREATE POLICY "anon_update_ledgers" ON ledgers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ledgers" ON ledgers;
CREATE POLICY "anon_delete_ledgers" ON ledgers FOR DELETE
  TO anon, authenticated USING (true);

-- Add voucher_type and ledger_id to transactions
DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN voucher_type text NOT NULL DEFAULT 'expense' CHECK (voucher_type IN ('expense', 'income', 'payment', 'receipt'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE transactions ADD COLUMN ledger_id uuid REFERENCES ledgers(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_voucher_type ON transactions(voucher_type);
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_id ON transactions(ledger_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_type ON ledgers(type);
