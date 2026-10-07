export type TransactionType = 'income' | 'expense' | 'journal'

export type VoucherType = 'expense' | 'income' | 'payment' | 'receipt' | 'journal' | 'transfer'

export type LedgerType = 'party' | 'bank' | 'cash' | 'investment'
export type LedgerGroup = 'income' | 'expense' | 'loan' | 'vendor' | 'customer' | 'asset' | 'bank' | 'cash' | 'investment' | 'other'

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string
  color: string
  created_at?: string
}

export interface Account {
  id: string
  name: string
  type: string | null
  icon: string
  color: string
  user_id?: string
  created_at?: string
}

export interface Ledger {
  id: string
  name: string
  type: LedgerType
  opening_balance: number
  icon: string
  color: string
  account_id: string | null
  ledger_group: LedgerGroup
  created_at?: string
}

export interface Transaction {
  id: string
  amount: number
  type: TransactionType
  voucher_type: VoucherType
  category_id: string | null
  ledger_id: string | null
  from_ledger_id: string | null
  description: string
  date: string
  account_id: string | null
  status: 'settled' | 'pending'
  created_at?: string
  category?: Category | null
  account?: Account | null
  ledger?: Ledger | null
  from_ledger?: Ledger | null
}

export interface TransactionInput {
  amount: number
  type: TransactionType
  voucher_type: VoucherType
  category_id: string | null
  ledger_id: string | null
  from_ledger_id: string | null
  description: string
  date: string
  account_id: string | null
  status: 'settled'
}

export interface LedgerInput {
  name: string
  type: LedgerType
  opening_balance: number
  icon: string
  color: string
  account_id?: string | null
  ledger_group?: LedgerGroup
}

export const VOUCHER_TYPES: { value: VoucherType; label: string; icon: string; color: string; desc: string }[] = [
  { value: 'income', label: 'Income', icon: '💰', color: '#10b981', desc: 'Money earned (salary, sales, etc.)' },
  { value: 'expense', label: 'Expense', icon: '💸', color: '#ef4444', desc: 'Money spent on a category' },
  { value: 'payment', label: 'Payment', icon: '📤', color: '#f59e0b', desc: 'Money paid to a party' },
  { value: 'receipt', label: 'Receipt', icon: '📥', color: '#3b82f6', desc: 'Money received from a party' },
  { value: 'journal', label: 'Journal', icon: '📒', color: '#64748b', desc: 'Adjustment or non-cash entry' },
  { value: 'transfer', label: 'Transfer', icon: '🔄', color: '#6366f1', desc: 'Bank/Cash transfer' },
]

export const LEDGER_GROUPS: { value: LedgerGroup; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expenses' },
  { value: 'loan', label: 'Loans' },
  { value: 'vendor', label: 'Vendors' },
  { value: 'customer', label: 'Customers' },
  { value: 'asset', label: 'Assets' },
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Cash' },
  { value: 'investment', label: 'Investments' },
  { value: 'other', label: 'Other' },
]

export const LEDGER_TYPES: { value: LedgerType; label: string; icon: string }[] = [
  { value: 'party', label: 'Party', icon: '👤' },
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'cash', label: 'Cash', icon: '💵' },
  { value: 'investment', label: 'Investment', icon: '📈' },
]

export const LEDGER_ICONS = ['👤', '🧑', '👨', '👩', '🏢', '🏪', '🏦', '💵', '📈', '🤝', '🏠', '💼', '🛵', '📦', '💰', '📊', '🔧', '🌾']
export const LEDGER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

/**
 * Effect on the "from" ledger (bank/cash) balance:
 * income    → +amount  (money came in to bank/cash)
 * expense   → -amount  (money went out from bank/cash)
 * payment   → -amount  (you paid out from bank/cash to a party)
 * receipt   → +amount  (you received into bank/cash from a party)
 * transfer  → -amount  (money moved OUT of this bank/cash to another)
 */
export function fromLedgerEffect(tx: Pick<Transaction, 'voucher_type' | 'amount'>): number {
  if (tx.voucher_type === 'income' || tx.voucher_type === 'receipt') return tx.amount
  return -tx.amount
}

/**
 * Effect on the "to" ledger balance:
 * payment    → +amount (party owes you = receivable)
 * receipt   → -amount (you owe party = payable)
 * transfer  → +amount (money moved INTO this bank/cash from another)
 */
export function ledgerEffect(tx: Pick<Transaction, 'voucher_type' | 'amount'>): number {
  if (tx.voucher_type === 'payment' || tx.voucher_type === 'transfer' || tx.voucher_type === 'journal') return tx.amount
  return -tx.amount
}

/**
 * Compute the current balance of a bank/cash ledger.
 * opening_balance
 * + sum of fromLedgerEffect for all tx where from_ledger_id = this ledger (debit side)
 * + sum of amount for all transfer tx where ledger_id = this ledger (credit side, money moved IN)
 */
export function computeCashLedgerBalance(
  ledgerId: string,
  openingBalance: number,
  allTransactions: Transaction[]
): number {
  const debit = allTransactions
    .filter((tx) => tx.from_ledger_id === ledgerId)
    .reduce((sum, tx) => sum + fromLedgerEffect(tx), 0)
  const transferIn = allTransactions
    .filter((tx) => tx.voucher_type === 'transfer' && tx.ledger_id === ledgerId)
    .reduce((sum, tx) => sum + tx.amount, 0)
  return openingBalance + debit + transferIn
}

/**
 * Compute the current balance of a party/investment ledger.
 * opening_balance + sum of all transactions where ledger_id = this ledger.
 * Positive = receivable (they owe you), negative = payable (you owe them).
 */
export function computePartyLedgerBalance(
  ledgerId: string,
  openingBalance: number,
  allTransactions: Transaction[]
): number {
  return openingBalance + allTransactions
    .filter((tx) => tx.ledger_id === ledgerId)
    .reduce((sum, tx) => sum + ledgerEffect(tx), 0)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Parse a 'YYYY-MM-DD' string as a local date (avoids timezone day-shift). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
