import { Bell, Search, SlidersHorizontal } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle: string
  rightSlot?: React.ReactNode
  showFilters?: boolean
}

export function TopBar({ title, subtitle, rightSlot, showFilters }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search tickets, plates, customers..."
            className="w-72 rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          />
        </div>

        {showFilters && (
          <button
            type="button"
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <SlidersHorizontal size={15} />
            Filters
          </button>
        )}

        <button
          type="button"
          aria-label="Notifications"
          className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
        >
          <Bell size={16} className="text-slate-600" />
          <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-rose-500" />
        </button>

        {rightSlot}
      </div>
    </div>
  )
}
