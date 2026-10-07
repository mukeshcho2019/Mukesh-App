/*
# Add Journal voucher support

1. Purpose
- Add the fourth Tally voucher flow, Journal, while keeping Payment, Receipt, and Transfer.

2. Modified columns
- `transactions.voucher_type` accepts `journal`.
- `transactions.type` accepts `journal` for journal rows.

3. Security
- Existing authenticated owner and shared-account row policies remain in place.
- No rows are deleted or changed by this migration.
*/

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'journal'::text]));
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_voucher_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_voucher_type_check CHECK (voucher_type = ANY (ARRAY['expense'::text, 'income'::text, 'payment'::text, 'receipt'::text, 'transfer'::text, 'journal'::text]));

DROP POLICY IF EXISTS "authenticated_select_own_or_shared_categories" ON categories;
CREATE POLICY "authenticated_select_own_or_shared_categories" ON categories FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM transactions
    JOIN account_members ON account_members.account_id = transactions.account_id
    WHERE transactions.category_id = categories.id AND account_members.user_id = auth.uid()
  )
);
