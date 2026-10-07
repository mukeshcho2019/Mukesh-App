import type { Ledger, Transaction } from '../types'
import { computeCashLedgerBalance, computePartyLedgerBalance, formatCurrency, formatDate } from '../types'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function amountClass(amount: number): string {
  return amount >= 0 ? 'positive' : 'negative'
}

function baseDocument(title: string, subtitle: string, content: string): string {
  return `<!doctype html>
<html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title>
<style>
@page { size: A4; margin: 16mm 14mm 18mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.5; }
.watermark { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center; z-index: -1; pointer-events: none; }
.watermark img { width: 520px; height: 520px; object-fit: contain; opacity: .07; mix-blend-mode: multiply; }
.header { display:flex; justify-content:space-between; align-items:center; gap:18px; border-bottom:3px solid #2948b8; padding:0 0 14px; margin-bottom:20px; }
.brand { display:flex; align-items:center; gap:10px; } .brand img { width:64px; height:64px; border-radius:50%; object-fit:cover; border:3px solid #2948b8; }
.brand h1 { margin:0; color:#2948b8; font-size:20px; line-height:1.15; } .brand p { margin:4px 0 0; color:#718096; font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
.meta { text-align:right; color:#718096; font-size:10px; } .meta strong { display:block; color:#172033; font-size:12px; }
h2 { color:#172033; font-size:17px; margin:0 0 3px; } .subtitle { color:#718096; margin:0 0 16px; }
.grid { display:grid; grid-template-columns:repeat(2, 1fr); gap:9px; margin-bottom:14px; }
.card { border:1px solid #dce3ef; border-radius:9px; padding:11px 12px; background:rgba(255,255,255,.88); } .card .label { color:#718096; font-size:10px; } .card .value { font-size:17px; font-weight:700; margin-top:2px; }
.positive { color:#07885c; } .negative { color:#d04444; } .blue { color:#2948b8; } .orange { color:#d77b00; }
.section { margin:16px 0; } .section h3 { margin:0 0 7px; padding-bottom:5px; border-bottom:1px solid #dce3ef; font-size:13px; color:#2948b8; }
table { width:100%; border-collapse:collapse; } th { text-align:left; color:#718096; background:#f4f7fb; font-size:10px; } th, td { padding:7px 8px; border-bottom:1px solid #e7ecf3; } td.amount, th.amount { text-align:right; }
.footer { position:fixed; left:0; right:0; bottom:-10mm; border-top:1px solid #dce3ef; padding-top:6px; color:#8490a4; font-size:9px; display:flex; justify-content:space-between; }
.note { color:#718096; font-size:10px; margin-top:5px; } .empty { padding:15px; color:#718096; text-align:center; border:1px dashed #cbd5e1; border-radius:8px; }
@media print { .no-print { display:none; } }
</style></head><body>
<div class="watermark"><img src="${window.location.origin}/profile-head.png" alt=""></div>
<div class="header"><div class="brand"><img src="${window.location.origin}/profile-head.png" alt="Profile"><div><h1>Mukesh Choudhary</h1><p>Professional accounting report</p></div></div><div class="meta"><strong>${escapeHtml(title)}</strong>${escapeHtml(subtitle)}<br>Generated ${new Date().toLocaleDateString('en-IN')}</div></div>
${content}
<div class="footer"><span>Mukesh Choudhary</span><span>Private financial report</span></div>
<script>window.onload=function(){window.print()}</script>
</body></html>`
}

export function openReportPdf(title: string, subtitle: string, content: string): void {
  const reportWindow = window.open('', '_blank')
  if (!reportWindow) {
    window.alert('Please allow pop-ups to open the PDF preview.')
    return
  }
  reportWindow.opener = null
  reportWindow.document.write(baseDocument(title, subtitle, content))
  reportWindow.document.close()
}

export function openLedgerPdf(ledger: Ledger, transactions: Transaction[]): void {
  const isCash = ledger.type === 'bank' || ledger.type === 'cash'
  const balance = isCash
    ? computeCashLedgerBalance(ledger.id, ledger.opening_balance || 0, transactions)
    : computePartyLedgerBalance(ledger.id, ledger.opening_balance || 0, transactions)
  const ledgerTransactions = transactions
    .filter((tx) => isCash
      ? tx.from_ledger_id === ledger.id || (tx.voucher_type === 'transfer' && tx.ledger_id === ledger.id)
      : tx.ledger_id === ledger.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const rows = ledgerTransactions.length === 0
    ? '<tr><td colspan="4" class="empty">No entries in this ledger</td></tr>'
    : ledgerTransactions.map((tx) => {
      const effect = isCash
        ? tx.voucher_type === 'transfer' && tx.ledger_id === ledger.id ? tx.amount : (tx.voucher_type === 'income' || tx.voucher_type === 'receipt' ? tx.amount : -tx.amount)
        : tx.voucher_type === 'payment' || tx.voucher_type === 'transfer' || tx.voucher_type === 'journal' ? tx.amount : -tx.amount
      return `<tr><td>${escapeHtml(formatDate(tx.date))}</td><td>${escapeHtml(tx.voucher_type)}</td><td>${escapeHtml(tx.description || tx.category?.name || tx.ledger?.name || 'Entry')}</td><td class="amount ${amountClass(effect)}">${effect >= 0 ? '+' : ''}${escapeHtml(formatCurrency(effect))}</td></tr>`
    }).join('')
  const content = `<h2>${escapeHtml(ledger.icon)} ${escapeHtml(ledger.name)}</h2><p class="subtitle">${escapeHtml(ledger.type)} ledger statement</p><div class="grid"><div class="card"><div class="label">Opening Balance</div><div class="value blue">${escapeHtml(formatCurrency(ledger.opening_balance || 0))}</div></div><div class="card"><div class="label">Current Balance</div><div class="value ${amountClass(balance)}">${escapeHtml(formatCurrency(isCash ? balance : Math.abs(balance)))}</div></div></div><div class="section"><h3>Ledger Entries</h3><table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody></table></div>`
  openReportPdf(`${ledger.name} Ledger`, `${ledger.type} statement`, content)
}