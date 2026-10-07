/*
# Add account_id to ledgers table

1. Changes
- Add `account_id` column (uuid, nullable) to `ledgers` table.
- Add foreign key constraint referencing `accounts(id)`.
- Backfill: assign ALL existing ledgers to Mukesh Choudhary's account (b82cfab5-54e9-4b04-9f4e-1885508f4fc4)
  since all current data belongs to Mukesh.
- Add index on account_id for faster filtering.
2. Security
- No RLS policy changes (existing policies remain unchanged).
3. Notes
- account_id is nullable so new ledgers can optionally specify an account.
- Existing ledgers are assigned to Mukesh Choudhary automatically.
*/

ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ledgers_account_id ON ledgers(account_id);

UPDATE ledgers SET account_id = 'b82cfab5-54e9-4b04-9f4e-1885508f4fc4' WHERE account_id IS NULL;
