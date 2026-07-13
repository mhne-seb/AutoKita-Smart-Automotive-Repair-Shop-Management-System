'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Mail, Lock, Eye, ArrowRight, ArrowLeft, X, KeyRound, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import { login, startSession } from '@/controllers/authController'

const loginBg = '/assets/login-workshop.jpg' // static asset path

//   - role "customer" -> /dashboard
//   - role "admin"    -> /overview
// No separate "Admin Login" page/route exists anymore

function LoginPage() {
  useEffect(() => {
    document.title = 'Log in — AutoKita'
  }, [])

  const router = useRouter()
  const [email, setEmail] = useState('customer@autocare.com')
  const [password, setPassword] = useState('password')
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

    // Automatically detect the account's role and route to the right dashboard.
    startSession(result.role)
    router.push(result.role === 'admin' ? '/overview' : '/dashboard')
  }

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-2">
      <section className="relative hidden overflow-hidden lg:block">
        <img src={loginBg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand/75" />
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <div className="h-8 w-8 rounded-full bg-white/10" />
          <div>
            <h1 className="text-5xl font-bold leading-tight">
              Precision Management for <span className="text-brand-soft/80">Modern Automotive</span> Care.
            </h1>
            <p className="mt-6 max-w-md text-sm text-white/80">
              One login for everyone — customers track their vehicle, admins run the shop. We detect
              your role automatically and take you to the right dashboard.
            </p>
          </div>
          <div className="flex gap-10 border-t border-white/20 pt-6">
            <div><div className="text-2xl font-bold">99.9%</div><div className="text-xs uppercase tracking-wide text-white/70">Uptime</div></div>
            <div><div className="text-2xl font-bold">256-bit</div><div className="text-xs uppercase tracking-wide text-white/70">Encryption</div></div>
            <div><div className="text-2xl font-bold">ISO 27001</div><div className="text-xs uppercase tracking-wide text-white/70">Certified</div></div>
          </div>
        </div>
      </section>

      <section className="flex min-h-screen flex-col justify-between bg-background px-6 py-8">
        <div className="flex justify-center"><Link href="/"><Logo /></Link></div>
        <div className="mx-auto w-full max-w-sm">
          <div className="rounded-xl border bg-card p-8 shadow-sm">
            <h2 className="text-center text-2xl font-bold">Log in</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Enter your credentials — we'll automatically send you to your Customer or Admin dashboard.
            </p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-medium">Email or Phone Number</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:border-brand focus:outline-none"
                  />
                  <Eye className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
                <button type="button" onClick={() => setForgot(true)} className="text-brand hover:underline">
                  Forgot password?
                </button>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign In'} <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            {/* Demo credential hint — this is mock data, safe to show for the capstone demo. */}
            <div className="mt-4 rounded-md border border-dashed bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Demo accounts</p>
              <p>Customer: customer@autocare.com / password</p>
              <p>Admin: admin@autokita.com / autokita2026</p>
            </div>
          </div>
          <Link href="/" className="mt-4 flex items-center justify-center gap-2 rounded-full border bg-background py-2.5 text-sm hover:bg-accent">
            <ArrowLeft className="h-4 w-4" /> Back to Public Website
          </Link>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          © 2026 AutoKita. All rights reserved.
        </p>
      </section>

      {forgot && <ForgotPasswordModal onClose={() => setForgot(false)} />}
    </div>
  )
}

function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')

  // Mock verification code shown to the user for demo purposes
  const [mockCode] = useState(() => String(Math.floor(100000 + Math.random() * 900000)))

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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-up">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-background shadow-2xl">
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
          <button onClick={onClose} className="rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-6">
          {step === 0 && (
            <form onSubmit={submitEmail} className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter your registered email. We'll send a 6-digit verification code.</p>
              <div>
                <label className="text-xs font-medium">Email address</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none" />
                </div>
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Send Verification Code
              </button>
            </form>
          )}

          {step === 1 && (
            <form onSubmit={submitCode} className="space-y-4">
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
                    id={`code-${i}`}
                    value={c}
                    inputMode="numeric"
                    maxLength={1}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 1)
                      setCode((prev) => prev.map((x, ix) => (ix === i ? v : x)))
                      if (v && i < 5) document.getElementById(`code-${i + 1}`)?.focus()
                    }}
                    className="h-11 w-10 rounded-md border bg-background text-center text-lg font-bold focus:border-brand focus:outline-none"
                  />
                ))}
              </div>
              {err && <p className="text-center text-xs text-destructive">{err}</p>}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Verify Code
              </button>
              <button type="button" onClick={() => setStep(0)} className="w-full text-xs text-muted-foreground hover:text-foreground">
                ← Change email
              </button>
            </form>
          )}

          {step === 2 && (
            <form onSubmit={submitPw} className="space-y-4">
              <p className="text-sm text-muted-foreground">Choose a strong new password (min. 8 characters).</p>
              <div>
                <label className="text-xs font-medium">New password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={pw} onChange={(e) => setPw(e.target.value)}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium">Confirm new password</label>
                <div className="mt-1.5 relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:border-brand focus:outline-none" />
                </div>
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <button className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
                Update Password
              </button>
            </form>
          )}

          {step === 3 && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h4 className="text-lg font-bold">Password successfully updated</h4>
              <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
              <button onClick={onClose} className="w-full rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90">
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
