'use client'

import { Check, AlertCircle, Store } from 'lucide-react'
import { parseConcernText } from '@/lib/concernText'

// The general inspection is part of every PMS package and happens on every job order anyway,
// so it is not listed as something the customer asked for.
const HIDDEN_ITEMS = new Set(['General Mechanical Inspection & Check-Up'])

const GROUP_STYLE: Record<string, string> = {
  Maintenance: 'bg-sky-100 text-sky-700',
  Repair: 'bg-amber-100 text-amber-800',
  Diagnostics: 'bg-violet-100 text-violet-700',
}

// The booking text is saved as one string; show it as groups of services instead of a long line.
export function RequestedServices({ raw, hideCategory = false }: { raw: string; hideCategory?: boolean }) {
  const parsed = parseConcernText(raw)
  const c = {
    ...parsed,
    groups: parsed.groups
      .map((g) => ({ ...g, items: g.items.filter((i) => !HIDDEN_ITEMS.has(i)) }))
      .filter((g) => g.items.length > 0),
  }

  if (c.plain) {
    return (
      <div className="mt-2 rounded-lg border border-border p-4 text-sm text-foreground whitespace-pre-wrap break-words">
        {c.plain}
      </div>
    )
  }

  const hasAnything = (c.category && !hideCategory) || c.groups.length > 0 || c.notSure || c.note || c.other.length > 0
  if (!hasAnything) {
    return <div className="mt-2 rounded-lg border border-border p-4 text-sm text-muted-foreground">No services listed.</div>
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border p-4 text-sm">
      {c.category && !hideCategory && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Booked as</span>
          <span className="rounded-full bg-brand-soft px-3 py-0.5 text-xs font-semibold text-brand">{c.category}</span>
        </div>
      )}

      {c.groups.map((g) => (
        <div key={g.title}>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${GROUP_STYLE[g.title] ?? 'bg-accent text-muted-foreground'}`}>
            {g.title}
          </span>
          <ul className="mt-1.5 space-y-1">
            {g.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-foreground">
                <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {c.notSure && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <span>The customer is not sure what is wrong. Please check the car and tell them what it needs.</span>
        </div>
      )}

      {c.overnight && (
        <div className="flex items-start gap-2 rounded-lg bg-accent px-3 py-2 text-xs text-foreground">
          <Store size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <span>The customer agreed to leave the vehicle overnight.</span>
        </div>
      )}

      {c.other.map((line) => (
        <p key={line} className="text-xs text-muted-foreground break-words">{line}</p>
      ))}

      <div className="border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">Customer note</span>
        <p className={`mt-0.5 whitespace-pre-wrap break-words ${c.note ? 'text-foreground' : 'text-muted-foreground'}`}>
          {c.note ?? 'No note.'}
        </p>
      </div>
    </div>
  )
}
