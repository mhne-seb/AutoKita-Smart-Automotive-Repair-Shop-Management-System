'use client'

import { Check, X } from 'lucide-react'
import { getPasswordRequirements } from '@/lib/passwordPolicy'

interface PasswordChecklistProps {
  password: string
  className?: string
}

export function PasswordChecklist({ password, className = '' }: PasswordChecklistProps) {
  const reqs = getPasswordRequirements(password)
  const unmet = reqs.filter((r) => !r.met)
  const allMet = unmet.length === 0 && Boolean(password)

  return (
    <div className={`rounded-lg border border-border/80 bg-muted/30 p-3 text-xs ${className}`}>
      <div className="mb-2 flex items-center justify-between font-medium">
        <span className="text-muted-foreground">Password requirements:</span>
        {allMet && (
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
            <Check className="h-3.5 w-3.5" /> All requirements met
          </span>
        )}
      </div>
      <ul className="space-y-1.5">
        {reqs.map((req) => (
          <li
            key={req.id}
            className={`flex items-center gap-2 transition-colors ${
              req.met
                ? 'font-medium text-emerald-600 dark:text-emerald-400'
                : 'text-muted-foreground'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                req.met
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : 'bg-muted text-muted-foreground border border-border'
              }`}
            >
              {req.met ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : '•'}
            </span>
            <span>{req.label}</span>
          </li>
        ))}
      </ul>
      {Boolean(password) && unmet.length > 0 && (
        <p className="mt-2.5 border-t border-border/60 pt-2 text-[11px] font-medium text-destructive">
          Missing: {unmet.map((r) => r.label).join(', ')}
        </p>
      )}
    </div>
  )
}

