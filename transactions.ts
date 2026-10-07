import { supabase } from '../lib/supabase'
import type { Transaction, TransactionInput, Category, Account, Ledger, LedgerInput } from '../types'

export async function claimLegacyWorkspace(): Promise<void> {
  const { error } = await supabase.rpc('claim_legacy_workspace')
  if (error) throw new Error('Unable to secure the existing workspace.')
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('type')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchLedgers(): Promise<Ledger[]> {
  const { data, error } = await supabase
    .from('ledgers')
    .select('*')
    .order('name')
  if (error) throw error
  return data ?? []
}

export async function fetchTransactions(
  startDate?: string,
  endDate?: string
): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select('*, category:categories(*), account:accounts(*), ledger:ledgers!ledger_id(*), from_ledger:ledgers!from_ledger_id(*)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })

  if (startDate) query = query.gte('date', startDate)
  if (endDate) query = query.lte('date', endDate)

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createTransaction(input: TransactionInput): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .insert(input)
    .select('*, category:categories(*), account:accounts(*), ledger:ledgers!ledger_id(*), from_ledger:ledgers!from_ledger_id(*)')
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(
  id: string,
  input: TransactionInput
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update(input)
    .eq('id', id)
    .select('*, category:categories(*), account:accounts(*), ledger:ledgers!ledger_id(*), from_ledger:ledgers!from_ledger_id(*)')
    .single()
  if (error) throw error
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}

export async function createAccount(
  name: string,
  icon: string,
  color: string
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name, icon, color })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateAccount(
  id: string,
  name: string,
  icon: string,
  color: string
): Promise<Account> {
  const { data, error } = await supabase
    .from('accounts')
    .update({ name, icon, color })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').delete().eq('id', id)
  if (error) throw error
}

export async function createAccountAccessCode(accountId: string): Promise<string> {
  const code = crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
  const { error } = await supabase.from('account_access_codes').insert({ account_id: accountId, code })
  if (error) throw error
  return code
}

export async function claimAccountAccess(code: string): Promise<string> {
  const { data, error } = await supabase.rpc('claim_account_access', { p_code: code.trim().toUpperCase() })
  if (error || typeof data !== 'string') throw new Error('This access code is invalid or expired.')
  return data
}

export async function createCategory(
  name: string,
  type: 'income' | 'expense',
  icon: string,
  color: string
): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, type, icon, color })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createLedger(input: LedgerInput): Promise<Ledger> {
  const { data, error } = await supabase
    .from('ledgers')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateLedger(
  id: string,
  input: Partial<LedgerInput>
): Promise<Ledger> {
  const { data, error } = await supabase
    .from('ledgers')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteLedger(id: string): Promise<void> {
  const { error } = await supabase.from('ledgers').delete().eq('id', id)
  if (error) throw error
}
