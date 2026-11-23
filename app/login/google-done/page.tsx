'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/controllers/authController'
import { Loader2 } from 'lucide-react'

export default function GoogleDonePage() {
  const router = useRouter()
  const [mailFailed, setMailFailed] = useState(false)
  const [destination, setDestination] = useState('/dashboard')

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const role = searchParams.get('role')
    const remember = searchParams.get('remember') === '1'

    if (!role) {
      router.replace('/login?google=failed')
      return
    }

    fetch(`/api/auth/google/profile?role=${role}`)
      .then(res => res.json())
      .then(data => {
        if (!data.success || !data.userId || !data.role) {
          router.replace('/login?google=failed')
          return
        }
        startSession(data.role, data.userId, remember, { name: data.name, title: data.title })
        const next = searchParams.get('next')
        if (data.role === 'customer') {
          const nextPage = next === 'book' ? '/dashboard/book'
            : next === 'vehicles' ? '/dashboard/vehicles' : '/dashboard'
          if (searchParams.get('passwordEmail') === 'failed') {
            setDestination(nextPage)
            setMailFailed(true)
            return
          }
          router.replace(nextPage)
        } else {
          router.replace('/overview')
        }
      })
      .catch(() => {
        router.replace('/login?google=failed')
      })
  }, [router])

  if (mailFailed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold">We could not email your password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is ready. Continue with Google, and use Forgot password
            on the sign-in page if you want to set a password later.
          </p>
          <button type="button" onClick={() => router.replace(destination)}
            className="mt-5 rounded-md bg-slate-900 px-4 py-2 text-sm text-white">
            Continue with Google
          </button>
        </div>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Signing you inΓÇª</p>
      </div>
    </div>
  )
}
