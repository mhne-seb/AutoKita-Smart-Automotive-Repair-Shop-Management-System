'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Mail, Lock, Eye, EyeOff, ArrowRight, X, KeyRound,
  CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import { Header } from '@/components/site/Header'
import { login, startSession } from '@/controllers/authController'

const loginBg = '/assets/login-workshop.jpg' // static asset path

const demoAccounts = [
  { label: 'Customer', email: 'customer200@example.com', password: 'password123_u200' },
  { label: 'Admin', email: 'owner@autokita.com', password: 'password123_e1' },
]

function LoginPage() {
  useEffect(() => {
    document.title = 'Log in — AutoKita'
  }, [])

  const router = useRouter()
  const [email, setEmail] = useState('customer@autocare.com')
  const [password, setPassword] = useState('password')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [forgot, setForgot] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const result = await login(email, password)

    setSubmitting(false)

    if (!result.success || !result.role) {
      setError(result.message ?? 'Invalid email or password.')
      return
    }

    startSession(result.role, result.user!.id)
    router.push(result.role === 'customer' ? '/dashboard' : '/overview')
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

      <div className="relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-start px-6 pt-16 pb-10">
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
                <label className="text-xs font-medium">Email or Phone Number</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
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
                  Remember me
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

const forgotSteps = ['Email', 'Verify', 'Reset', 'Done']

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const firstCodeRef = useRef<HTMLInputElement | null>(null)

  const [mockCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)))

  useEffect(() => {
    if (step === 1) firstCodeRef.current?.focus()
  }, [step])

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) { setErr('Please enter a valid email.'); return }
    setErr(''); setStep(1)
  }
  const submitCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.join('') !== mockCode) { setErr('Incorrect code. Try again.'); return }
    setErr(''); setStep(2)
  }
  const submitPw = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) { setErr('Password must be at least 8 characters.'); return }
    if (pw !== pw2) { setErr("Passwords don't match."); return }
    setErr(''); setStep(3)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      style={{ animation: 'fadeIn 0.25s ease-out' }}
      onClick={onClose}
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
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b bg-brand px-5 py-3.5 text-white">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            <h3 className="text-sm font-semibold">
              {step === 0 && 'Forgot Password'}
              {step === 1 && 'Verify Your Email'}
              {step === 2 && 'Set New Password'}
              {step === 3 && 'Password Updated'}
            </h3>
          </div>
          <button onClick={onClose} className="rounded p-1 transition-colors hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex gap-1.5 px-5 pt-4">
          {forgotSteps.map((label, i) => (
            <div key={label} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-brand transition-all duration-500 ease-out"
                style={{ width: i <= step ? '100%' : '0%' }}
              />
            </div>
          ))}
        </div>

        <div className="p-6">
          {step === 0 && (
            <form onSubmit={submitEmail} className="space-y-4 animate-fade-up">
              <p className="text-sm text-muted-foreground">Enter your registered email. We'll send a 6-digit verification code.</p>
              <div>
                <label className="text-xs font-medium">Email address</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={email} onChange={(e) => { setEmail(e.target.value); if (err) setErr('') }} placeholder="you@example.com"
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
              {err && (
                <p className="flex items-center gap-2 text-xs text-destructive" style={{ animation: 'shakeX 0.4s ease-in-out' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {err}
                </p>
              )}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01]">
                Send Verification Code
              </button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={submitCode} className="space-y-4 animate-fade-up">
              <p className="text-sm text-muted-foreground">
                We sent a 6-digit code to <b>{email}</b>. Enter it below to continue.
              </p>
              <div className="rounded-md border border-dashed bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                Demo code: <span className="font-mono font-bold text-foreground tracking-widest">{mockCode}</span>
              </div>
              <div className="flex justify-center gap-2">
                {code.map((c, i) => (
                  <input
                    key={i}
                    ref={i === 0 ? firstCodeRef : undefined}
                    id={`code-${i}`}
                    value={c}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 1)
                      setCode((prev) => prev.map((x, ix) => (ix === i ? v : x)))
                      if (v && i < 5) document.getElementById(`code-${i + 1}`)?.focus()
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !code[i] && i > 0) {
                        document.getElementById(`code-${i - 1}`)?.focus()
                      }
                    }}
                    className="h-11 w-10 rounded-md border bg-background text-center text-lg font-bold transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                ))}
              </div>
              {err && (
                <p className="flex items-center justify-center gap-2 text-center text-xs text-destructive" style={{ animation: 'shakeX 0.4s ease-in-out' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {err}
                </p>
              )}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01]">
                Verify Code
              </button>
              <button type="button" onClick={() => setStep(0)} className="w-full text-xs text-muted-foreground transition-colors hover:text-foreground">
                ← Change email
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitPw} className="space-y-4 animate-fade-up">
              <p className="text-sm text-muted-foreground">Choose a strong new password (min. 8 characters).</p>
              <div>
                <label className="text-xs font-medium">New password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); if (err) setErr('') }}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Confirm new password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={pw2} onChange={(e) => { setPw2(e.target.value); if (err) setErr('') }}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                </div>
              </div>
              {err && (
                <p className="flex items-center gap-2 text-xs text-destructive" style={{ animation: 'shakeX 0.4s ease-in-out' }}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {err}
                </p>
              )}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01]">
                Update Password
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center animate-fade-up">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold">Password successfully updated</h4>
              <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <button onClick={onClose} className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01]">
                Back to Log In
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default LoginPage