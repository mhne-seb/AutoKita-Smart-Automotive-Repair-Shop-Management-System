'use client'

import { useEffect } from 'react'
import { Logo } from '@/components/site/Logo'
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  useEffect(() => {
    document.title = 'Create account — AutoKita'
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <SignupForm heading="Create your account" />
        </div>
      </div>
    </div>
  )
}
