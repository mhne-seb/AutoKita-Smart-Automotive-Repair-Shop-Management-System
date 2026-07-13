const styles: Record<string, string> = {
  Pending: 'bg-violet-100 text-violet-700',
  Approved: 'bg-amber-100 text-amber-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  Completed: 'bg-emerald-100 text-emerald-700',
  Cancelled: 'bg-rose-100 text-rose-700',
  Paid: 'bg-emerald-100 text-emerald-700',
  'To Be Paid': 'bg-rose-100 text-rose-700',
  Available: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  Busy: 'bg-slate-100 text-slate-600 border border-slate-200',
  'High Churn Risk': 'bg-rose-100 text-rose-700',
  'Medium Churn Risk': 'bg-amber-100 text-amber-700',
  'Loyal Customer': 'bg-emerald-100 text-emerald-700',
  'New Customer': 'bg-sky-100 text-sky-700 border border-sky-200',
}

export function StatusBadge({ status }: { status: string }) {
  const style = styles[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${style}`}
    >
      {status}
    </span>
  )
}