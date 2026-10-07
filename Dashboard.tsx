import { TrendingUp, TrendingDown, Wallet, ChevronRight, X } from 'lucide-react'
import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { Transaction, Category, Account, Ledger } from '../types'
import { parseLocalDate, formatCurrency, formatDate, computeCashLedgerBalance, computePartyLedgerBalance } from '../types'

interface DashboardProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  ledgers: Ledger[]
  onEdit: (tx: Transaction) => void
  onAddClick: () => void
  onSeeAll: () => void
}

export default function Dashboard({
  transactions,
  allTransactions,
  categories,
  accounts,
  ledgers,
  onEdit,
  onAddClick,
  onSeeAll,
}: DashboardProps) {
  const [activeBreakdown, setActiveBreakdown] = useState<'receivable' | 'payable' | 'bank' | 'cash' | 'investment' | null>(null)
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthTransactions = transactions.filter((tx) => {
    const d = parseLocalDate(tx.date)
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear
  })

  const totalIncome = monthTransactions
    .filter((tx) => tx.voucher_type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalExpense = monthTransactions
    .filter((tx) => tx.voucher_type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const balance = totalIncome - totalExpense

  // Receivable = all party ledgers with positive balance
  const partyLedgers = ledgers.filter((l) => l.type === 'party' && (l.ledger_group === 'vendor' || l.ledger_group === 'loan'))
  const receivable = partyLedgers.reduce(
    (sum, l) => sum + Math.max(0, computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)),
    0
  )
  const payable = partyLedgers.reduce(
    (sum, l) => sum + Math.max(0, -computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)),
    0
  )

  // Bank & Cash balances from bank/cash ledgers
  const bankLedgers = ledgers.filter((l) => l.type === 'bank')
  const cashLedgers = ledgers.filter((l) => l.type === 'cash')
  const totalBankBalance = bankLedgers.reduce(
    (sum, l) => sum + computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions), 0
  )
  const totalCashBalance = cashLedgers.reduce(
    (sum, l) => sum + computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions), 0
  )

  const getAccountBalance = (accountId: string) => {
    return allTransactions
      .filter((tx) => tx.account_id === accountId && tx.voucher_type !== 'transfer')
      .reduce((sum, tx) => {
        if (tx.voucher_type === 'income' || tx.voucher_type === 'receipt') return sum + tx.amount
        return sum - tx.amount
      }, 0)
  }

  const expenseByCategory = new Map<string, { name: string; value: number; color: string }>()
  monthTransactions
    .filter((tx) => tx.voucher_type === 'expense')
    .forEach((tx) => {
      const cat = categories.find((c) => c.id === tx.category_id)
      const key = cat?.id ?? 'uncategorized'
      const existing = expenseByCategory.get(key)
      if (existing) {
        existing.value += tx.amount
      } else {
        expenseByCategory.set(key, { name: cat?.name ?? 'Other', value: tx.amount, color: cat?.color ?? '#94a3b8' })
      }
    })

  const pieData = Array.from(expenseByCategory.values()).sort((a, b) => b.value - a.value)
  const recentTransactions = transactions.slice(0, 5)
  const monthName = now.toLocaleDateString('en-IN', { month: 'long' })
  const accountBalances = accounts.map((a) => ({ ...a, balance: getAccountBalance(a.id) }))

  // Investment total
  const investmentLedgers = ledgers.filter((l) => l.type === 'investment')
  const totalInvestment = investmentLedgers.reduce(
    (sum, l) => sum + Math.abs(computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)), 0
  )

  const breakdownConfig = {
    receivable: {
      title: 'Receivables by Party',
      subtitle: 'Outstanding amounts due from parties',
      amount: receivable,
      rows: partyLedgers
        .map((ledger) => ({ ledger, amount: computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions) }))
        .filter(({ amount }) => amount > 0),
      color: 'text-success-600',
    },
    payable: {
      title: 'Payables by Party',
      subtitle: 'Outstanding amounts payable to parties',
      amount: payable,
      rows: partyLedgers
        .map((ledger) => ({ ledger, amount: Math.abs(computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)) }))
        .filter(({ ledger, amount }) => amount > 0 && computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions) < 0),
      color: 'text-warning-600',
    },
    bank: {
      title: 'Bank account breakup',
      subtitle: 'Current balance of each bank account',
      amount: totalBankBalance,
      rows: bankLedgers.map((ledger) => ({ ledger, amount: computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions) })),
      color: 'text-neutral-900',
    },
    cash: {
      title: 'Cash account breakup',
      subtitle: 'Current balance of each cash ledger',
      amount: totalCashBalance,
      rows: cashLedgers.map((ledger) => ({ ledger, amount: computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions) })),
      color: 'text-neutral-900',
    },
    investment: {
      title: 'Investment breakup',
      subtitle: 'Current value of each investment ledger',
      amount: totalInvestment,
      rows: investmentLedgers.map((ledger) => ({ ledger, amount: Math.abs(computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)) })),
      color: 'text-success-600',
    },
  } as const

  const activeBreakdownData = activeBreakdown ? breakdownConfig[activeBreakdown] : null

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Balance Card */}
      <div className="rounded-3xl bg-gradient-to-br from-primary-700 via-primary-800 to-primary-900 p-6 text-white shadow-xl shadow-primary-900/25 relative overflow-hidden border-t-2 border-gold-400/80">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16" />
        <div className="relative">
          <p className="text-sm text-primary-100 font-medium">{monthName} — Income vs Expense</p>
          <p className="font-display text-4xl font-bold mt-2 tracking-tight">{formatCurrency(balance)}</p>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-success-100" />
              </div>
              <div>
                <p className="text-xs text-primary-100">Income</p>
                <p className="text-sm font-semibold">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/15" />
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-danger-100" />
              </div>
              <div>
                <p className="text-xs text-primary-100">Expense</p>
                <p className="text-sm font-semibold">{formatCurrency(totalExpense)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receivable & Payable */}
      {(receivable > 0 || payable > 0) && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setActiveBreakdown('receivable')} className="w-full text-left rounded-2xl bg-white p-4 border border-neutral-200 hover:border-success-300 hover:shadow-md active:scale-[0.98] transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📤</span>
              <span className="text-xs font-medium text-neutral-500">Receivable</span>
            </div>
            <p className="text-lg font-bold text-success-600">{formatCurrency(receivable)}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Amount receivable</p>
            <p className="text-[10px] text-primary-500 mt-2 font-medium">View details →</p>
          </button>
          <button type="button" onClick={() => setActiveBreakdown('payable')} className="w-full text-left rounded-2xl bg-white p-4 border border-neutral-200 hover:border-warning-300 hover:shadow-md active:scale-[0.98] transition-all">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">📥</span>
              <span className="text-xs font-medium text-neutral-500">Payable</span>
            </div>
            <p className="text-lg font-bold text-warning-600">{formatCurrency(payable)}</p>
            <p className="text-[10px] text-neutral-400 mt-0.5">Amount payable</p>
            <p className="text-[10px] text-primary-500 mt-2 font-medium">View details →</p>
          </button>
        </div>
      )}

      {/* Bank & Cash Balance */}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => setActiveBreakdown('bank')} className="w-full text-left rounded-2xl bg-white p-4 border border-neutral-200 hover:border-primary-300 hover:shadow-md active:scale-[0.98] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🏦</span>
            <span className="text-xs font-medium text-neutral-500">Bank Balance</span>
          </div>
          <p className={`text-lg font-bold ${totalBankBalance >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>
            {formatCurrency(totalBankBalance)}
          </p>
          {bankLedgers.length > 1 && (
            <div className="mt-2 space-y-1">
              {bankLedgers.map((l) => {
                const bal = computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
                return (
                  <div key={l.id} className="flex items-center justify-between text-[10px] text-neutral-400">
                    <span>{l.icon} {l.name}</span>
                    <span className={bal >= 0 ? 'text-neutral-600 font-medium' : 'text-danger-600 font-medium'}>{formatCurrency(bal)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-[10px] text-primary-500 mt-2 font-medium">View details →</p>
        </button>
        <button type="button" onClick={() => setActiveBreakdown('cash')} className="w-full text-left rounded-2xl bg-white p-4 border border-neutral-200 hover:border-primary-300 hover:shadow-md active:scale-[0.98] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">💵</span>
            <span className="text-xs font-medium text-neutral-500">Cash Balance</span>
          </div>
          <p className={`text-lg font-bold ${totalCashBalance >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>
            {formatCurrency(totalCashBalance)}
          </p>
          {cashLedgers.length > 1 && (
            <div className="mt-2 space-y-1">
              {cashLedgers.map((l) => {
                const bal = computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
                return (
                  <div key={l.id} className="flex items-center justify-between text-[10px] text-neutral-400">
                    <span>{l.icon} {l.name}</span>
                    <span className={bal >= 0 ? 'text-neutral-600 font-medium' : 'text-danger-600 font-medium'}>{formatCurrency(bal)}</span>
                  </div>
                )
              })}
            </div>
          )}
          <p className="text-[10px] text-primary-500 mt-2 font-medium">View details →</p>
        </button>
      </div>

      {/* Investment Summary */}
      {totalInvestment > 0 && (
        <button type="button" onClick={() => setActiveBreakdown('investment')} className="w-full text-left rounded-2xl bg-white p-4 border border-neutral-200 hover:border-success-300 hover:shadow-md active:scale-[0.98] transition-all">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">📈</span>
            <span className="text-xs font-medium text-neutral-500">Investment Total</span>
          </div>
          <p className="text-lg font-bold text-success-600">{formatCurrency(totalInvestment)}</p>
          <div className="mt-2 space-y-1">
            {investmentLedgers.map((l) => {
              const bal = computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
              return (
                <div key={l.id} className="flex items-center justify-between text-[10px] text-neutral-400">
                  <span>{l.icon} {l.name}</span>
                  <span className="text-neutral-600 font-medium">{formatCurrency(Math.abs(bal))}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-primary-500 mt-2 font-medium">View details →</p>
        </button>
      )}

      {/* Account-wise Balances */}
      {accountBalances.length > 0 && (
        <div className="rounded-2xl bg-white p-4 border border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">Account Balances</h3>
          <div className="space-y-2.5">
            {accountBalances.map((a) => (
              <div key={a.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                    style={{ backgroundColor: (a.color ?? '#94a3b8') + '20' }}>
                    {a.icon}
                  </div>
                  <span className="text-sm text-neutral-700">{a.name}</span>
                </div>
                <span className={`text-sm font-semibold ${a.balance >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>
                  {formatCurrency(a.balance)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expense Breakdown */}
      {pieData.length > 0 && (
        <div className="rounded-2xl bg-white p-4 border border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-900 mb-3">{monthName} Expenses</h3>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={32} outerRadius={56} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
              {pieData.slice(0, 5).map((item, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-neutral-600 truncate">{item.name}</span>
                  </div>
                  <span className="text-xs font-semibold text-neutral-900 flex-shrink-0">{formatCurrency(item.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeBreakdownData && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setActiveBreakdown(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl animate-slide-up" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">{activeBreakdownData.title}</h3>
                <p className="mt-1 text-xs text-neutral-500">{activeBreakdownData.subtitle}</p>
              </div>
              <button type="button" onClick={() => setActiveBreakdown(null)} className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200" aria-label="Close breakdown">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-5 flex items-end justify-between border-b border-neutral-100 pb-4">
              <span className="text-sm text-neutral-500">Total</span>
              <span className={`text-2xl font-bold ${activeBreakdownData.color}`}>{formatCurrency(activeBreakdownData.amount)}</span>
            </div>
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {activeBreakdownData.rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-neutral-400">No details available yet</p>
              ) : activeBreakdownData.rows.map(({ ledger, amount }) => (
                <div key={ledger.id} className="flex items-center justify-between rounded-xl bg-neutral-50 px-3 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white text-lg">{ledger.icon}</span>
                    <span className="truncate text-sm font-medium text-neutral-700">{ledger.name}</span>
                  </div>
                  <span className={`ml-3 flex-shrink-0 text-sm font-bold ${activeBreakdownData.color}`}>{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Monthly Summary Bar */}
      <div className="rounded-2xl bg-white p-4 border border-neutral-200">
        <h3 className="text-sm font-semibold text-neutral-900 mb-3">Monthly Summary</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-neutral-500">Entries</p>
            <p className="text-lg font-bold text-neutral-900 mt-1">{monthTransactions.length}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total Inflow</p>
            <p className="text-lg font-bold text-success-600 mt-1">{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total Outflow</p>
            <p className="text-lg font-bold text-danger-600 mt-1">{formatCurrency(totalExpense)}</p>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="rounded-2xl bg-white p-4 border border-neutral-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">Recent Entries</h3>
          {transactions.length > 5 && (
            <button onClick={onSeeAll} className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700">
              See All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {recentTransactions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
              <Wallet className="w-7 h-7 text-neutral-400" />
            </div>
            <p className="text-sm text-neutral-500 mb-1">No entries yet</p>
            <p className="text-xs text-neutral-400 mb-4">Add your first entry</p>
            <button onClick={onAddClick}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all">
              Add Entry
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {recentTransactions.map((tx) => {
              const cat = categories.find((c) => c.id === tx.category_id)
              const vt = tx.voucher_type
              const voucherMeta = {
                expense: { icon: '💸', color: 'text-danger-600', sign: '-' },
                income: { icon: '💰', color: 'text-success-600', sign: '+' },
                payment: { icon: '📤', color: 'text-warning-600', sign: '-' },
                receipt: { icon: '📥', color: 'text-primary-600', sign: '+' },
                transfer: { icon: '🔄', color: 'text-neutral-600', sign: '' },
                journal: { icon: '📒', color: 'text-slate-600', sign: '' },
              }[vt] ?? { icon: '💰', color: 'text-neutral-600', sign: '' }

              return (
                <button key={tx.id} onClick={() => onEdit(tx)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-neutral-50 active:scale-[0.98] transition-all text-left">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 bg-neutral-100">
                    {vt === 'expense' || vt === 'income' ? (cat?.icon ?? voucherMeta.icon) : voucherMeta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {vt === 'payment' || vt === 'receipt'
                        ? (tx.ledger?.name ?? 'Ledger')
                        : vt === 'transfer'
                        ? `${tx.from_ledger?.name ?? ''} → ${tx.ledger?.name ?? ''}`
                        : (cat?.name ?? 'Other')}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-neutral-400 truncate">
                        {tx.description || formatDate(tx.date)}
                      </p>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium flex-shrink-0 uppercase">
                        {vt}
                      </span>
                    </div>
                    {tx.from_ledger && <p className="text-[10px] text-neutral-400 mt-0.5">{tx.from_ledger.icon} {tx.from_ledger.name}</p>}
                  </div>
                  <p className={`text-sm font-semibold flex-shrink-0 ${voucherMeta.color}`}>
                    {voucherMeta.sign}{formatCurrency(tx.amount)}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
