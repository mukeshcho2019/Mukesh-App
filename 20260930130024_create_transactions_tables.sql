/*
# Create transactions and categories tables (single-tenant, no auth)

## Purpose
Expense & income tracker app. User can add transactions (income/expense),
categorize them, view dashboard summary, and see monthly reports.

## New Tables
- `categories`
  - `id` (uuid, primary key)
  - `name` (text, not null) — category name e.g. "Food", "Salary", "Fuel"
  - `type` (text, not null) — 'income' or 'expense'
  - `icon` (text) — emoji or icon name for display
  - `color` (text) — hex color for display
  - `created_at` (timestamptz)

- `transactions`
  - `id` (uuid, primary key)
  - `amount` (numeric, not null) — transaction amount
  - `type` (text, not null) — 'income' or 'expense'
  - `category_id` (uuid, references categories)
  - `description` (text) — optional note about the transaction
  - `date` (date, not null) — date of transaction
  - `payment_method` (text) — 'cash', 'card', 'upi', 'bank', 'other'
  - `created_at` (timestamptz)

## Security
- RLS enabled on both tables.
- Single-tenant app (no sign-in), so policies use `TO anon, authenticated` with `USING (true)` — data is intentionally shared/public.
*/

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  icon text DEFAULT '',
  color text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  description text DEFAULT '',
  date date NOT NULL,
  payment_method text DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'bank', 'other')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);

-- Seed default categories
INSERT INTO categories (name, type, icon, color) VALUES
  ('Salary', 'income', '💼', '#10b981'),
  ('Business', 'income', '🏪', '#10b981'),
  ('Investment', 'income', '📈', '#10b981'),
  ('Gift', 'income', '🎁', '#10b981'),
  ('Other Income', 'income', '💰', '#10b981'),
  ('Food & Dining', 'expense', '🍽️', '#ef4444'),
  ('Fuel', 'expense', '⛽', '#f59e0b'),
  ('Shopping', 'expense', '🛍️', '#ec4899'),
  ('Bills & Utilities', 'expense', '🧾', '#f97316'),
  ('Transport', 'expense', '🚗', '#3b82f6'),
  ('Entertainment', 'expense', '🎬', '#8b5cf6'),
  ('Health', 'expense', '🏥', '#14b8a6'),
  ('Education', 'expense', '📚', '#6366f1'),
  ('Rent', 'expense', '🏠', '#64748b'),
  ('Other Expense', 'expense', '📦', '#78716c')
ON CONFLICT DO NOTHING;
