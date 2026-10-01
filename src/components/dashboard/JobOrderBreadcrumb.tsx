'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { stageOrder, type Stage } from '@/data/types'

type CrumbKey = 'inspection' | 'quotation' | 'progress' | 'testing' | 'billing' | 'completed'

// Which job-order stage each crumb belongs to. A crumb is only clickable once
// the job order has reached that stage — you can always go back, never ahead.
const CRUMB_STAGE: Partial<Record<CrumbKey, Stage>> = {
  inspection: 'inspecting',
  quotation: 'quotation',
  progress: 'in-progress',
  testing: 'testing',
  billing: 'completed',
  completed: 'released',
}

interface Props {
  jobOrderId: string
  current: CrumbKey
  // The job order's current stage (JobOrderCard.stage).
  stage: Stage
}

export function JobOrderBreadcrumb({ jobOrderId, current, stage }: Props) {
  const reachedIndex = stageOrder.indexOf(stage)

  const crumbs: { key: CrumbKey; label: string; href: string }[] = [
    { key: 'inspection', label: 'Inspection Report', href: `/job-orders/${jobOrderId}/inspection` },
    { key: 'quotation', label: 'Quotation', href: `/job-orders/${jobOrderId}/quotation` },
    { key: 'progress', label: 'Service Progress', href: `/job-orders/${jobOrderId}/progress` },
    { key: 'testing', label: 'Testing', href: `/job-orders/${jobOrderId}/testing` },
    { key: 'billing', label: 'Billing', href: `/job-orders/${jobOrderId}/billing` },
    { key: 'completed', label: 'Completed', href: `/job-orders/${jobOrderId}/completed` },
  ]

  return (
    <div className="space-y-2">
      <Link
        href="/job-orders"
        className="flex w-fit items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 hover:underline"
      >
        <ChevronLeft size={14} /> Back to Customers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          {crumbs.map((c, i) => {
            const isCurrent = c.key === current
            const crumbStage = CRUMB_STAGE[c.key]
            const reachable = !crumbStage || stageOrder.indexOf(crumbStage) <= reachedIndex
            return (
              <span key={c.key} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
                {isCurrent ? (
                  <span className="font-semibold text-slate-900">{c.label}</span>
                ) : reachable ? (
                  <Link
                    href={c.href}
                    className="text-slate-400 hover:text-slate-700 hover:underline"
                  >
                    {c.label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    title="The job order hasn't reached this stage yet"
                    className="cursor-not-allowed text-slate-300"
                  >
                    {c.label}
                  </span>
                )}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}
