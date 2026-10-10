'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, ArrowRight, User, Mail, Phone } from 'lucide-react'
import { startSession } from '@/controllers/authController'
import { Logo } from '@/components/site/Logo'

// Same as in src/lib/bookingRules.ts
const PHONE_RE = /^(\+?63|0)9\d{9}$/

export default function GoogleSignupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [profile, setProfile] = useState<{ email: string, firstName: string, lastName: string } | null>(null)
  
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/auth/google/pending')
      .then(res => {
        if (!res.ok) throw new Error('401')
        return res.json()
      })
      .then(data => {
        if (!data.success) throw new Error('Failed')
        setProfile({ email: data.email, firstName: data.firstName, lastName: data.lastName })
        setLoading(false)
      })
      .catch(() => {
        router.replace('/login?google=failed')
      })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPhone = phone.replace(/[\s-]/g, '')
    if (!PHONE_RE.test(cleanPhone)) {
      setError('Enter a valid mobile number, like 09171234567.')
      return
    }
    
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/google/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      })
      const data = await res.json()
      
      if (!data.success) {
        setError(data.message || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      startSession('customer', data.userId, data.remember === true, { name: data.name, title: null })
      router.replace('/dashboard')
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-y-auto">
      <div className="fixed inset-0 bg-gradient-to-b from-brand/55 via-brand/45 to-brand/65" />
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-10">
        <div className="w-full max-w-sm">
          <div className="rounded-xl border border-white/10 bg-card/95 p-8 shadow-2xl">
            <div className="mb-5 flex justify-center">
              <Logo />
            </div>

            <h2 className="text-center text-2xl font-bold">Finish your account</h2>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              Please provide your mobile number
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="text-xs font-medium">Name</label>
                <div className="mt-1.5 relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    disabled
                    value={[profile?.firstName, profile?.lastName].filter(Boolean).join(' ')}
                    className="w-full rounded-md border bg-muted/50 py-2 pl-9 pr-3 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium">Email</label>
                <div className="mt-1.5 relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    disabled
                    value={profile?.email}
                    className="w-full rounded-md border bg-muted/50 py-2 pl-9 pr-3 text-sm text-muted-foreground cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium">Mobile Number</label>
                <div className="mt-1.5 relative">
                  <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="tel"
                    placeholder="09171234567"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); if (error) setError('') }}
                    className="w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {error && (
                <p className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting || !phone}
                className={`flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-200 ${
                  submitting || !phone
                    ? "cursor-not-allowed opacity-60"
                    : "cursor-pointer hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-md active:translate-y-0"
                }`}
              >
                {submitting ? (
                  <>Creating… <Loader2 className="h-4 w-4 animate-spin" /></>
                ) : (
                  <>Create my account <ArrowRight className="h-4 w-4" /></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
