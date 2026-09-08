'use client'

import { Search, SlidersHorizontal } from 'lucide-react'
import { AdminNotificationBell } from '@/components/AdminNotificationBell'

interface TopBarProps {
  title: string
  subtitle: string
  rightSlot?: React.ReactNode
  showFilters?: boolean
  showSearch?: boolean
  searchQuery?: string
  onSearchChange?: (val: string) => void
}

export function TopBar({ title, subtitle, rightSlot, showFilters, showSearch = true, searchQuery, onSearchChange }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {showSearch && (
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchQuery ?? ''}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search tickets, plates, customers..."
              className="w-72 rounded-full border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
          </div>
        </div>
      )}

      {showFilters && (
        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <SlidersHorizontal size={15} />
          Filters
        </button>
      )}

      <AdminNotificationBell />

      {rightSlot}
    </div>
  )
}
