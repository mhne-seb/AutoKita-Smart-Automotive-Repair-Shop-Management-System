'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, Eye, EyeOff, User, Loader2, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react'
import { startSession } from '@/controllers/authController'
import { EMAIL_RE } from '@/lib/bookingRules'

// The whole email sign-up, used on /book (inside the booking gate) and on /signup.
// Step 1: Google button, then name / email / password. Step 2: the 6-digit code.
// A signed-in customer is sent straight on, and a new account continues to /setup.

interface SignupFormProps {
  heading: string
  intro?: string
}

export function SignupForm({ heading, intro }: SignupFormProps) {
  const router = useRouter()

  useEffect(() => {
    fetch('/api/auth/me?role=customer')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.session?.role === 'customer') {
          router.replace('/dashboard/vehicles')
        }
      })
      .catch(() => {})
  }, [router])

  const [step, setStep] = useState<1 | 2>(1)

  // Form states
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Verify states
  const [code, setCode] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  // The server allows 5 wrong tries per code. These show that to the person.
  const [triesLeft, setTriesLeft] = useState<number | null>(null)
  const [locked, setLocked] = useState(false)

  // Global errors and states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Timer effect
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(resendTimer - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [resendTimer])

  const validateStep1 = () => {
    const errs: Record<string, string> = {}
    const fName = firstName.trim()
    const lName = lastName.trim()
    const em = email.trim().toLowerCase()

    if (!fName) errs.firstName = 'Enter your first name.'
    else if (fName.length > 40) errs.firstName = 'First name must be 40 characters or fewer.'
    if (!lName) errs.lastName = 'Enter your last name.'
    else if (lName.length > 40) errs.lastName = 'Last name must be 40 characters or fewer.'
    if (!em) errs.email = 'Enter your email address.'
    else if (em.length > 80 || !EMAIL_RE.test(em)) errs.email = 'Enter a valid email address.'
    if (!password) errs.password = 'Enter a password.'
    else if (password.length < 8 || password.length > 72) errs.password = 'Password must be between 8 and 72 characters.'
    else if (password === em) errs.password = 'Password cannot be your email address.'
    if (!confirmPassword) errs.confirmPassword = 'Type your password again.'
    else if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match.'

    return errs
  }

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateStep1()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    setErrors({})
    setServerError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/signup/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      })
      const data = await res.json()
      if (!data.success) {
        if (data.field) {
          setErrors({ [data.field]: data.message })
        } else {
          setServerError(data.message || 'Something went wrong.')
        }
      } else {
        setResendTimer(data.resendInSeconds || 60)
        setStep(2)
        setCode('')
        setTriesLeft(null)
        setLocked(false)
      }
    } catch {
      setServerError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return

    setServerError('')
    setSubmitting(true)

    try {
      const res = await fetch('/api/auth/signup/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      })
      const data = await res.json()
      if (!data.success) {
        if (data.code === 'WRONG' && typeof data.triesLeft === 'number') {
          setTriesLeft(data.triesLeft)
          if (data.triesLeft <= 0) {
            setLocked(true)
            setServerError('That code is not right and you have no tries left. Send a new code to continue.')
          } else {
            setServerError(`That code is not right. ${data.triesLeft} ${data.triesLeft === 1 ? 'try' : 'tries'} left.`)
          }
        } else if (data.code === 'TOO_MANY') {
          setLocked(true)
          setTriesLeft(0)
          setServerError('Too many wrong tries. Send a new code to continue.')
        } else {
          setServerError(data.message || 'Verification failed.')
        }
      } else {
        startSession('customer', data.userId, false, { name: data.name, title: null })
        router.replace('/setup')
      }
    } catch {
      setServerError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    if (resendTimer > 0) return
    setServerError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/signup/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, email, password }),
      })
      const data = await res.json()
      if (!data.success) {
        setServerError(data.message || 'Something went wrong.')
      } else {
        setResendTimer(data.resendInSeconds || 60)
        setCode('')
        setTriesLeft(null)
        setLocked(false)
      }
    } catch {
      setServerError('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const goBack = () => {
    setPassword('')
    setConfirmPassword('')
    setErrors({})
    setServerError('')
    setStep(1)
  }

  const passwordRuleBroken =
    password.length > 0 &&
    (password.length < 8 || password.length > 72 || password === email.trim().toLowerCase())

  if (step === 2) {
    return (
      <div>
        <h1 className="text-xl font-bold text-center">Check your email</h1>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. It works for 10 minutes.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleVerify}>
          <div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              disabled={locked}
              value={code}
              onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setServerError('') }}
              placeholder="000000"
              className="w-full rounded-md border bg-background py-3 text-center text-2xl font-mono tracking-[0.5em] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
            />
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              {locked
                ? 'This code is no longer valid. Send a new one below.'
                : triesLeft !== null
                ? `You have ${triesLeft} ${triesLeft === 1 ? 'try' : 'tries'} left for this code.`
                : 'You have 5 tries for each code.'}
            </p>
          </div>

          {serverError && (
            <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex gap-2 items-start">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || locked || code.length !== 6}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-center text-sm">
          <button
            onClick={handleResend}
            disabled={resendTimer > 0 || submitting}
            className="text-brand font-medium hover:underline disabled:opacity-50 disabled:no-underline"
          >
            Did not get it? {resendTimer > 0 ? `Send again in ${resendTimer}s` : 'Send again'}
          </button>

          <button
            onClick={goBack}
            disabled={submitting}
            className="flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Wrong email? Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold">{heading}</h1>
        {intro && <p className="text-sm text-muted-foreground">{intro}</p>}
      </div>

      {process.env.NEXT_PUBLIC_GOOGLE_LOGIN === 'true' && (
        <>
          <button
            type="button"
            onClick={() => { window.location.href = '/api/auth/google/start?remember=0&return=vehicles' }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background py-2.5 text-sm font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-muted hover:shadow-md active:translate-y-0 cursor-pointer"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
          <div className="my-6 relative flex items-center justify-center text-xs uppercase text-muted-foreground">
            <span className="w-full border-t absolute" />
            <span className="bg-card px-2 relative z-10">or</span>
          </div>
        </>
      )}

      <form className={`space-y-4 ${process.env.NEXT_PUBLIC_GOOGLE_LOGIN === 'true' ? '' : 'mt-6'}`} onSubmit={handleSendCode}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">First name</label>
            <div className="mt-1.5 relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="e.g., Juan"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); setErrors(p => ({ ...p, firstName: '' })) }}
                className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 ${errors.firstName ? 'border-destructive' : 'focus:border-brand'}`}
              />
            </div>
            {errors.firstName && <p className="mt-1 text-[10px] text-destructive">{errors.firstName}</p>}
          </div>
          <div>
            <label className="text-xs font-medium">Last name</label>
            <div className="mt-1.5 relative">
              <input
                type="text"
                placeholder="e.g., Dela Cruz"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); setErrors(p => ({ ...p, lastName: '' })) }}
                className={`w-full rounded-md border bg-background py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 ${errors.lastName ? 'border-destructive' : 'focus:border-brand'}`}
              />
            </div>
            {errors.lastName && <p className="mt-1 text-[10px] text-destructive">{errors.lastName}</p>}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Email</label>
          <div className="mt-1.5 relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              placeholder="you@email.com"
              autoComplete="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
              className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 ${errors.email ? 'border-destructive' : 'focus:border-brand'}`}
            />
          </div>
          {errors.email && <p className="mt-1 text-[10px] text-destructive">{errors.email}</p>}
        </div>

        <div>
          <label className="text-xs font-medium">Password</label>
          <div className="mt-1.5 relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
              className={`w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 ${errors.password ? 'border-destructive' : 'focus:border-brand'}`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {/* The rules, in one sentence. They match the server's checks. */}
          <p
            className={`mt-2 text-[11px] leading-relaxed ${passwordRuleBroken ? 'text-destructive' : 'text-muted-foreground'}`}
          >
            Your password must be 8 to 72 characters long and can&apos;t be the same as your email address.
          </p>
          {/* A broken rule is already shown in red above, so say it only once. */}
          {errors.password && !passwordRuleBroken && <p className="mt-1 text-[10px] text-destructive">{errors.password}</p>}
        </div>

        <div>
          <label className="text-xs font-medium">Confirm password</label>
          <div className="mt-1.5 relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Type your password again"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setErrors(p => ({ ...p, confirmPassword: '' })) }}
              className={`w-full rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20 ${errors.confirmPassword ? 'border-destructive' : 'focus:border-brand'}`}
            />
          </div>
          {(errors.confirmPassword || (confirmPassword && confirmPassword !== password ? 'Passwords do not match.' : '')) && (
            <p className="mt-1 text-[10px] text-destructive">
              {errors.confirmPassword || 'Passwords do not match.'}
            </p>
          )}
        </div>

        {serverError && (
          <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive flex gap-2 items-start">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-4 flex items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        Already have an account? <Link href="/login" className="text-brand font-medium hover:underline">Log in</Link>
      </div>
    </div>
  )
}
