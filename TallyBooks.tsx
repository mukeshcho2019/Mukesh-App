import { useMemo, useState } from 'react'
import { BookOpen, FileDown, Landmark, Scale, ShoppingCart, Users, WalletCards } from 'lucide-react'
import type { Category, Ledger, Transaction } from '../types'
import { computeCashLedgerBalance, computePartyLedgerBalance, formatCurrency, formatDate, fromLedgerEffect } from '../types'
import { openReportPdf } from '../lib/printReport'

interface TallyBooksProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
  categories: Category[]
  ledgers: Ledger[]
}

type Book = 'day' | 'trial' | 'profit' | 'balance' | 'cash' | 'outstanding' | 'gst'

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function periodLabel(transactions: Transaction[]): string {
  if (transactions.length === 0) return 'Selected period'
  const dates = transactions.map((transaction) => transaction.date).sort()
  return `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`
}

export default function TallyBooks({ transactions, allTransactions, categories, ledgers }: TallyBooksProps) {
  const [book, setBook] = useState<Book>('day')
  const bankAndCash = ledgers.filter((ledger) => ledger.type === 'bank' || ledger.type === 'cash')
  const partyLedgers = ledgers.filter((ledger) => ledger.type === 'party' && (ledger.ledger_group === 'vendor' || ledger.ledger_group === 'loan'))
  const investmentLedgers = ledgers.filter((ledger) => ledger.type === 'investment')

  const income = transactions.filter((transaction) => transaction.voucher_type === 'income').reduce((sum, transaction) => sum + transaction.amount, 0)
  const expenses = transactions.filter((transaction) => transaction.voucher_type === 'expense').reduce((sum, transaction) => sum + transaction.amount, 0)
  const receivable = partyLedgers.reduce((sum, ledger) => sum + Math.max(0, computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const payable = partyLedgers.reduce((sum, ledger) => sum + Math.max(0, -computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const bankBalance = bankAndCash.filter((ledger) => ledger.type === 'bank').reduce((sum, ledger) => sum + computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions), 0)
  const cashBalance = bankAndCash.filter((ledger) => ledger.type === 'cash').reduce((sum, ledger) => sum + computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions), 0)
  const investments = investmentLedgers.reduce((sum, ledger) => sum + Math.abs(computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)), 0)
  const assets = bankBalance + cashBalance + investments + receivable
  const liabilities = payable
  const netPosition = assets - liabilities

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, { name: string; type: 'income' | 'expense'; amount: number }>()
    transactions.forEach((transaction) => {
      if (transaction.voucher_type !== 'income' && transaction.voucher_type !== 'expense') return
      const type = transaction.voucher_type
      const category = categories.find((item) => item.id === transaction.category_id && item.type === type)
      const key = category?.id ?? `${type}-other`
      const current = totals.get(key)
      if (current) current.amount += transaction.amount
      else totals.set(key, { name: category?.name ?? 'Other', type, amount: transaction.amount })
    })
    return [...totals.values()].sort((a, b) => b.amount - a.amount)
  }, [categories, transactions])

  const trialBalance = useMemo(() => ledgers.map((ledger) => {
    const balance = ledger.type === 'bank' || ledger.type === 'cash'
      ? computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)
      : computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions)
    return { ledger, debit: Math.max(0, balance), credit: Math.max(0, -balance) }
  }).filter((row) => row.debit !== 0 || row.credit !== 0), [allTransactions, ledgers])

  const totals = trialBalance.reduce((result, row) => ({ debit: result.debit + row.debit, credit: result.credit + row.credit }), { debit: 0, credit: 0 })
  const tabs: { id: Book; label: string; icon: typeof BookOpen }[] = [
    { id: 'day', label: 'Day Book', icon: BookOpen },
    { id: 'trial', label: 'Trial Balance', icon: Scale },
    { id: 'profit', label: 'P&L', icon: ShoppingCart },
    { id: 'balance', label: 'Balance Sheet', icon: WalletCards },
    { id: 'cash', label: 'Cash/Bank', icon: Landmark },
    { id: 'outstanding', label: 'Outstanding', icon: Users },
    { id: 'gst', label: 'GST', icon: FileDown },
  ]

  const openPdf = () => {
    const title = tabs.find((tab) => tab.id === book)?.label ?? 'Tally Book'
    let rows = ''
    if (book === 'day') rows = transactions.map((transaction) => `<tr><td>${escapeHtml(formatDate(transaction.date))}</td><td>${escapeHtml(transaction.voucher_type)}</td><td>${escapeHtml(transaction.description || transaction.category?.name || 'Entry')}</td><td class="amount">${escapeHtml(formatCurrency(transaction.amount))}</td></tr>`).join('')
    if (book === 'trial') rows = trialBalance.map((row) => `<tr><td>${escapeHtml(row.ledger.name)}</td><td class="amount">${escapeHtml(formatCurrency(row.debit))}</td><td class="amount">${escapeHtml(formatCurrency(row.credit))}</td></tr>`).join('') + `<tr><th>Total</th><th class="amount">${escapeHtml(formatCurrency(totals.debit))}</th><th class="amount">${escapeHtml(formatCurrency(totals.credit))}</th></tr>`
    if (book === 'profit') rows = categoryTotals.map((row) => `<tr><td>${row.type === 'income' ? 'Income' : 'Expense'}</td><td>${escapeHtml(row.name)}</td><td class="amount">${escapeHtml(formatCurrency(row.amount))}</td></tr>`).join('') + `<tr><th>Net Profit</th><th colspan="2" class="amount">${escapeHtml(formatCurrency(income - expenses))}</th></tr>`
    if (book === 'balance') rows = `<tr><td>Bank</td><td class="amount">${escapeHtml(formatCurrency(bankBalance))}</td></tr><tr><td>Cash</td><td class="amount">${escapeHtml(formatCurrency(cashBalance))}</td></tr><tr><td>Investments</td><td class="amount">${escapeHtml(formatCurrency(investments))}</td></tr><tr><td>Receivable</td><td class="amount">${escapeHtml(formatCurrency(receivable))}</td></tr><tr><td>Payable</td><td class="amount">${escapeHtml(formatCurrency(liabilities))}</td></tr><tr><th>Net Position</th><th class="amount">${escapeHtml(formatCurrency(netPosition))}</th></tr>`
    if (book === 'outstanding') rows = partyLedgers.map((ledger) => { const balance = computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions); return balance === 0 ? '' : `<tr><td>${escapeHtml(ledger.name)}</td><td>${balance > 0 ? 'Receivable' : 'Payable'}</td><td class="amount">${escapeHtml(formatCurrency(Math.abs(balance)))}</td></tr>` }).join('')
    openReportPdf(`${title} — Mukesh Choudhary`, periodLabel(transactions), `<h2>${escapeHtml(title)}</h2><p class="subtitle">${escapeHtml(periodLabel(transactions))}</p><div class="section"><table>${rows || '<tr><td class="empty">No entries in this book</td></tr>'}</table></div>`)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-lg font-bold text-neutral-900">Tally Books</h2><p className="text-xs text-neutral-500">Voucher-wise accounting reports</p></div>
        <button type="button" onClick={openPdf} className="flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"><FileDown className="h-4 w-4" /> PDF</button>
      </div>
      {book === 'day' && <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"><div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3"><h3 className="text-sm font-semibold text-neutral-900">Day Book</h3></div><div className="divide-y divide-neutral-100">{transactions.length === 0 ? <p className="p-8 text-center text-sm text-neutral-500">No vouchers in this period</p> : transactions.map((transaction) => <div key={transaction.id} className="flex items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-neutral-900">{transaction.description || transaction.category?.name || 'Entry'}</p><p className="text-xs text-neutral-500">{formatDate(transaction.date)} · {transaction.voucher_type}</p></div><span className="text-sm font-semibold text-neutral-900">{formatCurrency(transaction.amount)}</span></div>)}</div></div>}
      {book === 'trial' && <ReportTable title="Trial Balance" headers={['Ledger', 'Debit', 'Credit']} rows={trialBalance.map((row) => [row.ledger.name, formatCurrency(row.debit), formatCurrency(row.credit)])} footer={['Total', formatCurrency(totals.debit), formatCurrency(totals.credit)]} />}
      {book === 'profit' && <ReportTable title="Profit & Loss" headers={['Type', 'Category', 'Amount']} rows={categoryTotals.map((row) => [row.type === 'income' ? 'Income' : 'Expense', row.name, formatCurrency(row.amount)])} footer={['Net Profit', '', formatCurrency(income - expenses)]} />}
      {book === 'balance' && <ReportTable title="Balance Sheet" headers={['Particular', 'Amount']} rows={[["Bank", formatCurrency(bankBalance)], ['Cash', formatCurrency(cashBalance)], ['Investments', formatCurrency(investments)], ['Receivable', formatCurrency(receivable)], ['Payable', formatCurrency(payable)]]} footer={['Net Position', formatCurrency(netPosition)]} />}
      {book === 'cash' && <div className="space-y-3">{bankAndCash.map((ledger) => { const rows = transactions.filter((transaction) => transaction.from_ledger_id === ledger.id || (transaction.voucher_type === 'transfer' && transaction.ledger_id === ledger.id)); return <ReportTable key={ledger.id} title={`${ledger.name} ${ledger.type === 'bank' ? 'Bank Book' : 'Cash Book'}`} headers={['Date', 'Voucher', 'Effect']} rows={rows.map((transaction) => { const effect = transaction.voucher_type === 'transfer' && transaction.ledger_id === ledger.id ? transaction.amount : fromLedgerEffect(transaction); return [formatDate(transaction.date), transaction.voucher_type, `${effect >= 0 ? '+' : ''}${formatCurrency(effect)}`] })} footer={['Balance', formatCurrency(computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions))]} /> })}</div>}
      {book === 'outstanding' && <ReportTable title="Party Outstanding" headers={['Party', 'Status', 'Amount']} rows={partyLedgers.map((ledger) => { const balance = computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, allTransactions); return [ledger.name, balance >= 0 ? 'Receivable' : 'Payable', formatCurrency(Math.abs(balance))] }).filter((row) => row[2] !== formatCurrency(0))} />}
      {book === 'gst' && <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center"><p className="text-sm font-semibold text-neutral-900">GST report is ready for GST-enabled vouchers</p><p className="mt-2 text-xs leading-5 text-neutral-500">Current vouchers do not store GSTIN, tax rate, taxable value or invoice line items yet, so no GST amount is calculated.</p></div>}
      <div className="rounded-2xl border border-neutral-200 bg-white p-3">
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Choose a book</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tabs.map((tab) => { const Icon = tab.icon; return <button key={tab.id} type="button" onClick={() => setBook(tab.id)} className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold ${book === tab.id ? 'bg-primary-600 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}><Icon className="h-3.5 w-3.5" />{tab.label}</button> })}</div>
      </div>
    </div>
  )
}

function ReportTable({ title, headers, rows, footer }: { title: string; headers: string[]; rows: string[][]; footer?: string[] }) {
  return <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"><div className="border-b border-neutral-100 bg-neutral-50 px-4 py-3"><h3 className="text-sm font-semibold text-neutral-900">{title}</h3></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-neutral-100 text-xs text-neutral-500">{headers.map((header) => <th key={header} className="px-4 py-3 font-semibold">{header}</th>)}</tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={headers.length} className="px-4 py-8 text-center text-sm text-neutral-500">No entries</td></tr> : rows.map((row, index) => <tr key={`${row.join('-')}-${index}`} className="border-b border-neutral-50 last:border-0">{row.map((cell, cellIndex) => <td key={`${cell}-${cellIndex}`} className="px-4 py-3 text-neutral-700">{cell}</td>)}</tr>)}</tbody>{footer && <tfoot><tr className="bg-neutral-50 font-semibold">{footer.map((cell, index) => <td key={`${cell}-${index}`} className="px-4 py-3 text-neutral-900">{cell}</td>)}</tr></tfoot>}</table></div></div>
}
