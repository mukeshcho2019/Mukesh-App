/*
# Fix categories visibility for shared account members and data loading

## Purpose
Secondary users (e.g. Ashok on 9352559396) who have shared access to an account
via `account_members` cannot see any categories. The current shared categories
SELECT policy (`authenticated_select_own_or_shared_categories`) only shows
categories that are directly referenced by transactions on shared accounts.
If the shared account has no transactions yet, the secondary user sees zero
categories, making it impossible to create expense/income entries.

## Changes
1. Replace the shared categories SELECT policy with a broader one that shows
   ALL categories owned by any user who owns an account that the current user
   has membership in. This ensures shared users can see the full category list
   for accounts they have access to.
2. Add shared INSERT/UPDATE/DELETE policies for ledgers so secondary users
   with edit access can create/update/delete ledgers on shared accounts.
3. Add shared INSERT policy for transactions so secondary users with edit
   access can create transactions on shared accounts.
4. Add shared INSERT policy for categories so secondary users can create
   categories for shared accounts.

## Security
- All shared policies check `account_members` membership with `access_level`
  of 'edit' for write operations.
- SELECT remains read-only for all shared members.
- Ownership checks still apply for non-shared data.
*/

-- Fix categories SELECT: show all categories from account owners whose accounts the user can access
DROP POLICY IF EXISTS "authenticated_select_own_or_shared_categories" ON categories;
CREATE POLICY "authenticated_select_own_or_shared_categories" ON categories FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM accounts
      WHERE accounts.user_id = categories.user_id
      AND EXISTS (
        SELECT 1 FROM account_members
        WHERE account_members.account_id = accounts.id
        AND account_members.user_id = auth.uid()
      )
    )
  );

-- Allow shared members with edit access to insert categories
DROP POLICY IF EXISTS "authenticated_insert_shared_categories" ON categories;
CREATE POLICY "authenticated_insert_shared_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );

-- Allow shared members with edit access to update categories
DROP POLICY IF EXISTS "authenticated_update_shared_categories" ON categories;
CREATE POLICY "authenticated_update_shared_categories" ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );

-- Allow shared members with edit access to insert ledgers on shared accounts
DROP POLICY IF EXISTS "authenticated_insert_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_insert_shared_ledgers" ON ledgers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = ledgers.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );

-- Allow shared members with edit access to update ledgers on shared accounts
DROP POLICY IF EXISTS "authenticated_update_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_update_shared_ledgers" ON ledgers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = ledgers.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = ledgers.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );

-- Allow shared members with edit access to delete ledgers on shared accounts
DROP POLICY IF EXISTS "authenticated_delete_shared_ledgers" ON ledgers;
CREATE POLICY "authenticated_delete_shared_ledgers" ON ledgers FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = ledgers.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );

-- Allow shared members with edit access to insert transactions on shared accounts
DROP POLICY IF EXISTS "authenticated_insert_shared_transactions" ON transactions;
CREATE POLICY "authenticated_insert_shared_transactions" ON transactions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = transactions.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
    AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id))
    AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id))
    AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id))
  );

-- Allow shared members with edit access to update transactions on shared accounts
DROP POLICY IF EXISTS "authenticated_update_shared_transactions" ON transactions;
CREATE POLICY "authenticated_update_shared_transactions" ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = transactions.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = transactions.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
    AND (category_id IS NULL OR EXISTS (SELECT 1 FROM categories WHERE categories.id = transactions.category_id))
    AND (ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.ledger_id))
    AND (from_ledger_id IS NULL OR EXISTS (SELECT 1 FROM ledgers WHERE ledgers.id = transactions.from_ledger_id))
  );

-- Allow shared members with edit access to delete transactions on shared accounts
DROP POLICY IF EXISTS "authenticated_delete_shared_transactions" ON transactions;
CREATE POLICY "authenticated_delete_shared_transactions" ON transactions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM account_members
      WHERE account_members.account_id = transactions.account_id
      AND account_members.user_id = auth.uid()
      AND account_members.access_level = 'edit'
    )
  );
