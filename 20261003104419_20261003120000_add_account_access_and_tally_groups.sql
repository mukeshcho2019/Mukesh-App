/*
# Add account sharing and Tally ledger groups

1. Purpose
- Allow the workspace owner to share one selected accounting account with another signed-in user.
- Keep account sharing scoped to the selected account instead of exposing the owner's full workspace.
- Add Tally-style ledger groups and Journal vouchers without deleting existing rows.

2. New tables
- `account_members`
  - `account_id` identifies the shared accounting account.
  - `user_id` identifies the signed-in member.
  - `access_level` is currently `read` or `edit`; the first release grants read access by default.
- `account_access_codes`
  - `account_id` identifies the account that can be shared.
  - `code` is a one-use bearer code created by the account owner.
  - `used_by` and `used_at` record the member who claimed it.
  - `expires_at` limits the code lifetime.

3. Modified tables
- `ledgers.ledger_group` categorizes ledgers as income, expense, loan, vendor, customer, asset, bank, cash, investment, or other.
- `transactions.voucher_type` now also accepts `journal`.
- Existing ledger types and existing voucher rows are preserved.

4. Security
- Account members can read only the account row and account-linked ledgers and transactions they were granted.
- Only account owners can create or revoke members and access codes.
- A signed-in user can atomically claim a valid access code exactly once.
- Anonymous users have no access to any new table or function.
- Existing owner-only write policies remain owner-only; sharing does not grant edit rights to the database.

5. Important notes
- No accounting rows are deleted, renamed, or retyped.
- The legacy workspace claim becomes a no-op for later users so invited users can sign in and claim a shared account.
*/

CREATE TABLE IF NOT EXISTS account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'read' CHECK (access_level IN ('read', 'edit')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

CREATE TABLE IF NOT EXISTS account_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS ledger_group text NOT NULL DEFAULT 'other';
UPDATE ledgers SET ledger_group = CASE
  WHEN type = 'bank' THEN 'bank'
  WHEN type = 'cash' THEN 'cash'
  WHEN type = 'investment' THEN 'investment'
  ELSE 'other'
END
WHERE ledger_group = 'other';
ALTER TABLE ledgers DROP CONSTRAINT IF EXISTS ledgers_ledger_group_check;
ALTER TABLE ledgers ADD CONSTRAINT ledgers_ledger_group_check CHECK (ledger_group IN ('income', 'expense', 'loan', 'vendor', 'customer', 'asset', 'bank', 'cash', 'investment', 'other'));

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_voucher_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_voucher_type_check CHECK (voucher_type = ANY (ARRAY['expense'::text, 'income'::text, 'payment'::text, 'receipt'::text, 'transfer'::text, 'journal'::text]));

ALTER TABLE account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_access_codes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON account_members, account_access_codes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON account_members, account_access_codes TO authenticated;

DROP POLICY IF EXISTS "members_read_own_or_owned_accounts" ON account_members;
CREATE POLICY "members_read_own_or_owned_accounts" ON account_members FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_members.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_add_account_members" ON account_members;
CREATE POLICY "owners_add_account_members" ON account_members FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_members.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_update_account_members" ON account_members;
CREATE POLICY "owners_update_account_members" ON account_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_members.account_id AND accounts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_members.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_or_members_delete_account_members" ON account_members;
CREATE POLICY "owners_or_members_delete_account_members" ON account_members FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_members.account_id AND accounts.user_id = auth.uid())
);

DROP POLICY IF EXISTS "owners_read_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_read_account_access_codes" ON account_access_codes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_access_codes.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_create_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_create_account_access_codes" ON account_access_codes FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_access_codes.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_update_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_update_account_access_codes" ON account_access_codes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_access_codes.account_id AND accounts.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_access_codes.account_id AND accounts.user_id = auth.uid())
);
DROP POLICY IF EXISTS "owners_delete_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_delete_account_access_codes" ON account_access_codes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_access_codes.account_id AND accounts.user_id = auth.uid())
);

DROP POLICY IF EXISTS "authenticated_select_own_or_shared_accounts" ON accounts;
CREATE POLICY "authenticated_select_own_or_shared_accounts" ON accounts FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = accounts.id AND account_members.user_id = auth.uid())
);
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_select_own_or_shared_ledgers" ON ledgers FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = ledgers.account_id AND account_members.user_id = auth.uid())
);
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_transactions" ON transactions;
CREATE POLICY "authenticated_select_own_or_shared_transactions" ON transactions FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (SELECT 1 FROM account_members WHERE account_members.account_id = transactions.account_id AND account_members.user_id = auth.uid())
);

CREATE OR REPLACE FUNCTION claim_legacy_workspace()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  current_owner uuid;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT owner_id INTO current_owner FROM app_owner_claim WHERE id = true FOR UPDATE;
  IF current_owner IS NOT NULL AND current_owner <> caller_id THEN RETURN; END IF;
  IF current_owner IS NULL THEN
    UPDATE app_owner_claim SET owner_id = caller_id, claimed_at = now() WHERE id = true;
    UPDATE categories SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE accounts SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE ledgers SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE transactions SET user_id = caller_id WHERE user_id IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION claim_account_access(p_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_id uuid := auth.uid();
  access_id uuid;
  target_account uuid;
BEGIN
  IF caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id, account_id INTO access_id, target_account
  FROM account_access_codes
  WHERE code = trim(p_code) AND used_by IS NULL AND expires_at > now()
  FOR UPDATE;
  IF access_id IS NULL THEN RAISE EXCEPTION 'Access code is invalid or expired'; END IF;
  INSERT INTO account_members(account_id, user_id, access_level)
  VALUES (target_account, caller_id, 'read')
  ON CONFLICT (account_id, user_id) DO NOTHING;
  UPDATE account_access_codes SET used_by = caller_id, used_at = now() WHERE id = access_id;
  RETURN target_account;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_account_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_account_access(text) TO authenticated;
CREATE INDEX IF NOT EXISTS idx_account_members_user_id ON account_members(user_id);
CREATE INDEX IF NOT EXISTS idx_account_members_account_id ON account_members(account_id);
CREATE INDEX IF NOT EXISTS idx_account_access_codes_account_id ON account_access_codes(account_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_ledger_group ON ledgers(ledger_group);
