/*
# Fix infinite recursion in RLS policies

## Problem
The accounts SELECT policy references account_members, and the account_members
SELECT policy references accounts. This creates an infinite recursion that
causes a 500 error on every query to ledgers, transactions, accounts, etc.

## Fix
1. Create a SECURITY DEFINER function `is_account_member(p_account_id, p_user_id)`
   that checks account_members membership WITHOUT going through RLS.
2. Create a SECURITY DEFINER function `is_account_owner(p_account_id, p_user_id)`
   that checks accounts ownership WITHOUT going through RLS.
3. Replace all EXISTS (SELECT 1 FROM account_members ...) subqueries in policies
   with calls to is_account_member(), breaking the recursion.
4. Replace all EXISTS (SELECT 1 FROM accounts ...) subqueries in account_members
   policies with calls to is_account_owner(), breaking the recursion.

## Security
- Both functions are SECURITY DEFINER, owned by postgres, bypassing RLS.
- They are read-only checks and return boolean.
- Recursion is eliminated because the functions don't go through RLS.
*/

CREATE OR REPLACE FUNCTION is_account_member(p_account_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM account_members
    WHERE account_id = p_account_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION is_account_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_account_member(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION is_account_owner(p_account_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM accounts
    WHERE id = p_account_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION is_account_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_account_owner(uuid, uuid) TO authenticated;

-- Fix account_members policies: use is_account_owner instead of subquery on accounts
DROP POLICY IF EXISTS "members_read_own_or_owned_accounts" ON account_members;
CREATE POLICY "members_read_own_or_owned_accounts" ON account_members FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR is_account_owner(account_id, auth.uid())
  );

DROP POLICY IF EXISTS "owners_add_account_members" ON account_members;
CREATE POLICY "owners_add_account_members" ON account_members FOR INSERT
  TO authenticated WITH CHECK (
    is_account_owner(account_id, auth.uid())
  );

DROP POLICY IF EXISTS "owners_or_members_delete_account_members" ON account_members;
CREATE POLICY "owners_or_members_delete_account_members" ON account_members FOR DELETE
  TO authenticated USING (
    user_id = auth.uid()
    OR is_account_owner(account_id, auth.uid())
  );

DROP POLICY IF EXISTS "owners_update_account_members" ON account_members;
CREATE POLICY "owners_update_account_members" ON account_members FOR UPDATE
  TO authenticated
  USING (is_account_owner(account_id, auth.uid()))
  WITH CHECK (is_account_owner(account_id, auth.uid()));

-- Fix accounts SELECT: use is_account_member instead of subquery on account_members
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_accounts" ON accounts;
CREATE POLICY "authenticated_select_own_or_shared_accounts" ON accounts FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR is_account_member(id, auth.uid())
  );

-- Fix ledgers SELECT: use is_account_member instead of subquery on account_members
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_select_own_or_shared_ledgers" ON ledgers FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR is_account_member(account_id, auth.uid())
  );

-- Fix ledgers INSERT (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_insert_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_insert_shared_ledgers" ON ledgers FOR INSERT
  TO authenticated WITH CHECK (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = ledgers.account_id AND user_id = auth.uid()
    ) = 'edit'
  );

-- Fix ledgers UPDATE (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_update_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_update_shared_ledgers" ON ledgers FOR UPDATE
  TO authenticated
  USING (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = ledgers.account_id AND user_id = auth.uid()
    ) = 'edit'
  )
  WITH CHECK (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = ledgers.account_id AND user_id = auth.uid()
    ) = 'edit'
  );

-- Fix ledgers DELETE (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_delete_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_delete_shared_ledgers" ON ledgers FOR DELETE
  TO authenticated USING (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = ledgers.account_id AND user_id = auth.uid()
    ) = 'edit'
  );

-- Fix transactions SELECT: use is_account_member
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_transactions" ON transactions;
CREATE POLICY "authenticated_select_own_or_shared_transactions" ON transactions FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR is_account_member(account_id, auth.uid())
  );

-- Fix transactions INSERT (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_insert_shared_transactions" ON transactions;
CREATE POLICY "authenticated_insert_shared_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = transactions.account_id AND user_id = auth.uid()
    ) = 'edit'
    AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id))
    AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id))
    AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id))
  );

-- Fix transactions UPDATE (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_update_shared_transactions" ON transactions;
CREATE POLICY "authenticated_update_shared_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = transactions.account_id AND user_id = auth.uid()
    ) = 'edit'
  )
  WITH CHECK (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = transactions.account_id AND user_id = auth.uid()
    ) = 'edit'
    AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id))
    AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id))
    AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id))
  );

-- Fix transactions DELETE (shared): use is_account_member
DROP POLICY IF EXISTS "authenticated_delete_shared_transactions" ON transactions;
CREATE POLICY "authenticated_delete_shared_transactions" ON transactions FOR DELETE
  TO authenticated USING (
    is_account_member(account_id, auth.uid())
    AND (
      SELECT access_level FROM account_members
      WHERE account_id = transactions.account_id AND user_id = auth.uid()
    ) = 'edit'
  );

-- Fix categories SELECT (shared): use is_account_member via accounts
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_categories" ON categories;
CREATE POLICY "authenticated_select_own_or_shared_categories" ON categories FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.user_id = categories.user_id
      AND is_account_member(accounts.id, auth.uid())
    )
  );

-- Fix account_access_codes policies: use is_account_owner
DROP POLICY IF EXISTS "owners_create_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_create_account_access_codes" ON account_access_codes FOR INSERT
  TO authenticated WITH CHECK (
    created_by = auth.uid()
    AND is_account_owner(account_id, auth.uid())
  );

DROP POLICY IF EXISTS "owners_delete_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_delete_account_access_codes" ON account_access_codes FOR DELETE
  TO authenticated USING (is_account_owner(account_id, auth.uid()));

DROP POLICY IF EXISTS "owners_read_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_read_account_access_codes" ON account_access_codes FOR SELECT
  TO authenticated USING (is_account_owner(account_id, auth.uid()));

DROP POLICY IF EXISTS "owners_update_account_access_codes" ON account_access_codes;
CREATE POLICY "owners_update_account_access_codes" ON account_access_codes FOR UPDATE
  TO authenticated
  USING (is_account_owner(account_id, auth.uid()))
  WITH CHECK (is_account_owner(account_id, auth.uid()));
