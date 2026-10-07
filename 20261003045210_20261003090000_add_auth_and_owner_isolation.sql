/*
# Add authenticated owner isolation

1. Purpose
- Protect the existing private accounting workspace behind Supabase email/password authentication.
- Preserve all existing rows while assigning them to the first authenticated owner who claims the legacy workspace.

2. New columns
- `categories.user_id` — authenticated owner of the category.
- `accounts.user_id` — authenticated owner of the account.
- `ledgers.user_id` — authenticated owner of the ledger.
- `transactions.user_id` — authenticated owner of the transaction.
- Existing rows remain temporarily nullable until the first signed-in owner runs the legacy claim function.

3. New table
- `app_owner_claim` — one-row, server-controlled record that prevents a second account from claiming the legacy workspace.

4. Security changes
- Anonymous table access is revoked.
- Authenticated CRUD policies now require `auth.uid()` to match `user_id`.
- Transaction writes also require referenced categories, accounts, and ledgers to belong to the same authenticated user.
- The legacy claim function is SECURITY DEFINER, checks the caller session, is callable only by authenticated users, and can run only once for the workspace owner.

5. Important notes
- No accounting rows are deleted or renamed.
- New rows receive their owner automatically from `auth.uid()`.
- The frontend must provide sign-in/sign-up before these policies are enabled for normal use.
*/

ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ledgers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE categories ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE accounts ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE ledgers ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE transactions ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS app_owner_claim (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  owner_id uuid REFERENCES auth.users(id) ON DELETE RESTRICT,
  claimed_at timestamptz
);

INSERT INTO app_owner_claim (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_owner_claim ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_owner_claim FROM anon, authenticated;

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
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner_id INTO current_owner
  FROM app_owner_claim
  WHERE id = true
  FOR UPDATE;

  IF current_owner IS NOT NULL AND current_owner <> caller_id THEN
    RAISE EXCEPTION 'Workspace already claimed';
  END IF;

  IF current_owner IS NULL THEN
    UPDATE app_owner_claim
    SET owner_id = caller_id, claimed_at = now()
    WHERE id = true;

    UPDATE categories SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE accounts SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE ledgers SET user_id = caller_id WHERE user_id IS NULL;
    UPDATE transactions SET user_id = caller_id WHERE user_id IS NULL;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_legacy_workspace() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION claim_legacy_workspace() TO authenticated;

REVOKE ALL ON categories, accounts, ledgers, transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories, accounts, ledgers, transactions TO authenticated;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "authenticated_select_own_categories" ON categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "authenticated_insert_own_categories" ON categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "authenticated_update_own_categories" ON categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "authenticated_delete_own_categories" ON categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_accounts" ON accounts;
DROP POLICY IF EXISTS "anon_insert_accounts" ON accounts;
DROP POLICY IF EXISTS "anon_update_accounts" ON accounts;
DROP POLICY IF EXISTS "anon_delete_accounts" ON accounts;
CREATE POLICY "authenticated_select_own_accounts" ON accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "authenticated_insert_own_accounts" ON accounts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "authenticated_update_own_accounts" ON accounts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "authenticated_delete_own_accounts" ON accounts FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_ledgers" ON ledgers;
DROP POLICY IF EXISTS "anon_insert_ledgers" ON ledgers;
DROP POLICY IF EXISTS "anon_update_ledgers" ON ledgers;
DROP POLICY IF EXISTS "anon_delete_ledgers" ON ledgers;
CREATE POLICY "authenticated_select_own_ledgers" ON ledgers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "authenticated_insert_own_ledgers" ON ledgers FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND (account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = ledgers.account_id AND accounts.user_id = auth.uid()))
);
CREATE POLICY "authenticated_update_own_ledgers" ON ledgers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (
  auth.uid() = user_id
  AND (account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = ledgers.account_id AND accounts.user_id = auth.uid()))
);
CREATE POLICY "authenticated_delete_own_ledgers" ON ledgers FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "authenticated_select_own_transactions" ON transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "authenticated_insert_own_transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = user_id
  AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id AND categories.user_id = auth.uid()))
  AND (account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()))
  AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id AND ledgers.user_id = auth.uid()))
  AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id AND ledgers.user_id = auth.uid()))
);
CREATE POLICY "authenticated_update_own_transactions" ON transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (
  auth.uid() = user_id
  AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id AND categories.user_id = auth.uid()))
  AND (account_id IS NULL OR EXISTS (SELECT 1 FROM accounts WHERE accounts.id = transactions.account_id AND accounts.user_id = auth.uid()))
  AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id AND ledgers.user_id = auth.uid()))
  AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id AND ledgers.user_id = auth.uid()))
);
CREATE POLICY "authenticated_delete_own_transactions" ON transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_user_id ON ledgers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
