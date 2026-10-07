import { useState, useEffect, useRef } from 'react'
import { X, Check, Plus, Info, Search, ChevronDown } from 'lucide-react'
import type { Category, Transaction, TransactionInput, Account, Ledger, VoucherType, LedgerType, LedgerGroup } from '../types'
import { VOUCHER_TYPES, LEDGER_TYPES, LEDGER_GROUPS, LEDGER_ICONS, LEDGER_COLORS } from '../types'

const CATEGORY_ICONS = ['💰', '🍔', '🚗', '🏠', '🛒', '💊', '🎓', '🎮', '✈️', '📱', '💡', '👕', '🎁', '💼', '📈', '💵', '🔧', '🐾', '📚', '☕']
const CATEGORY_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16']

interface TransactionFormProps {
  categories: Category[]
  accounts: Account[]
  ledgers: Ledger[]
  selectedAccountId: string | null
  editingTransaction: Transaction | null
  onSave: (input: TransactionInput) => void
  onClose: () => void
  onAddCategory: (name: string, type: 'income' | 'expense', icon: string, color: string) => Promise<Category>
  onCreateLedger: (input: { name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }) => Promise<Ledger>
}

interface LedgerPickerProps {
  label: string
  ledgers: Ledger[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  excludeId?: string | null
  onCreateLedger: (input: { name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }) => Promise<Ledger>
  defaultType?: LedgerType
  defaultGroup?: LedgerGroup
  error?: string
  hint?: string
}

function LedgerPicker({ label, ledgers, selectedId, onSelect, excludeId, onCreateLedger, defaultType = 'party', defaultGroup = 'vendor', error, hint }: LedgerPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newType, setNewType] = useState<LedgerType>(defaultType)
  const [newGroup, setNewGroup] = useState<LedgerGroup>(defaultGroup)
  const [newIcon, setNewIcon] = useState(LEDGER_ICONS[0])
  const [newColor, setNewColor] = useState(LEDGER_COLORS[0])
  const [newOpening, setNewOpening] = useState('')
  const [busy, setBusy] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const available = ledgers.filter((l) => l.id !== excludeId)
  const filtered = available.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
  const selected = ledgers.find((l) => l.id === selectedId)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setShowCreate(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setBusy(true)
    try {
      const ledger = await onCreateLedger({
        name: newName.trim(),
        type: newType,
        opening_balance: parseFloat(newOpening) || 0,
        icon: newIcon,
        color: newColor,
        ledger_group: newGroup,
      })
      onSelect(ledger.id)
      setOpen(false)
      setShowCreate(false)
      setNewName('')
      setNewOpening('')
      setNewIcon(LEDGER_ICONS[0])
      setNewColor(LEDGER_COLORS[0])
    } catch {
      // handled by parent
    } finally {
      setBusy(false)
    }
  }

  const startCreate = () => {
    setShowCreate(true)
    setNewName(search)
    setSearch('')
  }

  return (
    <div ref={containerRef}>
      <label className="text-xs font-medium text-neutral-600 mb-1.5 block">{label}</label>
      {available.length === 0 && !showCreate ? (
        <div className="space-y-2">
          <p className="text-xs text-neutral-400 px-3 py-2.5 rounded-xl bg-neutral-50 border border-neutral-200">
            No ledgers available. Create one to get started.
          </p>
          <button type="button" onClick={startCreate} className="flex items-center gap-1.5 text-xs text-primary-600 font-medium hover:text-primary-700">
            <Plus className="w-3.5 h-3.5" /> Create New Ledger
          </button>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => { setOpen(!open); setShowCreate(false) }}
            className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl border bg-white text-sm transition-all ${
              error ? 'border-danger-400' : selected ? 'border-primary-300' : 'border-neutral-200 hover:border-neutral-300'
            }`}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected ? (
                <>
                  <span className="text-lg flex-shrink-0">{selected.icon}</span>
                  <span className="truncate text-neutral-900 font-medium">{selected.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 capitalize flex-shrink-0">{selected.type}</span>
                </>
              ) : (
                <span className="text-neutral-400">Search or select a ledger…</span>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-neutral-200 shadow-xl z-20 overflow-hidden animate-scale-in">
              {!showCreate ? (
                <>
                  <div className="relative p-2 border-b border-neutral-100">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type to search ledgers…"
                      autoFocus
                      className="w-full pl-9 pr-3 py-2 text-sm text-neutral-900 outline-none rounded-lg bg-neutral-50"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-neutral-400 mb-2">No matching ledgers found</p>
                        <button type="button" onClick={startCreate} className="inline-flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700">
                          <Plus className="w-3.5 h-3.5" /> Create "{search || 'New Ledger'}"
                        </button>
                      </div>
                    ) : (
                      filtered.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => { onSelect(l.id); setOpen(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-neutral-50 transition-colors ${selectedId === l.id ? 'bg-primary-50' : ''}`}
                        >
                          <span className="text-lg flex-shrink-0">{l.icon}</span>
                          <span className="flex-1 min-w-0 truncate text-sm text-neutral-900 font-medium">{l.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500 capitalize flex-shrink-0">{l.type}</span>
                          {selectedId === l.id && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
                        </button>
                      ))
                    )}
                  </div>
                  <button type="button" onClick={startCreate} className="w-full flex items-center gap-2 px-3 py-3 text-sm text-primary-600 font-medium hover:bg-primary-50 border-t border-neutral-100">
                    <Plus className="w-4 h-4" /> Create New Ledger
                  </button>
                </>
              ) : (
                <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700">New Ledger</span>
                    <button type="button" onClick={() => setShowCreate(false)} className="text-xs text-neutral-400 hover:text-neutral-600">Back to list</button>
                  </div>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ledger name (e.g. Ramesh, HDFC Bank)"
                    autoFocus
                    maxLength={50}
                    className="w-full px-3 py-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-sm outline-none focus:border-primary-400"
                  />
                  <div className="grid grid-cols-4 gap-1.5">
                    {LEDGER_TYPES.map((lt) => (
                      <button key={lt.value} type="button" onClick={() => { setNewType(lt.value); if (lt.value === 'bank') setNewGroup('bank'); if (lt.value === 'cash') setNewGroup('cash') }}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-lg border transition-all ${newType === lt.value ? 'border-primary-400 bg-primary-50 scale-105' : 'border-neutral-200'}`}>
                        <span className="text-base">{lt.icon}</span>
                        <span className="text-[9px] text-neutral-600">{lt.label}</span>
                      </button>
                    ))}
                  </div>
                  <select value={newGroup} onChange={(e) => setNewGroup(e.target.value as LedgerGroup)} className="w-full px-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm outline-none focus:border-primary-400">
                    {LEDGER_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-400">₹</span>
                    <input type="number" inputMode="decimal" value={newOpening} onChange={(e) => setNewOpening(e.target.value)} placeholder="Opening balance" className="w-full pl-8 pr-3 py-2 rounded-lg border border-neutral-200 bg-neutral-50 text-sm outline-none focus:border-primary-400" />
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {LEDGER_ICONS.slice(0, 12).map((ic) => (
                      <button key={ic} type="button" onClick={() => setNewIcon(ic)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-base border ${newIcon === ic ? 'border-primary-400 bg-primary-50 scale-110' : 'border-neutral-200'}`}>{ic}</button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {LEDGER_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewColor(c)} className={`w-7 h-7 rounded-full border-2 ${newColor === c ? 'border-neutral-900 scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <button type="button" onClick={handleCreate} disabled={!newName.trim() || busy} className="w-full py-2.5 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-50">
                    {busy ? 'Creating…' : 'Create & Select'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {hint && <p className="text-[10px] text-neutral-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-danger-600 mt-1">{error}</p>}
    </div>
  )
}

export default function TransactionForm({
  categories,
  accounts,
  ledgers,
  selectedAccountId,
  editingTransaction,
  onSave,
  onClose,
  onAddCategory,
  onCreateLedger,
}: TransactionFormProps) {
  const [voucherType, setVoucherType] = useState<VoucherType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [ledgerId, setLedgerId] = useState<string | null>(null)
  const [fromLedgerId, setFromLedgerId] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })
  const [accountId, setAccountId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState(CATEGORY_ICONS[0])
  const [newCatColor, setNewCatColor] = useState(CATEGORY_COLORS[0])

  const txType = voucherType === 'income' || voucherType === 'receipt' ? 'income' : voucherType === 'journal' ? 'journal' : 'expense'
  const isLedgerVoucher = voucherType === 'payment' || voucherType === 'receipt'
  const isJournalVoucher = voucherType === 'journal'
  const isTransferVoucher = voucherType === 'transfer'
  const isSimpleVoucher = voucherType === 'income' || voucherType === 'expense'
  const cashBankLedgers = ledgers.filter((l) => l.type === 'bank' || l.type === 'cash')
  const sourceLedgers = isJournalVoucher ? ledgers : cashBankLedgers
  const partyLedgers = ledgers.filter((l) => l.type === 'party' || l.type === 'investment')
  const destinationLedgers = (isJournalVoucher ? ledgers : cashBankLedgers).filter((l) => l.id !== fromLedgerId)

  useEffect(() => {
    if (editingTransaction) {
      setVoucherType(editingTransaction.voucher_type ?? 'journal')
      setAmount(String(editingTransaction.amount))
      setCategoryId(editingTransaction.category_id)
      setLedgerId(editingTransaction.ledger_id)
      setFromLedgerId(editingTransaction.from_ledger_id)
      setDescription(editingTransaction.description)
      setDate(editingTransaction.date)
      setAccountId(editingTransaction.account_id)
    } else {
      setAccountId(selectedAccountId)
      if (cashBankLedgers.length > 0) {
        setFromLedgerId(cashBankLedgers[0].id)
      }
    }
  }, [editingTransaction, selectedAccountId])

  const filteredCategories = txType === 'journal' ? [] : categories.filter((c) => c.type === txType)

  useEffect(() => {
    if (filteredCategories.length > 0 && !filteredCategories.find((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0].id)
    }
  }, [filteredCategories.map((c) => c.id).join(','), voucherType])

  useEffect(() => {
    if (!fromLedgerId && cashBankLedgers.length > 0) {
      setFromLedgerId(cashBankLedgers[0].id)
    }
  }, [cashBankLedgers.length])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}
    const amt = parseFloat(amount)
    if (!amount || isNaN(amt) || amt <= 0) {
      newErrors.amount = 'Please enter a valid amount'
    }
    if ((isLedgerVoucher || isJournalVoucher || isTransferVoucher) && !ledgerId) {
      newErrors.ledger = 'Please select a ledger'
    }
    if (isTransferVoucher && ledgerId === fromLedgerId) {
      newErrors.ledger = 'Source and destination must be different'
    }
    if (!fromLedgerId) {
      newErrors.fromLedger = 'Please select a bank or cash ledger'
    }
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    onSave({
      amount: amt,
      type: txType,
      voucher_type: voucherType,
      category_id: isLedgerVoucher || isJournalVoucher || isTransferVoucher ? null : categoryId,
      ledger_id: isLedgerVoucher || isJournalVoucher || isTransferVoucher ? ledgerId : null,
      from_ledger_id: fromLedgerId,
      description: description.trim(),
      date,
      account_id: accountId,
      status: 'settled',
    })
  }

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return
    try {
      const cat = await onAddCategory(newCatName.trim(), txType === 'income' ? 'income' : 'expense', newCatIcon, newCatColor)
      setCategoryId(cat.id)
      setShowAddCategory(false)
      setNewCatName('')
      setNewCatIcon(CATEGORY_ICONS[0])
      setNewCatColor(CATEGORY_COLORS[0])
    } catch {
      // error handled in parent
    }
  }

  const selectedAccount = accounts.find((a) => a.id === accountId)
  const activeVT = VOUCHER_TYPES.find((v) => v.value === voucherType)
  const selectedFromLedger = ledgers.find((l) => l.id === fromLedgerId)

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="sticky top-0 bg-white rounded-t-3xl pt-3 pb-2 px-4 z-10 border-b border-neutral-100">
          <div className="w-10 h-1 bg-neutral-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">
              {editingTransaction ? 'Edit Entry' : 'New Entry'}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
            >
              <X className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-4 pb-6 space-y-4 pt-4">
          {/* Voucher Type */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-100 rounded-xl">
            {VOUCHER_TYPES.map((vt) => (
              <button
                key={vt.value}
                type="button"
                onClick={() => { setVoucherType(vt.value); setLedgerId(null); setFromLedgerId(null); setErrors({}) }}
                className={`flex flex-col items-center gap-0.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  voucherType === vt.value ? 'bg-white shadow-sm' : 'text-neutral-500'
                }`}
                style={voucherType === vt.value ? { color: vt.color } : undefined}
              >
                <span className="text-lg leading-none">{vt.icon}</span>
                <span className="mt-0.5">{vt.label}</span>
              </button>
            ))}
          </div>

          {/* Helper hint */}
          {activeVT && (
            <div className="flex items-start gap-2 px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200">
              <Info className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-neutral-500 leading-snug">{activeVT.desc}</p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Amount</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-neutral-400">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className={`w-full pl-10 pr-4 py-3 text-2xl font-bold text-neutral-900 rounded-xl border bg-neutral-50 outline-none transition-all ${
                  errors.amount ? 'border-danger-400' : 'border-neutral-200 focus:border-primary-400'
                }`}
              />
            </div>
            {errors.amount && <p className="text-xs text-danger-600 mt-1">{errors.amount}</p>}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[100, 500, 1000, 5000, 10000].map((q) => (
                <button key={q} type="button" onClick={() => setAmount(String(q))}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 text-xs font-medium text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-all active:scale-95">
                  ₹{q.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Account */}
          {selectedAccount && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary-50 border border-primary-100">
              <span className="text-lg">{selectedAccount.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary-600 font-medium">Account</p>
                <p className="text-sm text-primary-800 font-medium truncate">{selectedAccount.name}</p>
              </div>
            </div>
          )}

          {/* FROM Ledger — searchable picker */}
          <LedgerPicker
            label={isJournalVoucher ? 'Debit Ledger' : voucherType === 'payment' ? 'Source Account (Bank/Cash)' : 'Receiving Account (Bank/Cash)'}
            ledgers={sourceLedgers}
            selectedId={fromLedgerId}
            onSelect={setFromLedgerId}
            onCreateLedger={onCreateLedger}
            defaultType="bank"
            defaultGroup="bank"
            error={errors.fromLedger}
            hint={selectedFromLedger ? `${selectedFromLedger.icon} ${selectedFromLedger.name} will be ${isJournalVoucher || voucherType === 'payment' || voucherType === 'expense' ? 'debited' : 'credited'}` : undefined}
          />

          {/* TO Ledger for transfer/journal */}
          {(isTransferVoucher || isJournalVoucher) && (
            <LedgerPicker
              label={isJournalVoucher ? 'Credit Ledger' : 'Destination Account (Bank/Cash)'}
              ledgers={destinationLedgers}
              selectedId={ledgerId}
              onSelect={setLedgerId}
              onCreateLedger={onCreateLedger}
              defaultType="bank"
              defaultGroup="bank"
              error={errors.ledger}
            />
          )}

          {/* Party Ledger for payment/receipt */}
          {isLedgerVoucher && (
            <LedgerPicker
              label={voucherType === 'payment' ? 'Payee (Party/Ledger)' : 'Payer (Party/Ledger)'}
              ledgers={partyLedgers}
              selectedId={ledgerId}
              onSelect={setLedgerId}
              onCreateLedger={onCreateLedger}
              defaultType="party"
              defaultGroup="vendor"
              error={errors.ledger}
            />
          )}

          {/* Category — only for expense/income */}
          {isSimpleVoucher && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-neutral-600">Category</label>
                <button
                  type="button"
                  onClick={() => setShowAddCategory(true)}
                  className="flex items-center gap-1 text-xs text-primary-600 font-medium hover:text-primary-700"
                >
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border transition-all ${
                      categoryId === cat.id
                        ? 'border-primary-400 bg-primary-50 scale-105'
                        : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <span className="text-[10px] text-neutral-600 text-center leading-tight line-clamp-2">{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all"
            />
          </div>

          {/* Remark */}
          <div>
            <label className="text-xs font-medium text-neutral-600 mb-1.5 block">
              Remark <span className="text-neutral-400">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a note..."
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all placeholder:text-neutral-400"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            {editingTransaction ? 'Update' : 'Save'} Entry
          </button>
        </form>

        {showAddCategory && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowAddCategory(false)} />
            <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full animate-scale-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-neutral-900">Add Category</h2>
                <button onClick={() => setShowAddCategory(false)} className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center">
                  <X className="w-4 h-4 text-neutral-600" />
                </button>
              </div>
              <div className="space-y-4">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="Category name..."
                  autoFocus
                  maxLength={30}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all"
                />
                <div className="grid grid-cols-7 gap-2 max-h-32 overflow-y-auto">
                  {CATEGORY_ICONS.map((ic) => (
                    <button key={ic} type="button" onClick={() => setNewCatIcon(ic)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border transition-all ${newCatIcon === ic ? 'border-primary-400 bg-primary-50 scale-110' : 'border-neutral-200 bg-white'}`}>
                      {ic}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORY_COLORS.map((c) => (
                    <button key={c} type="button" onClick={() => setNewCatColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${newCatColor === c ? 'border-neutral-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={handleAddCategory} disabled={!newCatName.trim()}
                  className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 disabled:opacity-50">
                  <Check className="w-5 h-5" /> Add Category
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
