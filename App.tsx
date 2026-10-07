import { useState, useEffect, useCallback, useRef } from 'react'
import { Wallet, Plus, BarChart3, List, ChevronDown, Check, X, Pencil, FileText, BookOpen, LogOut, KeyRound } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import type { Transaction, Category, Account, Ledger, TransactionInput, LedgerType, LedgerGroup } from './types'
import {
  fetchTransactions,
  fetchCategories,
  fetchAccounts,
  fetchLedgers,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createAccount,
  updateAccount,
  createCategory,
  createLedger,
  updateLedger,
  deleteLedger,
  createAccountAccessCode,
  claimAccountAccess,
} from './services/transactions'
import Dashboard from './components/Dashboard'
import TransactionForm from './components/TransactionForm'
import TransactionList from './components/TransactionList'
import MonthlyReport from './components/MonthlyReport'
import BalanceSheet from './components/BalanceSheet'
import LedgerView from './components/LedgerView'
import AuthScreen from './components/AuthScreen'
import { claimLegacyWorkspace } from './services/transactions'

type View = 'dashboard' | 'transactions' | 'report' | 'balance-sheet' | 'ledgers'

const ALL_ACCOUNTS = 'all'

const ACCOUNT_ICONS = ['👤', '🧑', '👨', '👩', '👦', '👧', '👴', '👵', '🏠', '💼', '🏦', '💵', '🛵', '🏪']
const ACCOUNT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export default function App() {
  const [view, setView] = useState<View>('dashboard')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [ledgers, setLedgers] = useState<Ledger[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>(ALL_ACCOUNTS)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [workspaceReady, setWorkspaceReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [showAccountPicker, setShowAccountPicker] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [accessBusy, setAccessBusy] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [accountName, setAccountName] = useState('')
  const [accountIcon, setAccountIcon] = useState(ACCOUNT_ICONS[0])
  const [accountColor, setAccountColor] = useState(ACCOUNT_COLORS[0])
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [showSplash, setShowSplash] = useState(true)
  const splashTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const accountInitialized = useRef(false)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setAuthLoading(false)
    })
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthLoading(false)
    })
    return () => {
      mounted = false
      authSubscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setWorkspaceReady(false)
      return
    }
    let active = true
    claimLegacyWorkspace()
      .catch((cause) => {
        console.error('workspace claim failed', cause)
      })
      .finally(() => {
        if (active) setWorkspaceReady(true)
      })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    splashTimer.current = setTimeout(() => setShowSplash(false), 3000)
    return () => { if (splashTimer.current) clearTimeout(splashTimer.current) }
  }, [])

  const loadData = useCallback(async () => {
    if (!session || !workspaceReady) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [txData, catData, accData, ledgData] = await Promise.all([
        fetchTransactions(),
        fetchCategories(),
        fetchAccounts(),
        fetchLedgers(),
      ])
      setTransactions(txData)
      setCategories(catData)
      setAccounts(accData)
      setLedgers(ledgData)

      const userId = session?.user?.id
      const ownsAny = accData.some((a) => a.user_id === userId)
      if (!accountInitialized.current && !ownsAny && accData.length > 0) {
        setSelectedAccountId(accData[0].id)
      }
      accountInitialized.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data.')
    } finally {
      setLoading(false)
    }
  }, [session, workspaceReady])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSave = async (input: TransactionInput) => {
    try {
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, input)
      } else {
        await createTransaction(input)
      }
      setShowForm(false)
      setEditingTransaction(null)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save changes.')
    }
  }

  const handleEdit = (tx: Transaction) => {
    setEditingTransaction(tx)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id)
      await loadData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete the entry.')
    }
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingTransaction(null)
  }

  const openAddAccount = () => {
    setEditingAccount(null)
    setAccountName('')
    setAccountIcon(ACCOUNT_ICONS[0])
    setAccountColor(ACCOUNT_COLORS[0])
    setShowAccountModal(true)
  }

  const openEditAccount = (acc: Account) => {
    setEditingAccount(acc)
    setAccountName(acc.name)
    setAccountIcon(acc.icon)
    setAccountColor(acc.color)
    setShowAccountModal(true)
  }

  const handleCreateAccessCode = async (accountId: string) => {
    setAccessBusy(true)
    try {
      const code = await createAccountAccessCode(accountId)
      window.prompt('Copy this access code and share it securely:', code)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create an access code.')
    } finally {
      setAccessBusy(false)
    }
  }

  const handleClaimAccessCode = async () => {
    const code = window.prompt('Enter the account access code:')
    if (!code?.trim()) return
    setAccessBusy(true)
    try {
      const accountId = await claimAccountAccess(code)
      await loadData()
      setSelectedAccountId(accountId)
      setShowAccountPicker(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'This access code is invalid or expired.')
    } finally {
      setAccessBusy(false)
    }
  }

  const handleSaveAccount = async () => {
    if (!accountName.trim()) return
    try {
      if (editingAccount) {
        const updated = await updateAccount(editingAccount.id, accountName.trim(), accountIcon, accountColor)
        setAccounts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      } else {
        const acc = await createAccount(accountName.trim(), accountIcon, accountColor)
        setAccounts((prev) => [...prev, acc])
        setSelectedAccountId(acc.id)
      }
      setShowAccountModal(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the account.')
    }
  }

  const handleAddCategory = async (name: string, type: 'income' | 'expense', icon: string, color: string) => {
    try {
      const cat = await createCategory(name, type, icon, color)
      setCategories((prev) => [...prev, cat])
      return cat
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add the category.')
      throw err
    }
  }

  const handleCreateLedger = async (input: { name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }) => {
    const ledgerInput = { ...input, account_id: selectedAccountId === ALL_ACCOUNTS ? (accounts.find((a) => a.user_id === session?.user?.id)?.id ?? accounts[0]?.id ?? null) : selectedAccountId }
    const ledger = await createLedger(ledgerInput)
    setLedgers((prev) => [...prev, ledger])
    return ledger
  }

  const handleUpdateLedger = async (id: string, input: Partial<{ name: string; type: LedgerType; opening_balance: number; icon: string; color: string; ledger_group: LedgerGroup }>) => {
    const updated = await updateLedger(id, input)
    setLedgers((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
    return updated
  }

  const handleDeleteLedger = async (id: string) => {
    await deleteLedger(id)
    setLedgers((prev) => prev.filter((l) => l.id !== id))
    await loadData()
  }

  const accountFilteredTransactions =
    selectedAccountId === ALL_ACCOUNTS
      ? transactions
      : transactions.filter((tx) => tx.account_id === selectedAccountId)

  const accountFilteredLedgers =
    selectedAccountId === ALL_ACCOUNTS
      ? ledgers
      : ledgers.filter((l) => l.account_id === selectedAccountId)

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const accountLabel = selectedAccount
    ? `${selectedAccount.icon} ${selectedAccount.name}`
    : 'All Accounts'

  const navItems: { id: View; label: string; icon: typeof Wallet }[] = [
    { id: 'dashboard', label: 'Home', icon: Wallet },
    { id: 'ledgers', label: 'Ledger', icon: BookOpen },
    { id: 'balance-sheet', label: 'Sheet', icon: FileText },
    { id: 'transactions', label: 'Entries', icon: List },
    { id: 'report', label: 'Report', icon: BarChart3 },
  ]

  if (authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-neutral-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /></div>
  }

  if (!session) {
    return <AuthScreen onAuthenticated={() => undefined} />
  }

  if (!workspaceReady) {
    return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-neutral-50"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-200 border-t-primary-600" /><p className="text-sm text-neutral-500">Securing your workspace…</p></div>
  }

  if (showSplash) {
    const splashName = 'Mukesh Choudhary'
    return (
      <div className="fixed inset-0 z-50 overflow-hidden bg-gradient-to-b from-primary-800 to-primary-900 text-white animate-fade-in">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_15%,rgba(255,255,255,0.08),transparent_34%)]" />
        <div className="relative z-10 flex min-h-full flex-col items-center text-center px-4 pt-[clamp(2.5rem,10vh,5rem)]">
          <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-gold-400/70 bg-white/20 shadow-2xl shadow-blue-950/30 animate-scale-in">
            <img src="/profile-head.png" alt="Mukesh Choudhary" className="h-full w-full object-contain" />
          </div>
          <p className="mt-7 text-sm font-bold tracking-[0.28em] text-gold-400 animate-slide-up">WELCOME BACK</p>
          <h1 className="mt-5 text-[clamp(2.2rem,9vw,3.6rem)] font-black leading-none tracking-tight animate-slide-up">
            <span className="text-white">{splashName}</span>
          </h1>
          <p className="mt-4 text-lg font-medium tracking-[0.22em] text-white/70">WEALTH MANAGEMENT</p>
          <p className="mt-7 max-w-xs text-sm text-white/70">Private accounting workspace</p>
          <div className="mt-9 h-1 w-28 overflow-hidden rounded-full bg-white/25">
            <div className="h-full w-full origin-left rounded-full bg-gold-400" style={{ animation: 'loading 3s ease-in-out forwards' }} />
          </div>
        </div>
        <style>{`@keyframes loading { from { transform: scaleX(0) } to { transform: scaleX(1) } }`}</style>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-gradient-to-b from-primary-900 to-primary-800 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] shadow-lg shadow-primary-900/20">
        <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-gold-400/70 bg-white/10">
              <img src="/profile-head.png" alt="" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white leading-none">Mukesh Choudhary</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold-400 mt-1">Wealth Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setEditingTransaction(null); setShowForm(true) }}
              className="flex items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-sm font-bold text-primary-900 shadow-md shadow-black/20 transition-all hover:bg-gold-500 active:scale-95"
            ><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add</span></button>
            <button type="button" onClick={() => supabase.auth.signOut()} aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/70 transition-colors hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
          </div>
        </div>

        {/* Account Selector */}
        <div className="relative mt-3">
          <button
            onClick={() => setShowAccountPicker(!showAccountPicker)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/15 text-sm text-white hover:bg-white/15 transition-all"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{selectedAccount ? selectedAccount.icon : '📊'}</span>
              <span className="font-medium">{accountLabel}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${showAccountPicker ? 'rotate-180' : ''}`} />
          </button>

          {showAccountPicker && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowAccountPicker(false)} />
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl border border-neutral-200 shadow-xl z-50 overflow-hidden animate-scale-in max-h-[60vh] overflow-y-auto">
                <button
                  onClick={() => {
                    setSelectedAccountId(ALL_ACCOUNTS)
                    setShowAccountPicker(false)
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 text-sm hover:bg-neutral-50 transition-colors ${
                    selectedAccountId === ALL_ACCOUNTS ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-700'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className="text-base">📊</span>
                    All Accounts
                  </span>
                  {selectedAccountId === ALL_ACCOUNTS && <Check className="w-4 h-4 text-primary-600" />}
                </button>
                <div className="border-t border-neutral-100" />
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    className={`w-full flex items-center justify-between px-3.5 py-3 text-sm hover:bg-neutral-50 transition-colors group ${
                      selectedAccountId === acc.id ? 'bg-primary-50 text-primary-700 font-medium' : 'text-neutral-700'
                    }`}
                  >
                    <button
                      onClick={() => {
                        setSelectedAccountId(acc.id)
                        setShowAccountPicker(false)
                      }}
                      className="flex items-center gap-2.5 flex-1 min-w-0"
                    >
                      <span className="text-base">{acc.icon}</span>
                      <span className="truncate">{acc.name}</span>
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openEditAccount(acc)
                          setShowAccountPicker(false)
                        }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:bg-neutral-200 hover:text-neutral-600 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {session.user.id === acc.user_id && <button type="button" disabled={accessBusy} onClick={(event) => { event.stopPropagation(); void handleCreateAccessCode(acc.id) }} className="flex h-7 items-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-50"><KeyRound className="h-3 w-3" /> Share</button>}
                      {selectedAccountId === acc.id && <Check className="w-4 h-4 text-primary-600" />}
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setShowAccountPicker(false)
                    openAddAccount()
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-primary-600 font-medium hover:bg-primary-50 transition-colors border-t border-neutral-100"
                >
                  <Plus className="w-4 h-4" />
                  Add New Account
                </button>
                <button type="button" disabled={accessBusy} onClick={() => void handleClaimAccessCode()} className="w-full flex items-center gap-2.5 px-3.5 py-3 text-sm text-neutral-700 font-medium hover:bg-neutral-50 transition-colors border-t border-neutral-100 disabled:opacity-50">
                  <KeyRound className="w-4 h-4 text-primary-600" />
                  Join with access code
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-3 p-3 rounded-xl bg-danger-50 border border-danger-100 text-danger-700 text-sm animate-slide-up flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-danger-600 font-medium underline flex-shrink-0 ml-2">Dismiss</button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 max-w-2xl mx-auto w-full pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-neutral-500 text-sm">Loading...</p>
          </div>
        ) : view === 'dashboard' ? (
          <Dashboard
            transactions={accountFilteredTransactions}
            allTransactions={accountFilteredTransactions}
            categories={categories}
            accounts={accounts}
            ledgers={accountFilteredLedgers}
            onEdit={handleEdit}
            onAddClick={() => {
              setEditingTransaction(null)
              setShowForm(true)
            }}
            onSeeAll={() => setView('transactions')}
          />
        ) : view === 'ledgers' ? (
          <LedgerView
            ledgers={accountFilteredLedgers}
            transactions={accountFilteredTransactions}
            onCreateLedger={handleCreateLedger}
            onUpdateLedger={handleUpdateLedger}
            onDeleteLedger={handleDeleteLedger}
            onEditTransaction={handleEdit}
          />
        ) : view === 'balance-sheet' ? (
          <BalanceSheet
            transactions={accountFilteredTransactions}
            allTransactions={accountFilteredTransactions}
            accounts={accounts}
            ledgers={accountFilteredLedgers}
          />
        ) : view === 'transactions' ? (
          <TransactionList
            transactions={accountFilteredTransactions}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        ) : view === 'report' ? (
          <MonthlyReport
            transactions={accountFilteredTransactions}
            allTransactions={accountFilteredTransactions}
            categories={categories}
            ledgers={accountFilteredLedgers}
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
        ) : null}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-neutral-200 shadow-[0_-8px_24px_-12px_rgb(19_38_75/0.15)]">
        <div className="max-w-2xl mx-auto flex items-center justify-around px-2 py-2 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = view === item.id
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
                  active ? 'text-primary-800 bg-primary-50' : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'scale-110' : ''} transition-transform`} />
                <span className={`text-[11px] ${active ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Transaction Form Modal */}
      {showForm && (
        <TransactionForm
          categories={categories}
          accounts={accounts}
          ledgers={accountFilteredLedgers}
          selectedAccountId={selectedAccountId === ALL_ACCOUNTS ? null : selectedAccountId}
          editingTransaction={editingTransaction}
          onSave={handleSave}
          onClose={handleCloseForm}
          onAddCategory={handleAddCategory}
          onCreateLedger={handleCreateLedger}
        />
      )}

      {/* Add/Edit Account Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAccountModal(false)} />
          <div className="relative bg-white rounded-2xl p-5 max-w-sm w-full animate-scale-in">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-neutral-900">
                {editingAccount ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button
                onClick={() => setShowAccountModal(false)}
                className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors"
              >
                <X className="w-4 h-4 text-neutral-600" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Account Name</label>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g. Personal Account, Family Account..."
                  autoFocus
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none focus:border-primary-400 transition-all placeholder:text-neutral-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Icon</label>
                <div className="grid grid-cols-7 gap-2">
                  {ACCOUNT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setAccountIcon(icon)}
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg border transition-all ${
                        accountIcon === icon
                          ? 'border-primary-400 bg-primary-50 scale-110'
                          : 'border-neutral-200 bg-white hover:border-neutral-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-neutral-600 mb-1.5 block">Color</label>
                <div className="flex gap-2">
                  {ACCOUNT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccountColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        accountColor === color ? 'border-neutral-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleSaveAccount}
                disabled={!accountName.trim()}
                className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check className="w-5 h-5" />
                {editingAccount ? 'Update' : 'Add'} Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
