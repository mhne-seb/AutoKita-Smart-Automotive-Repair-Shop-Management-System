'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Lock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import { Header } from '@/components/site/Header'

// Opened from the "Reset your password" email. The link's token is checked
// first, so a dead link says so before the customer types anything.
function ResetPasswordForm() {
  const token = useSearchParams().get('token') ?? ''
  const [linkState, setLinkState] = useState<'checking' | 'ok' | 'bad'>('checking')
  const [linkProblem, setLinkProblem] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    document.title = 'Set a new password — AutoKita'
    if (!token) {
      setLinkProblem("This link is missing its code. Open the link from your email again, or ask for a new one.")
      setLinkState('bad')
      return
    }
    fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLinkState('ok')
        else { setLinkProblem(data.message); setLinkState('bad') }
      })
      .catch(() => { setLinkProblem("We couldn't reach the server. Check your connection and reload."); setLinkState('bad') })
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pw.length < 8) { setErr('Your new password needs at least 8 characters.'); return }
    if (pw !== pw2) { setErr("The two passwords don't match."); return }
    setErr('')
    setSaving(true)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      })
      const data = await res.json()
      if (!data.success) { setErr(data.message ?? "We couldn't save your new password. Try again."); return }
      setDone(true)
    } catch {
      setErr("We couldn't reach the server. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  const inputClass = 'w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'
  const buttonClass = 'flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'

  if (linkState === 'checking') {
    return <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Checking your link…</p>
  }

  if (linkState === 'bad') {
    return (
      <div className="space-y-4 text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-sm">{linkProblem}</p>
        <Link href="/login" className={buttonClass}>Go to sign in</Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
        <h2 className="text-lg font-bold">Password changed</h2>
        <p className="text-sm text-muted-foreground">You can now sign in with your new password.</p>
        <Link href="/login" className={buttonClass}>Go to sign in</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-center text-xl font-bold">Set a new password</h2>
      <div>
        <label className="text-xs font-medium">New password (at least 8 characters)</label>
        <div className="mt-1.5 relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="password" autoComplete="new-password" value={pw} onChange={(e) => { setPw(e.target.value); if (err) setErr('') }} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium">Type it again</label>
        <div className="mt-1.5 relative">
          <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input type="password" autoComplete="new-password" value={pw2} onChange={(e) => { setPw2(e.target.value); if (err) setErr('') }} className={inputClass} />
        </div>
      </div>
      {err && (
        <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" /> {err}
        </p>
      )}
      <button type="submit" disabled={saving} className={buttonClass}>
        {saving ? <>Saving… <Loader2 className="h-4 w-4 animate-spin" /></> : 'Save new password'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen overflow-y-auto">
      <img src="/assets/login-workshop.jpg" alt="" className="fixed inset-0 h-full w-full object-cover" />
      <div className="fixed inset-0 bg-gradient-to-b from-brand/55 via-brand/45 to-brand/65" />
      <Header variant="transparent" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-10">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-card/95 p-8 shadow-2xl">
          <div className="mb-5 flex justify-center"><Logo /></div>
          {/* useSearchParams needs a Suspense boundary so Next.js can build this page ahead of time. */}
          <Suspense fallback={<p className="text-center text-sm text-muted-foreground">Loading…</p>}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
