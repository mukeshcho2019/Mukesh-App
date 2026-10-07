import { useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight, FileDown, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Category, Ledger, Transaction } from '../types'
import { parseLocalDate, computeCashLedgerBalance, computePartyLedgerBalance, formatCurrency, formatMonthYear } from '../types'
import { openReportPdf } from '../lib/printReport'
import TallyBooks from './TallyBooks'

interface MonthlyReportProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
  categories: Category[]
  ledgers: Ledger[]
  selectedMonth: Date
  onMonthChange: (date: Date) => void
}

type ReportPeriod = 'month' | 'year'

export default function MonthlyReport({
  transactions,
  allTransactions,
  categories,
  ledgers,
  selectedMonth,
  onMonthChange,
}: MonthlyReportProps) {
  const [period, setPeriod] = useState<ReportPeriod>('month')
  const [reportView, setReportView] = useState<'summary' | 'tally'>('summary')

  const fyStartYear = selectedMonth.getMonth() >= 3 ? selectedMonth.getFullYear() : selectedMonth.getFullYear() - 1
  const fyEndYear = fyStartYear + 1
  const fyLabel = `FY ${fyStartYear}-${String(fyEndYear).slice(-2)}`

  const periodTransactions = useMemo(() => transactions.filter((tx) => {
    const txDate = parseLocalDate(tx.date)
    return period === 'month'
      ? txDate.getMonth() === selectedMonth.getMonth() && txDate.getFullYear() === selectedMonth.getFullYear()
      : txDate >= new Date(fyStartYear, 3, 1) && txDate <= new Date(fyEndYear, 2, 31, 23, 59, 59)
  }), [period, selectedMonth, transactions, fyStartYear, fyEndYear])

  const income = periodTransactions.filter((tx) => tx.voucher_type === 'income').reduce((sum, tx) => sum + tx.amount, 0)
  const expenses = periodTransactions.filter((tx) => tx.voucher_type === 'expense').reduce((sum, tx) => sum + tx.amount, 0)
  const receipts = periodTransactions.filter((tx) => tx.voucher_type === 'receipt').reduce((sum, tx) => sum + tx.amount, 0)
  const payments = periodTransactions.filter((tx) => tx.voucher_type === 'payment').reduce((sum, tx) => sum + tx.amount, 0)
  const transfers = periodTransactions.filter((tx) => tx.voucher_type === 'transfer').reduce((sum, tx) => sum + tx.amount, 0)
  const pnl = income - expenses
  const savingsRate = income > 0 ? Math.round((pnl / income) * 100) : 0

  const partyLedgers = ledgers.filter((ledger) => ledger.type === 'party' && (ledger.ledger_group === 'vendor' || ledger.ledger_group === 'loan'))
  const bankLedgers = ledgers.filter((ledger) => ledger.type === 'bank')
  const cashLedgers = ledgers.filter((ledger) => ledger.type === 'cash')
  const investmentLedgers = ledgers.filter((ledger) => ledger.type === 'investment')
  const receivable = partyLedgers.reduce((sum, ledger) => sum + Math.max(0, computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const payable = partyLedgers.reduce((sum, ledger) => sum + Math.max(0, -computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const bankBalance = bankLedgers.reduce((sum, ledger) => sum + computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions), 0)
  const cashBalance = cashLedgers.reduce((sum, ledger) => sum + computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions), 0)
  const investment = investmentLedgers.reduce((sum, ledger) => sum + Math.abs(computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const assets = bankBalance + cashBalance + investment + receivable
  const liabilities = payable
  const netPosition = assets - liabilities

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string; icon: string }>()
    periodTransactions.filter((tx) => tx.voucher_type === 'expense').forEach((tx) => {
      const category = categories.find((item) => item.id === tx.category_id && item.type === 'expense')
      const key = category?.id ?? 'other'
      const current = map.get(key)
      if (current) current.value += tx.amount
      else map.set(key, { name: category?.name ?? 'Other', value: tx.amount, color: category?.color ?? '#94a3b8', icon: category?.icon ?? '•' })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [categories, periodTransactions])

  const incomeByCategory = useMemo(() => {
    const map = new Map<string, { name: string; value: number; color: string; icon: string }>()
    periodTransactions.filter((tx) => tx.voucher_type === 'income').forEach((tx) => {
      const category = categories.find((item) => item.id === tx.category_id && item.type === 'income')
      const key = category?.id ?? 'other'
      const current = map.get(key)
      if (current) current.value += tx.amount
      else map.set(key, { name: category?.name ?? 'Other', value: tx.amount, color: category?.color ?? '#10b981', icon: category?.icon ?? '•' })
    })
    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [categories, periodTransactions])

  const dailyData = useMemo(() => {
    if (period === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const month = (i + 3) % 12
        const year = i + 3 >= 12 ? fyEndYear : fyStartYear
        const monthTx = periodTransactions.filter((tx) => { const d = parseLocalDate(tx.date); return d.getMonth() === month && d.getFullYear() === year })
        return { day: new Date(year, month, 1).toLocaleDateString('en-IN', { month: 'short' }), income: monthTx.filter((tx) => tx.voucher_type === 'income').reduce((sum, tx) => sum + tx.amount, 0), expense: monthTx.filter((tx) => tx.voucher_type === 'expense').reduce((sum, tx) => sum + tx.amount, 0) }
      })
    }
    const days = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate()
    return Array.from({ length: days }, (_, index) => {
      const day = index + 1
      const dayTx = periodTransactions.filter((tx) => parseLocalDate(tx.date).getDate() === day)
      return { day: String(day), income: dayTx.filter((tx) => tx.voucher_type === 'income').reduce((sum, tx) => sum + tx.amount, 0), expense: dayTx.filter((tx) => tx.voucher_type === 'expense').reduce((sum, tx) => sum + tx.amount, 0) }
    })
  }, [period, periodTransactions, selectedMonth])

  const title = period === 'month' ? formatMonthYear(selectedMonth) : fyLabel
  const previous = () => {
    const next = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
    if (period === 'month') next.setMonth(next.getMonth() - 1)
    else next.setFullYear(next.getFullYear() - 1)
    onMonthChange(next)
  }
  const next = () => {
    const nextDate = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1)
    if (period === 'month') nextDate.setMonth(nextDate.getMonth() + 1)
    else nextDate.setFullYear(nextDate.getFullYear() + 1)
    onMonthChange(nextDate)
  }
  const now = new Date()
  const currentFyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
  const isCurrent = period === 'month'
    ? now.getMonth() === selectedMonth.getMonth() && now.getFullYear() === selectedMonth.getFullYear()
    : currentFyStartYear === fyStartYear

  const openPdf = () => {
    const row = (label: string, value: number, className = '') => `<tr><td>${label}</td><td class="amount ${className}">${formatCurrency(value)}</td></tr>`
    const content = `<h2>Financial Report — ${title}</h2><p class="subtitle">Complete ${period} view for the selected account</p><div class="grid"><div class="card"><div class="label">PNL</div><div class="value ${pnl >= 0 ? 'positive' : 'negative'}">${formatCurrency(pnl)}</div></div><div class="card"><div class="label">Net Position</div><div class="value blue">${formatCurrency(netPosition)}</div></div><div class="card"><div class="label">Total Assets</div><div class="value positive">${formatCurrency(assets)}</div></div><div class="card"><div class="label">Total Liabilities</div><div class="value orange">${formatCurrency(liabilities)}</div></div></div><div class="section"><h3>Income & Expense Summary</h3><table>${row('Income', income, 'positive')}${row('Expenses', expenses, 'negative')}${row('Receipts', receipts, 'positive')}${row('Payments', payments, 'negative')}${row('Transfers', transfers)}${row('Savings Rate', savingsRate)}</table></div><div class="section"><h3>Assets & Liabilities</h3><table>${row('Bank Balance', bankBalance)}${row('Cash Balance', cashBalance)}${row('Investments', investment, 'positive')}${row('Receivable', receivable, 'positive')}${row('Payable', payable, 'negative')}${row('Net Position', netPosition, netPosition >= 0 ? 'positive' : 'negative')}</table></div><div class="section"><h3>Category Breakdown</h3><table><thead><tr><th>Type</th><th>Category</th><th class="amount">Amount</th></tr></thead><tbody>${incomeByCategory.map((item) => `<tr><td>Income</td><td>${item.icon} ${item.name}</td><td class="amount positive">${formatCurrency(item.value)}</td></tr>`).join('')}${expenseByCategory.map((item) => `<tr><td>Expense</td><td>${item.icon} ${item.name}</td><td class="amount negative">${formatCurrency(item.value)}</td></tr>`).join('') || '<tr><td colspan="3" class="empty">No category entries</td></tr>'}</tbody></table></div>`
    openReportPdf(`Financial Report — ${title}`, `${period} summary`, content)
  }

  if (reportView === 'tally') {
    return <div className="space-y-4 animate-fade-in"><button type="button" onClick={() => setReportView('summary')} className="text-sm font-semibold text-primary-700">← Back to Report Summary</button><TallyBooks transactions={periodTransactions} allTransactions={allTransactions} categories={categories} ledgers={ledgers} /></div>
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-xl bg-neutral-100 p-1">
          <button onClick={() => setPeriod('month')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === 'month' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>Monthly</button>
          <button onClick={() => setPeriod('year')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === 'year' ? 'bg-white text-primary-700 shadow-sm' : 'text-neutral-500'}`}>Annual</button>
        </div>
        <button onClick={openPdf} className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary-700"><FileDown className="h-4 w-4" /> Open PDF</button>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-white p-3">
        <button onClick={previous} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100"><ChevronLeft className="h-5 w-5 text-neutral-600" /></button>
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <button onClick={next} disabled={isCurrent} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"><ChevronRight className="h-5 w-5 text-neutral-600" /></button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-3"><div className="mb-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-success-50"><TrendingUp className="h-3.5 w-3.5 text-success-600" /></div><span className="text-xs text-neutral-500">Income</span></div><p className="text-lg font-bold text-success-600">{formatCurrency(income)}</p></div>
        <div className="rounded-xl border border-neutral-200 bg-white p-3"><div className="mb-2 flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-danger-50"><TrendingDown className="h-3.5 w-3.5 text-danger-600" /></div><span className="text-xs text-neutral-500">Expenses</span></div><p className="text-lg font-bold text-danger-600">{formatCurrency(expenses)}</p></div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-4 text-white"><div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-primary-100">PNL</p><p className="mt-0.5 text-2xl font-bold">{formatCurrency(pnl)}</p></div><div className="text-right"><p className="text-xs text-primary-100">Savings Rate</p><p className="mt-0.5 text-2xl font-bold">{savingsRate}%</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${Math.max(0, Math.min(100, savingsRate))}%` }} /></div></div>

      <div className="grid grid-cols-2 gap-3">
        {[['Assets', assets, 'text-success-600'], ['Liabilities', liabilities, 'text-warning-600'], ['Receivable', receivable, 'text-success-600'], ['Payable', payable, 'text-warning-600'], ['Investments', investment, 'text-success-600'], ['Net Position', netPosition, netPosition >= 0 ? 'text-primary-700' : 'text-danger-600']].map(([label, value, color]) => <div key={String(label)} className="rounded-xl border border-neutral-200 bg-white p-3"><p className="text-xs text-neutral-500">{label}</p><p className={`mt-1 text-base font-bold ${color}`}>{formatCurrency(Number(value))}</p></div>)}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4"><h3 className="mb-3 text-sm font-semibold text-neutral-900">Balance Details</h3><div className="space-y-2.5">{[['Bank Balance', bankBalance], ['Cash Balance', cashBalance], ['Investments', investment], ['Receivable', receivable], ['Payable', payable]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between text-sm"><span className="text-neutral-600">{label}</span><span className="font-semibold text-neutral-900">{formatCurrency(Number(value))}</span></div>)}</div></div>

      {periodTransactions.length > 0 && <div className="rounded-2xl border border-neutral-200 bg-white p-4"><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900"><BarChart3 className="h-4 w-4 text-primary-600" /> Activity</h3><div className="h-48"><ResponsiveContainer width="100%" height="100%"><BarChart data={dailyData} barGap={2}><XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={period === 'year' ? 1 : 4} /><YAxis hide /><Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name === 'expense' ? 'Expense' : 'Income']} /><Bar dataKey="income" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={12} /><Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} maxBarSize={12} /></BarChart></ResponsiveContainer></div></div>}

      {(incomeByCategory.length > 0 || expenseByCategory.length > 0) && <div className="grid gap-4 sm:grid-cols-2">{incomeByCategory.length > 0 && <div className="rounded-2xl border border-neutral-200 bg-white p-4"><h3 className="mb-3 text-sm font-semibold text-neutral-900">Income Sources</h3><div className="space-y-2.5">{incomeByCategory.map((item) => <div key={item.name} className="flex items-center justify-between text-sm"><span className="truncate text-neutral-600">{item.icon} {item.name}</span><span className="font-semibold text-success-600">{formatCurrency(item.value)}</span></div>)}</div></div>}{expenseByCategory.length > 0 && <div className="rounded-2xl border border-neutral-200 bg-white p-4"><h3 className="mb-3 text-sm font-semibold text-neutral-900">Expense Categories</h3><div className="space-y-2.5">{expenseByCategory.map((item) => <div key={item.name} className="flex items-center justify-between text-sm"><span className="truncate text-neutral-600">{item.icon} {item.name}</span><span className="font-semibold text-danger-600">{formatCurrency(item.value)}</span></div>)}</div></div>}</div>}

      {periodTransactions.length === 0 && <div className="py-16 text-center"><Wallet className="mx-auto mb-3 h-10 w-10 text-neutral-300" /><p className="text-sm text-neutral-500">No income or expense entries for this period</p></div>}

      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Report views</p>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setReportView('summary')} className="rounded-xl border border-primary-200 bg-primary-50 px-3 py-2.5 text-xs font-semibold text-primary-700">Summary</button>
          <button onClick={() => setReportView('tally')} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100">Tally Books</button>
        </div>
      </div>
    </div>
  )
}
