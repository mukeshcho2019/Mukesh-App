/*
# Add from_ledger_id to transactions

1. Changes
- Add `from_ledger_id` column to `transactions` table (nullable uuid).
  This references a bank/cash ledger from which money is debited or credited.
  Replaces the old `payment_method` approach — instead of tagging "cash" or "bank",
  each transaction now picks a specific bank or cash ledger to move money from/to.
- Add foreign key constraint to `ledgers` table.
2. Security
- No RLS policy changes (existing policies already allow anon/authenticated CRUD).
3. Notes
- `from_ledger_id` is nullable for backward compat with existing rows.
- The frontend will set this for all new entries.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'from_ledger_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN from_ledger_id uuid REFERENCES ledgers(id) ON DELETE SET NULL;
  END IF;
END $$;
