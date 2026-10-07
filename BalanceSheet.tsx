import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import type { Transaction, Account, Ledger } from '../types'
import { formatCurrency, computeCashLedgerBalance, computePartyLedgerBalance } from '../types'

interface BalanceSheetProps {
  transactions: Transaction[]
  allTransactions: Transaction[]
  accounts: Account[]
  ledgers: Ledger[]
}

export default function BalanceSheet({ allTransactions, ledgers }: BalanceSheetProps) {
  const bankLedgers = ledgers.filter((l) => l.type === 'bank')
  const cashLedgers = ledgers.filter((l) => l.type === 'cash')
  const partyLedgers = ledgers.filter((l) => l.type === 'party' && (l.ledger_group === 'vendor' || l.ledger_group === 'loan'))
  const investmentLedgers = ledgers.filter((l) => l.type === 'investment')

  const totalBankBalance = bankLedgers.reduce(
    (sum, l) => sum + computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions), 0
  )
  const totalCashBalance = cashLedgers.reduce(
    (sum, l) => sum + computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions), 0
  )

  // Receivable = party ledgers with positive balance
  const receivable = partyLedgers.reduce(
    (sum, l) => sum + Math.max(0, computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)), 0
  )
  // Payable = party ledgers with negative balance
  const payable = partyLedgers.reduce(
    (sum, l) => sum + Math.max(0, -computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)), 0
  )

  // Investment total (treated as asset)
  const totalInvestment = investmentLedgers.reduce(
    (sum, l) => sum + Math.abs(computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)), 0
  )

  const totalIncome = allTransactions
    .filter((tx) => tx.voucher_type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalExpense = allTransactions
    .filter((tx) => tx.voucher_type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0)

  const liquidAssets = totalBankBalance + totalCashBalance
  const totalAssets = liquidAssets + totalInvestment + receivable
  const totalLiabilities = payable
  const netPosition = totalAssets - totalLiabilities

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Net Position Card */}
      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 p-5 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="relative">
          <p className="text-sm text-neutral-400 font-medium">Net Position</p>
          <p className="text-3xl font-bold mt-1 tracking-tight">{formatCurrency(netPosition)}</p>
          <div className="flex items-center gap-3 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-success-500/15 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-success-400" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">Total Assets</p>
                <p className="text-sm font-semibold text-success-400">{formatCurrency(totalAssets)}</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-danger-500/15 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-danger-400" />
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">Liabilities</p>
                <p className="text-sm font-semibold text-danger-400">{formatCurrency(totalLiabilities)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Sheet Summary */}
      <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
          <h3 className="text-sm font-semibold text-neutral-900">Balance Sheet</h3>
        </div>
        <div className="divide-y divide-neutral-100">
          {/* Bank Ledgers */}
          {bankLedgers.map((l) => {
            const bal = computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
            return (
              <div key={l.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center text-base">{l.icon}</div>
                  <div>
                    <span className="text-sm text-neutral-700 font-medium">{l.name}</span>
                    <p className="text-[10px] text-neutral-400">Bank</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${bal >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>{formatCurrency(bal)}</span>
              </div>
            )
          })}
          {/* Cash Ledgers */}
          {cashLedgers.map((l) => {
            const bal = computeCashLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
            return (
              <div key={l.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-warning-500/10 flex items-center justify-center text-base">{l.icon}</div>
                  <div>
                    <span className="text-sm text-neutral-700 font-medium">{l.name}</span>
                    <p className="text-[10px] text-neutral-400">Cash</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${bal >= 0 ? 'text-neutral-900' : 'text-danger-600'}`}>{formatCurrency(bal)}</span>
              </div>
            )
          })}
          {/* Investment Ledgers */}
          {investmentLedgers.map((l) => {
            const bal = computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
            return (
              <div key={l.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center text-base">{l.icon}</div>
                  <div>
                    <span className="text-sm text-neutral-700 font-medium">{l.name}</span>
                    <p className="text-[10px] text-neutral-400">Investment</p>
                  </div>
                </div>
                <span className="text-sm font-bold text-neutral-900">{formatCurrency(Math.abs(bal))}</span>
              </div>
            )
          })}
          {/* Receivable */}
          {receivable > 0 && (
            <div className="flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center text-base">📤</div>
                <div>
                  <span className="text-sm text-neutral-700 font-medium">Receivable</span>
                  <p className="text-[10px] text-neutral-400">Amount receivable</p>
                </div>
              </div>
              <span className="text-sm font-bold text-success-600">{formatCurrency(receivable)}</span>
            </div>
          )}
          {/* Payable */}
          {payable > 0 && (
            <div className="flex items-center justify-between px-4 py-3.5 hover:bg-neutral-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning-500/10 flex items-center justify-center text-base">📥</div>
                <div>
                  <span className="text-sm text-neutral-700 font-medium">Payable</span>
                  <p className="text-[10px] text-neutral-400">Amount payable</p>
                </div>
              </div>
              <span className="text-sm font-bold text-warning-600">-{formatCurrency(payable)}</span>
            </div>
          )}
          {/* Total Liquid Assets */}
          <div className="flex items-center justify-between px-4 py-3.5 bg-neutral-50">
            <span className="text-sm font-semibold text-neutral-700">Total Liquid (Bank + Cash)</span>
            <span className="text-sm font-bold text-neutral-900">{formatCurrency(liquidAssets)}</span>
          </div>
          {/* Net Position */}
          <div className="flex items-center justify-between px-4 py-4 bg-neutral-50">
            <span className="text-sm font-bold text-neutral-900">Net Position</span>
            <span className={`text-base font-bold ${netPosition >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {formatCurrency(netPosition)}
            </span>
          </div>
        </div>
      </div>

      {/* Income vs Expense */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 border border-neutral-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-success-50 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-success-600" />
            </div>
            <span className="text-xs font-medium text-neutral-500">Total Income</span>
          </div>
          <p className="text-lg font-bold text-success-600">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="rounded-2xl bg-white p-4 border border-neutral-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-xl bg-danger-50 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-danger-600" />
            </div>
            <span className="text-xs font-medium text-neutral-500">Total Expense</span>
          </div>
          <p className="text-lg font-bold text-danger-600">{formatCurrency(totalExpense)}</p>
        </div>
      </div>

      {/* Party Ledger Dues Detail */}
      {(receivable > 0 || payable > 0) && partyLedgers.length > 0 && (
        <div className="rounded-2xl bg-white border border-neutral-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50">
            <h3 className="text-sm font-semibold text-neutral-900">Party Outstanding Balances</h3>
          </div>
          <div className="divide-y divide-neutral-100">
            {partyLedgers.map((l) => {
              const bal = computePartyLedgerBalance(l.id, l.opening_balance || 0, allTransactions)
              if (bal === 0) return null
              return (
                <div key={l.id} className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base"
                      style={{ backgroundColor: (l.color ?? '#94a3b8') + '20' }}>{l.icon}</div>
                    <span className="text-sm text-neutral-700 font-medium">{l.name}</span>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${bal > 0 ? 'text-success-600' : 'text-warning-600'}`}>
                      {formatCurrency(Math.abs(bal))}
                    </span>
                    <p className="text-[9px] text-neutral-400">{bal > 0 ? 'Receivable' : 'Payable'}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {allTransactions.length === 0 && (
        <div className="text-center py-12">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
            <Wallet className="w-7 h-7 text-neutral-400" />
          </div>
          <p className="text-sm text-neutral-500">Add entries to view your balance sheet</p>
        </div>
      )}
    </div>
  )
}
