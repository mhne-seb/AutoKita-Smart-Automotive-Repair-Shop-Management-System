'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, X, KeyRound,
  Loader2, AlertCircle,
} from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import { Header } from '@/components/site/Header'
import { login, startSession } from '@/controllers/authController'

const loginBg = '/assets/login-workshop.jpg' // static asset path

// These buttons hold real account passwords (one is the shop owner's), so the
// live site leaves them out unless NEXT_PUBLIC_SHOW_DEMO_LOGIN=true, e.g. for
// the defense. Both values are fixed at build time, so when the flag is off the
// passwords aren't even in the page's JavaScript.
const showDemo = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SHOW_DEMO_LOGIN === 'true'
const demoAccounts = showDemo
  ? [
      { label: 'Customer', email: 'customer200@example.com', password: 'password123_u200' },
      { label: 'Admin', email: 'owner@autokita.com', password: 'password123_e1' },
    ]
  : []

function LoginPage() {
  useEffect(() => {
    document.title = 'Log in — AutoKita'
  }, [])

  const router = useRouter()
  const [email, setEmail] = useState(demoAccounts[0]?.email ?? '')
  const [password, setPassword] = useState(demoAccounts[0]?.password ?? '')
  const [showPassword, setShowPassword] = useState(false)
  // Off by default: the shop PC is shared, and the next person shouldn't land in your account.
  const [remember, setRemember] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await login(email, password, remember)

    setSubmitting(false)

    if (!result.success || !result.role) {
      setError(result.message ?? 'Invalid email or password.')
      return
    }

    const u = result.user!
    startSession(result.role, u.id, remember, {
      name: u.nickname || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email,
      title: result.title ?? null,
    })
    const isCustomer = result.role === 'customer' || result.role === 'c'
    router.push(isCustomer ? '/dashboard' : '/overview')
  }

  const fillDemo = (acc: (typeof demoAccounts)[number]) => {
    setEmail(acc.email)
    setPassword(acc.password)
    setError('')
  }

  return (
    <div className="relative min-h-screen overflow-y-auto">
      <style>{`
        @keyframes shakeX {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
      `}</style>

      <img
        src={loginBg}
        alt=""
        className="fixed inset-0 h-full w-full scale-105 object-cover transition-transform duration-[4000ms] ease-out"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-brand/55 via-brand/45 to-brand/65" />
      <div className="pointer-events-none fixed -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -left-24 h-96 w-96 rounded-full bg-teal/20 blur-3xl" />

      <Header variant="transparent" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-10">
        <div className="w-full max-w-sm animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div
            className={`rounded-xl border border-white/10 bg-card/95 p-8 shadow-2xl transition-all duration-300 ${
              forgot ? 'blur-[2px] scale-[0.98]' : 'hover:shadow-[0_0_60px_rgba(0,0,0,0.25)]'
            }`}
          >
            <div className="mb-5 flex justify-center">
              <Logo />
            </div>

            <h2 className="text-center text-2xl font-bold">Welcome Back!</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Sign in to track your vehicle's service
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-medium">Email</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (error) setError('') }}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-[color:var(--brand)]"
                  />
                  Keep me signed in
                </label>
                <button type="button" onClick={() => setForgot(true)} className="text-brand transition-colors hover:underline">
                  Forgot password?
                </button>
              </div>

              {error && (
                <p
                  className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive"
                  style={{ animation: 'shakeX 0.4s ease-in-out' }}
                >
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
              >
                {submitting ? (
                  <>Signing in… <Loader2 className="h-4 w-4 animate-spin" /></>
                ) : (
                  <>Sign In <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>

            {demoAccounts.length > 0 && (
            <>
            <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> Quick Demo Access <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-2">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.label}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-left text-xs transition-colors hover:border-brand/30 hover:bg-brand-soft"
                >
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{acc.label}</span> — {acc.email}
                  </span>
                  <ArrowRight className="h-3 w-3 flex-shrink-0 text-brand" />
                </button>
              ))}
            </div>
            </>
            )}
          </div>
        </div>

        <p className="mt-8 animate-fade-up text-center text-xs text-white/70" style={{ animationDelay: '0.2s' }}>
          © 2026 AutoKita: A Smart Automotive Repair Shop Management. All rights reserved.
        </p>
      </div>

      {forgot && <ForgotPasswordModal onClose={() => setForgot(false)} />}
    </div>
  )
}

// Step 1 asks for the email; step 2 says "check your inbox". The rest happens
// on /reset-password, which the emailed link opens.
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [sent, setSent] = useState(false)
  const [email, setEmail] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setErr('Enter a valid email address.'); return }
    setErr('')
    setSending(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await res.json()
      if (!data.success) { setErr(data.message ?? "We couldn't send the email. Try again."); return }
      setSent(true)
    } catch {
      setErr("We couldn't reach the server. Check your connection and try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      style={{ animation: 'fadeIn 0.25s ease-out' }}
    >
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl"
        style={{ animation: 'modalPop 0.3s cubic-bezier(0.22,1,0.36,1)' }}
      >
        <div className="flex items-center justify-between border-b bg-brand px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <h3 className="text-sm font-semibold">{sent ? 'Check your email' : 'Forgot password'}</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 transition-colors hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6">
          {!sent && (
            <form onSubmit={submitEmail} className="space-y-4 animate-fade-up">
              <p className="text-sm text-muted-foreground">
                Enter the email you use for AutoKita. We'll send you a link to set a new password.
              </p>
              <div>
                <label className="text-xs font-medium">Email</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr('') }} placeholder="you@example.com"
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
              {err && (
                <p className="flex items-center gap-2 text-xs text-destructive" style={{ animation: 'shakeX 0.4s ease-in-out' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {err}
                </p>
              )}
              <button disabled={sending} className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60">
                {sending ? <>Sending… <Loader2 className="h-4 w-4 animate-spin" /></> : 'Send reset link'}
              </button>
            </form>
          )}

          {sent && (
            <div className="space-y-4 text-center animate-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Mail className="h-7 w-7" />
              </div>
              <p className="text-sm">
                If <b>{email.trim()}</b> has an AutoKita account, we sent a reset link to it. The link works for 30 minutes.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn't get it? Check your spam folder, or ask the shop to reset it for you.
              </p>
              <button onClick={onClose} className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01]">
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage