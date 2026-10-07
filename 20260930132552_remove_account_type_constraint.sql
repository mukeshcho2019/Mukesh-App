/*
# Remove bank/cash type constraint on accounts

## Purpose
User wants to create accounts by name (e.g. "Mera Account", "Bhai ka Account")
instead of being limited to bank/cash types. Drop the type constraint.
*/

-- Drop the check constraint on accounts.type
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_type_check;

-- Make type column optional (nullable) since we no longer use it
ALTER TABLE accounts ALTER COLUMN type DROP NOT NULL;

-- Remove default seeded bank/cash accounts and reseed with named accounts
DELETE FROM accounts;

INSERT INTO accounts (name, icon, color) VALUES
  ('Mera Account', '👤', '#3b82f6'),
  ('Bhai ka Account', '🧑', '#10b981')
ON CONFLICT DO NOTHING;
