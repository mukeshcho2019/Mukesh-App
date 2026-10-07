/*
# Add 'transfer' voucher type to transactions

1. Changes
- Update the CHECK constraint on `voucher_type` to include 'transfer'.
  Transfer = Contra entry in Tally — moves money between two bank/cash ledgers
  (e.g., ATM withdrawal: Bank → Cash, or Bank A → Bank B).
- The old constraint allowed: expense, income, payment, receipt.
  New constraint allows: expense, income, payment, receipt, transfer.
2. Security
- No RLS changes.
3. Notes
- `from_ledger_id` = source bank/cash ledger (debit side)
- `ledger_id` = destination bank/cash ledger (credit side)
- For transfer, both from_ledger_id and ledger_id should be bank/cash type.
*/

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_voucher_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_voucher_type_check
  CHECK (voucher_type = ANY (ARRAY['expense'::text, 'income'::text, 'payment'::text, 'receipt'::text, 'transfer'::text]));
