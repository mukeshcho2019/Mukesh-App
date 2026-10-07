import { useState, useMemo } from 'react'
import { Trash2, Pencil, Search } from 'lucide-react'
import type { Transaction, VoucherType } from '../types'
import { formatCurrency, formatDate } from '../types'

interface TransactionListProps {
  transactions: Transaction[]
  onEdit: (tx: Transaction) => void
  onDelete: (id: string) => void
}

const FILTERS: { value: 'all' | VoucherType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'payment', label: 'Payment' },
  { value: 'receipt', label: 'Receipt' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'journal', label: 'Journal' },
]

const VOUCHER_META: Record<VoucherType, { icon: string; color: string; sign: string }> = {
  expense: { icon: '💸', color: 'text-danger-600', sign: '-' },
  income: { icon: '💰', color: 'text-success-600', sign: '+' },
  payment: { icon: '📤', color: 'text-warning-600', sign: '-' },
  receipt: { icon: '📥', color: 'text-primary-600', sign: '+' },
  transfer: { icon: '🔄', color: 'text-neutral-600', sign: '' },
  journal: { icon: '📒', color: 'text-slate-600', sign: '' },
}

export default function TransactionList({ transactions, onEdit, onDelete }: TransactionListProps) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | VoucherType>('all')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      if (filterType !== 'all' && tx.voucher_type !== filterType) return false
      if (search) {
        const catName = tx.category?.name ?? ''
        const ledgerName = tx.ledger?.name ?? ''
        const fromName = tx.from_ledger?.name ?? ''
        const matchSearch =
          tx.description.toLowerCase().includes(search.toLowerCase()) ||
          catName.toLowerCase().includes(search.toLowerCase()) ||
          ledgerName.toLowerCase().includes(search.toLowerCase()) ||
          fromName.toLowerCase().includes(search.toLowerCase()) ||
          String(tx.amount).includes(search)
        if (!matchSearch) return false
      }
      return true
    })
  }, [transactions, search, filterType])

  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {}
    filtered.forEach((tx) => {
      const key = tx.date
      if (!groups[key]) groups[key] = []
      groups[key].push(tx)
    })
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search entries..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 bg-white text-sm text-neutral-900 outline-none focus:border-primary-400 transition-all placeholder:text-neutral-400"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((ft) => (
          <button
            key={ft.value}
            onClick={() => setFilterType(ft.value)}
            className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              filterType === ft.value ? 'bg-primary-600 text-white' : 'bg-white text-neutral-500 border border-neutral-200'
            }`}
          >
            {ft.label}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-neutral-500">No entries found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, txs]) => {
            const dayIn = txs.filter((t) => t.voucher_type === 'income' || t.voucher_type === 'receipt').reduce((s, t) => s + t.amount, 0)
            const dayOut = txs.filter((t) => t.voucher_type === 'expense' || t.voucher_type === 'payment').reduce((s, t) => s + t.amount, 0)
            return (
              <div key={date}>
                <div className="flex items-center justify-between px-1 mb-2">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{formatDate(date)}</p>
                  <div className="flex items-center gap-3 text-xs">
                    {dayIn > 0 && <span className="text-success-600 font-medium">+{formatCurrency(dayIn)}</span>}
                    {dayOut > 0 && <span className="text-danger-600 font-medium">-{formatCurrency(dayOut)}</span>}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                  {txs.map((tx, i) => {
                    const cat = tx.category
                    const vt = tx.voucher_type
                    const meta = VOUCHER_META[vt] ?? VOUCHER_META.expense
                    const isLedger = vt === 'payment' || vt === 'receipt'
                    const isTransfer = vt === 'transfer'
                    const isJournal = vt === 'journal'
                    const title = isLedger
                      ? (tx.ledger?.name ?? 'Ledger')
                      : isTransfer
                      ? `${tx.from_ledger?.name ?? ''} → ${tx.ledger?.name ?? ''}`
                      : isJournal
                      ? `${tx.from_ledger?.name ?? 'Debit'} → ${tx.ledger?.name ?? 'Credit'}`
                      : (cat?.name ?? 'Other')
                    const icon = isLedger || isTransfer ? meta.icon : (cat?.icon ?? meta.icon)

                    return (
                      <div key={tx.id} className={`flex items-center gap-3 p-3 ${i > 0 ? 'border-t border-neutral-100' : ''} group`}>
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                          style={{ backgroundColor: (cat?.color ?? '#94a3b8') + '20' }}>
                          {icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{title}</p>
                          {tx.description && <p className="text-xs text-neutral-400 truncate">{tx.description}</p>}
                          <div className="flex items-center gap-2 mt-0.5">
                            {tx.from_ledger && (
                              <span className="text-[10px] text-neutral-400">{tx.from_ledger.icon} {tx.from_ledger.name}</span>
                            )}
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium uppercase">{vt}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-sm font-semibold ${meta.color}`}>{meta.sign}{formatCurrency(tx.amount)}</span>
                          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => onEdit(tx)} className="w-7 h-7 rounded-lg hover:bg-neutral-100 flex items-center justify-center">
                              <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                            </button>
                            <button onClick={() => setConfirmDelete(tx.id)} className="w-7 h-7 rounded-lg hover:bg-danger-50 flex items-center justify-center">
                              <Trash2 className="w-3.5 h-3.5 text-danger-500" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-xs w-full animate-scale-in">
            <h3 className="text-base font-bold text-neutral-900 mb-1">Delete entry?</h3>
            <p className="text-sm text-neutral-500 mb-4">This entry will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null) }} className="flex-1 py-2.5 rounded-lg bg-danger-600 text-white text-sm font-medium hover:bg-danger-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
