import { useState, useMemo } from 'react'
import { Plus, X, Check, ChevronLeft, Trash2, Pencil, BookOpen, TrendingUp, TrendingDown, FileDown, Search } from 'lucide-react'
import { openLedgerPdf } from '../lib/printReport'
import type { Ledger, Transaction, LedgerType, LedgerGroup } from '../types'
import { formatCurrency, formatDate, ledgerEffect, fromLedgerEffect, computeCashLedgerBalance, computePartyLedgerBalance, LEDGER_TYPES, LEDGER_GROUPS, LEDGER_ICONS, LEDGER_COLORS } from '../types'

interface LedgerViewProps {
  ledgers: Ledger[]
  transactions: Transaction[]
  onCreateLedger: (input: { name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }) => Promise<Ledger>
  onUpdateLedger: (id: string, input: Partial<{ name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }>) => Promise<Ledger>
  onDeleteLedger: (id: string) => Promise<void>
  onEditTransaction: (tx: Transaction) => void
}

export default function LedgerView({
  ledgers,
  transactions,
  onCreateLedger,
  onUpdateLedger,
  onDeleteLedger,
  onEditTransaction,
}: LedgerViewProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingLedger, setEditingLedger] = useState<Ledger | null>(null)
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<LedgerType>('party')
  const [ledgerGroup, setLedgerGroup] = useState<LedgerGroup>('vendor')
  const [openingBalance, setOpeningBalance] = useState('')
  const [icon, setIcon] = useState(LEDGER_ICONS[0])
  const [color, setColor] = useState(LEDGER_COLORS[0])
  const [searchTerm, setSearchTerm] = useState('')

  const getLedgerBalance = (l: Ledger): number => {
    if (l.type === 'bank' || l.type === 'cash') {
      return computeCashLedgerBalance(l.id, l.opening_balance || 0, transactions)
    }
    return computePartyLedgerBalance(l.id, l.opening_balance || 0, transactions)
  }

  // For bank/cash ledgers: show transactions where from_ledger_id = this ledger OR transfer tx where ledger_id = this ledger (incoming transfer)
  // For party/investment ledgers: show transactions where ledger_id = this ledger
  const ledgerTransactions = useMemo(() => {
    if (!selectedLedger) return []
    if (selectedLedger.type === 'bank' || selectedLedger.type === 'cash') {
      return transactions
        .filter((t) => t.from_ledger_id === selectedLedger.id || (t.voucher_type === 'transfer' && t.ledger_id === selectedLedger.id))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    }
    return transactions
      .filter((t) => t.ledger_id === selectedLedger.id)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
  }, [selectedLedger, transactions])

  const openAdd = () => {
    setEditingLedger(null)
    setName('')
    setType('party')
    setLedgerGroup('vendor')
    setOpeningBalance('')
    setIcon(LEDGER_ICONS[0])
    setColor(LEDGER_COLORS[0])
    setShowModal(true)
  }

  const openEdit = (l: Ledger) => {
    setEditingLedger(l)
    setName(l.name)
    setType(l.type)
    setLedgerGroup(l.ledger_group ?? (l.type === 'bank' ? 'bank' : l.type === 'cash' ? 'cash' : 'vendor'))
    setOpeningBalance(String(l.opening_balance || 0))
    setIcon(l.icon)
    setColor(l.color)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    const input = {
      name: name.trim(),
      type,
      opening_balance: parseFloat(openingBalance) || 0,
      icon,
      color,
      ledger_group: ledgerGroup,
    }
    try {
      if (editingLedger) {
        await onUpdateLedger(editingLedger.id, input)
      } else {
        await onCreateLedger(input)
      }
      setShowModal(false)
    } catch {
      // handled by parent
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await onDeleteLedger(id)
      setConfirmDelete(null)
      setSelectedLedger(null)
    } catch {
      // handled by parent
    }
  }

  const groupedLedgers = useMemo(() => {
    const groups: Record<string, Ledger[]> = {}
    const normalizedSearch = searchTerm.trim().toLowerCase()
    ledgers.filter((ledger) => ledger.name.toLowerCase().includes(normalizedSearch)).forEach((l) => {
      const group = l.ledger_group ?? (l.type === 'bank' ? 'bank' : l.type === 'cash' ? 'cash' : 'other')
      if (!groups[group]) groups[group] = []
      groups[group].push(l)
    })
    return groups
  }, [ledgers, searchTerm])

  if (selectedLedger) {
    const bal = getLedgerBalance(selectedLedger)
    const isCashType = selectedLedger.type === 'bank' || selectedLedger.type === 'cash'

    return (
      <div className="space-y-4 animate-fade-in">
        <button
          onClick={() => setSelectedLedger(null)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 font-medium hover:text-neutral-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Ledgers
        </button>

        <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-5 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                style={{ backgroundColor: (selectedLedger.color ?? '#94a3b8') + '30' }}
              >
                {selectedLedger.icon}
              </div>
              <div>
                <p className="text-sm text-neutral-400 font-medium capitalize">{selectedLedger.type}</p>
                <h2 className="text-xl font-bold">{selectedLedger.name}</h2>
              </div>
            </div>
            <p className="text-xs text-neutral-400 mt-2">{isCashType ? 'Current Balance' : 'Balance'}</p>
            <p className={`text-3xl font-bold mt-0.5 ${isCashType ? (bal >= 0 ? 'text-success-400' : 'text-danger-400') : (bal >= 0 ? 'text-success-400' : 'text-warning-400')}`}>
              {formatCurrency(isCashType ? bal : Math.abs(bal))}
            </p>
            {!isCashType && (
              <p className="text-xs mt-0.5">
                {bal > 0
                  ? <span className="text-success-400">Receivable — They owe you</span>
                  : bal < 0
                  ? <span className="text-warning-400">Payable — You owe them</span>
                  : <span className="text-neutral-400">Clear — No outstanding balance</span>}
              </p>
            )}
            {isCashType && (
              <p className="text-xs mt-0.5 text-neutral-400">
                Opening: {formatCurrency(selectedLedger.opening_balance || 0)}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => openEdit(selectedLedger)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium hover:bg-white/20 transition-colors"
              >
                <Pencil className="w-3 h-3" /> Edit
              </button>
              <button
                onClick={() => openLedgerPdf(selectedLedger, transactions)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 text-xs font-medium hover:bg-white/20 transition-colors"
              >
                <FileDown className="w-3 h-3" /> Open PDF
              </button>
              <button
                onClick={() => setConfirmDelete(selectedLedger.id)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-danger-500/20 text-danger-300 text-xs font-medium hover:bg-danger-500/30 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-900">
              {isCashType ? 'Bank/Cash Entries' : 'Ledger Entries'}
            </h3>
          </div>
          {ledgerTransactions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-neutral-500">No entries recorded for this ledger.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {ledgerTransactions.map((tx) => {
                if (isCashType) {
                  // For bank/cash ledger: show from_ledger effect, or incoming transfer
                  const isIncomingTransfer = tx.voucher_type === 'transfer' && tx.ledger_id === selectedLedger.id
                  const effect = isIncomingTransfer ? tx.amount : fromLedgerEffect(tx)
                  const isCredit = effect > 0
                  const title = tx.voucher_type === 'transfer'
                    ? isIncomingTransfer
                      ? `Transfer from ${tx.from_ledger?.name ?? '???'}`
                      : `Transfer to ${tx.ledger?.name ?? '???'}`
                    : tx.voucher_type === 'payment' || tx.voucher_type === 'receipt'
                    ? (tx.ledger?.name ?? 'Ledger')
                    : (tx.category?.name ?? tx.voucher_type)
                  return (
                    <button
                      key={tx.id}
                      onClick={() => onEditTransaction(tx)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-success-50' : 'bg-danger-50'}`}>
                        {isCredit ? <TrendingUp className="w-4 h-4 text-success-600" /> : <TrendingDown className="w-4 h-4 text-danger-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-neutral-900 capitalize truncate">{title}</p>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium uppercase">{tx.voucher_type}</span>
                        </div>
                        <p className="text-xs text-neutral-400">{formatDate(tx.date)}{tx.description ? ` — ${tx.description}` : ''}</p>
                      </div>
                      <span className={`text-sm font-bold flex-shrink-0 ${isCredit ? 'text-success-600' : 'text-danger-600'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(Math.abs(effect))}
                      </span>
                    </button>
                  )
                }
                // For party/investment ledger: show ledger effect
                const isPayment = tx.voucher_type === 'payment'
                const effect = ledgerEffect(tx)
                return (
                  <button
                    key={tx.id}
                    onClick={() => onEditTransaction(tx)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors text-left"
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPayment ? 'bg-success-50' : 'bg-warning-500/10'}`}>
                      {isPayment ? <TrendingUp className="w-4 h-4 text-success-600" /> : <TrendingDown className="w-4 h-4 text-warning-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-900 capitalize truncate">
                          {isPayment ? 'Payment (Dr)' : 'Receipt (Cr)'}
                        </p>
                        {tx.from_ledger && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 font-medium">
                            {tx.from_ledger.icon} {tx.from_ledger.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">{formatDate(tx.date)}{tx.description ? ` — ${tx.description}` : ''}</p>
                    </div>
                    <span className={`text-sm font-bold flex-shrink-0 ${effect >= 0 ? 'text-success-600' : 'text-warning-600'}`}>
                      {effect >= 0 ? '+' : ''}{formatCurrency(effect)}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {confirmDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
            <div className="relative bg-white rounded-2xl p-5 max-w-xs w-full animate-scale-in">
              <h3 className="text-base font-bold text-neutral-900 mb-1">Delete ledger?</h3>
              <p className="text-sm text-neutral-500 mb-4">This ledger will be permanently deleted.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
                <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-lg bg-danger-600 text-white text-sm font-medium hover:bg-danger-700">Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-neutral-900">Ledgers</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Ledger
        </button>
      </div>

      {ledgers.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7 text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-500 mb-1">No ledgers available</p>
          <p className="text-xs text-neutral-400 mb-4">Create a ledger to start recording entries</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            Create Ledger
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search ledgers" className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-9 pr-4 text-sm text-neutral-900 outline-none transition-all placeholder:text-neutral-400 focus:border-primary-400" />
          </div>
          {Object.keys(groupedLedgers).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white py-10 text-center text-sm text-neutral-500">No matching ledgers found</div>
          ) : LEDGER_GROUPS.map((lg) => {
            const group = groupedLedgers[lg.value]
            if (!group || group.length === 0) return null
            return (
              <div key={lg.value}>
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 px-1">
                  {lg.label}
                </p>
                <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
                  <div className="divide-y divide-neutral-100">
                    {group.map((l) => {
                      const bal = getLedgerBalance(l)
                      const isCashType = l.type === 'bank' || l.type === 'cash'
                      return (
                        <button
                          key={l.id}
                          onClick={() => setSelectedLedger(l)}
                          className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors text-left group"
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: (l.color ?? '#94a3b8') + '20' }}
                          >
                            {l.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-neutral-900 truncate">{l.name}</p>
                            <p className="text-xs text-neutral-400">
                              {l.opening_balance ? `Opening: ${formatCurrency(l.opening_balance)}` : 'No opening balance'}
                            </p>
                          </div>
                          {isCashType ? (
                            <span className={`text-sm font-bold ${bal >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>
                              {formatCurrency(bal)}
                            </span>
                          ) : (
                            <div className="text-right">
                              <span className={`text-sm font-bold ${bal > 0 ? 'text-success-600' : bal < 0 ? 'text-warning-600' : 'text-neutral-900'}`}>
                                {formatCurrency(Math.abs(bal))}
                              </span>
                              {bal !== 0 && (
                                <p className="text-[9px] text-neutral-400">{bal > 0 ? 'Receivable' : 'Payable'}</p>
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full animate-scale-in max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900">
                {editingLedger ? 'Edit Ledger' : 'New Ledger'}
              </h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Ledger Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh, HDFC Bank, Mutual Fund..."
                  autoFocus
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all placeholder:text-neutral-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {LEDGER_TYPES.map((lt) => (
                    <button
                      key={lt.value}
                      type="button"
                      onClick={() => { setType(lt.value); if (lt.value === 'bank') setLedgerGroup('bank'); if (lt.value === 'cash') setLedgerGroup('cash'); if (lt.value === 'party' && (ledgerGroup === 'bank' || ledgerGroup === 'cash')) setLedgerGroup('vendor') }}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border transition-all ${
                        type === lt.value ? 'border-primary-400 bg-primary-50 scale-105' : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      <span className="text-lg">{lt.icon}</span>
                      <span className="text-[10px] text-neutral-600">{lt.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Group</label>
                  <select value={ledgerGroup} onChange={(event) => setLedgerGroup(event.target.value as LedgerGroup)} className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all">
                    {LEDGER_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">Income and expense ledgers do not appear in receivables or payables. Vendor and loan balances are shown there.</p>
                </div>
                {(type === 'bank' || type === 'cash') && (
                  <p className="text-[11px] text-neutral-400 mt-1.5">
                    {type === 'bank' ? 'This bank ledger will appear under Bank Assets.' : 'This cash ledger will appear under Cash Assets.'}
                  </p>
                )}
                {(type === 'party' || type === 'investment') && (
                  <p className="text-[11px] text-neutral-400 mt-1.5">
                    {type === 'party' ? 'Payments and receipts update Receivables and Payables.' : 'This ledger will appear in Total Investments.'}
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
                  Opening Balance <span className="text-neutral-400">(optional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-neutral-400">₹</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    placeholder="0"
                    className="w-full pl-9 pr-4 py-3 text-lg font-bold text-neutral-900 rounded-xl border border-neutral-200 bg-neutral-50 outline-none focus:border-primary-400 transition-all"
                  />
                </div>
                {(type === 'party' || type === 'investment') && (
                  <p className="text-[10px] text-neutral-400 mt-1">
                    Positive = they owe you (Receivable), Negative = you owe them (Payable)
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Icon</label>
                <div className="grid grid-cols-9 gap-2 max-h-24 overflow-y-auto">
                  {LEDGER_ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setIcon(ic)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border transition-all ${icon === ic ? 'border-primary-400 bg-primary-50 scale-110' : 'border-neutral-200 bg-white hover:border-neutral-300'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Color</label>
                <div className="flex gap-2 flex-wrap">
                  {LEDGER_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-neutral-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button
                onClick={handleSave}
                disabled={!name.trim()}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5" />
                {editingLedger ? 'Update' : 'Create'} Ledger
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && !selectedLedger && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-xs w-full animate-scale-in">
            <h3 className="text-base font-bold text-neutral-900 mb-1">Delete ledger?</h3>
            <p className="text-sm text-neutral-500 mb-4">This ledger will be permanently deleted.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Cancel</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-lg bg-danger-600 text-white text-sm font-medium hover:bg-danger-700">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
