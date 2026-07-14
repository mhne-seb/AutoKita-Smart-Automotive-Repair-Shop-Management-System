'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronRight, FileText } from 'lucide-react'
import { GenerateJobOrderModal } from './GenerateJobOrderModal'

type CrumbKey = 'jobOrders' | 'inspection' | 'quotation' | 'progress'

interface Props {
  jobOrderId: string
  current: CrumbKey
}

export function JobOrderBreadcrumb({ jobOrderId, current }: Props) {
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const crumbs: { key: CrumbKey; label: string; href: string }[] = [
    { key: 'jobOrders', label: 'Back to Customers', href: '/job-orders' },
    { key: 'inspection', label: 'Inspection Report', href: `/job-orders/${jobOrderId}/inspection` },
    { key: 'quotation', label: 'Quotation', href: `/job-orders/${jobOrderId}/quotation` },
    { key: 'progress', label: 'Service Progress', href: `/job-orders/${jobOrderId}/progress` },
  ]

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumbs.map((c, i) => {
          const isCurrent = c.key === current
          return (
            <span key={c.key} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight size={14} className="text-slate-300" />}
              {isCurrent ? (
                <span className="font-semibold text-slate-900">{c.label}</span>
              ) : (
                <Link
                  href={c.href}
                  className="text-slate-400 hover:text-slate-700 hover:underline"
                >
                  {c.label}
                </Link>
              )}
            </span>
          )
        })}
      </div>

      <button
        onClick={() => setShowGenerateModal(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <FileText size={14} /> Generate Job Order
      </button>

      {showGenerateModal && (
        <GenerateJobOrderModal jobOrderId={jobOrderId} onClose={() => setShowGenerateModal(false)} />
      )}
    </div>
  )
}
