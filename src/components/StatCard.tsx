import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string
  icon: LucideIcon
  iconBg?: string
  iconColor?: string
  trend?: {
    text: string
    positive?: boolean
  }
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconBg = 'bg-slate-100',
  iconColor = 'text-slate-600',
  trend,
}: StatCardProps) {
  return (
    <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon size={16} className={iconColor} />
        </div>
      </div>
      <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
      {trend && (
        <p
          className={`mt-2 text-xs font-medium ${
            trend.positive === false ? 'text-rose-600' : 'text-emerald-600'
          }`}
        >
          {trend.text}
        </p>
      )}
    </div>
  )
}
