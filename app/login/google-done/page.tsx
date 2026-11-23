'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/controllers/authController'
import { Loader2 } from 'lucide-react'

export default function GoogleDonePage() {
  const router = useRouter()
  const started = useRef(false)
  const [password, setPassword] = useState<string | null>(null)
  const [destination, setDestination] = useState('/dashboard')
  const [loadError, setLoadError] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  const checkGeneratedPassword = useCallback(async (nextPage: string) => {
    setLoadError(false)
    try {
      const response = await fetch('/api/auth/google/generated-password', {
        method: 'POST',
        cache: 'no-store',
      })
      if (!response.ok) throw new Error('Could not check the generated password.')

      const data: { success?: boolean; password?: string | null } = await response.json()
      if (!data.success) throw new Error('Could not check the generated password.')

      if (typeof data.password === 'string' && data.password) {
        setPassword(data.password)
      } else {
        router.replace(nextPage)
      }
    } catch {
      // Let the customer retry before the short-lived cookie expires.
      setLoadError(true)
    }
  }, [router])

  useEffect(() => {
    // React development mode may run effects twice; the endpoint consumes the cookie.
    if (started.current) return
    started.current = true

    async function finishSignIn() {
      const searchParams = new URLSearchParams(window.location.search)
      const role = searchParams.get('role')
      const remember = searchParams.get('remember') === '1'

      if (role !== 'customer' && role !== 'staff') {
        router.replace('/login?google=failed')
        return
      }

      try {
        const response = await fetch(`/api/auth/google/profile?role=${role}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Could not load the signed-in profile.')
        const data = await response.json()
        if (!data.success || !data.userId || !data.role) {
          throw new Error('No signed-in profile.')
        }

        startSession(data.role, data.userId, remember, { name: data.name, title: data.title })
        if (data.role !== 'customer') {
          router.replace('/overview')
          return
        }

        const next = searchParams.get('next')
        const nextPage = next === 'book'
          ? '/dashboard/book'
          : next === 'vehicles'
            ? '/dashboard/vehicles'
            : '/dashboard'
        setDestination(nextPage)
        await checkGeneratedPassword(nextPage)
      } catch {
        router.replace('/login?google=failed')
      }
    }

    void finishSignIn()
  }, [checkGeneratedPassword, router])

  async function copyPassword() {
    if (!password) return
    try {
      await navigator.clipboard.writeText(password)
      setCopyMessage('Password copied.')
    } catch {
      setCopyMessage('Select the password above and copy it manually.')
    }
  }

  if (password) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Save your AutoKita password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            You can sign in with this password and your email, or continue with Google.
            Save it now because it will not be shown again.
          </p>
          <input
            readOnly
            type="text"
            value={password}
            aria-label="Generated AutoKita password"
            onFocus={(event) => event.currentTarget.select()}
            className="mt-5 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
          {copyMessage && <p className="mt-2 text-sm" role="status">{copyMessage}</p>}
          <div className="mt-5 flex gap-3">
            <button type="button" onClick={copyPassword} className="rounded-md border px-4 py-2 text-sm">
              Copy password
            </button>
            <button
              type="button"
              onClick={() => router.replace(destination)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Continue
            </button>
          </div>
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Could not show your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Try again. You can still use Google to sign in if the password is unavailable.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={() => void checkGeneratedPassword(destination)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => router.replace(destination)}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white"
            >
              Continue with Google
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Signing you in…</p>
      </div>
    </div>
  )
}
