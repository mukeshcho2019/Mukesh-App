import { useState } from 'react'
import type { FormEvent } from 'react'
import { LockKeyhole, Phone, Wallet, LogIn, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface AuthScreenProps {
  onAuthenticated: () => void
}

function phoneToEmail(raw: string): string {
  let digits = raw.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  return `${digits}@mukesh.app`
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10 || password.length < 6) {
      setError('Please enter a valid 10-digit mobile number and a password of at least 6 characters.')
      return
    }
    const email = phoneToEmail(phone)
    setBusy(true)
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      onAuthenticated()
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to sign in.'
      if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('credentials')) {
        setError('Incorrect mobile number or password. Please try again.')
      } else {
        setError(message)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-8">
      <section className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-200/50 sm:p-8">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/20">
            <Wallet className="h-7 w-7 text-white" />
          </div>
          <h1 className="mt-5 text-2xl font-bold tracking-tight text-neutral-900">Mukesh Choudhary</h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500">Sign in to access your accounting workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-600">Mobile Number</span>
            <span className="relative block">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                required
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="7339732156"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-4 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-400"
              />
            </span>
            <span className="mt-1 block text-[11px] text-neutral-400">Enter your 10-digit mobile number.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-600">Password</span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                required
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-10 pr-10 text-sm text-neutral-900 outline-none transition-colors focus:border-primary-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-neutral-400 hover:text-neutral-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          {error && <p className="rounded-xl bg-danger-50 px-3 py-2.5 text-sm text-danger-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-700 disabled:cursor-wait disabled:opacity-60"
          >
            <LogIn className="h-4 w-4" />
            {busy ? 'Please wait…' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  )
}
