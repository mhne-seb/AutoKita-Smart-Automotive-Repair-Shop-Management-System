'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { startSession } from '@/controllers/authController'
import { Loader2 } from 'lucide-react'

export default function GoogleDonePage() {
  const router = useRouter()
  const [error, setError] = useState(false)

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
        if (data.role === 'customer' && next === 'book') {
          router.replace('/dashboard?book=1')
        } else {
          router.replace(data.role === 'customer' ? '/dashboard' : '/overview')
        }
      })
      .catch(() => {
        router.replace('/login?google=failed')
      })
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground animate-pulse">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium">Signing you in…</p>
      </div>
    </div>
  )
}
