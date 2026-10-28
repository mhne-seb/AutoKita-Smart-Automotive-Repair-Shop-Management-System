'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  Calendar as CalendarIcon,
  Clock,
  ChevronLeft,
  ChevronRight,
  Filter,
  User,
  Car,
  Wrench,
  CheckCircle2,
  Clock3,
  AlertCircle,
  ExternalLink,
  Search,
  Users,
  Eye,
  CalendarDays,
  X,
  MapPin,
  Phone,
  Mail,
  Check,
  Plus,
  ArrowRight,
  Settings,
  Menu,
  Briefcase,
  Layers,
  Sparkles,
  Columns,
  AlignJustify,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { ScheduleTask, Mechanic } from '@/controllers/mechanicController'
import { formatHours } from '@/lib/formatHours'

const GRADIENT = 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]'

// Rich, modern, glassmorphic theme palettes per mechanic
export const MECHANIC_THEMES: Record<number, {
  name: string
  accentColor: string
  borderAccent: string
  cardBg: string
  cardBorder: string
  badgeBg: string
  badgeText: string
  dot: string
  solidBg: string
}> = {
  6: { // Mark Reyes
    name: 'Mark Reyes',
    accentColor: '#38bdf8', // sky-400
    borderAccent: 'border-l-sky-400',
    cardBg: 'bg-[#0f172a]/90 hover:bg-[#1e293b]',
    cardBorder: 'border-sky-500/30',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    dot: 'bg-sky-400',
    solidBg: 'bg-sky-600',
  },
  2: { // Mike Wrench
    name: 'Mike Wrench',
    accentColor: '#34d399', // emerald-400
    borderAccent: 'border-l-emerald-400',
    cardBg: 'bg-[#062017]/90 hover:bg-[#064e3b]/80',
    cardBorder: 'border-emerald-500/30',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    dot: 'bg-emerald-400',
    solidBg: 'bg-emerald-600',
  },
  19: { // Samuel
    name: 'Samuel',
    accentColor: '#c084fc', // purple-400
    borderAccent: 'border-l-purple-400',
    cardBg: 'bg-[#1e1338]/90 hover:bg-[#2e1065]/80',
    cardBorder: 'border-purple-500/30',
    badgeBg: 'bg-purple-500/20',
    badgeText: 'text-purple-300',
    dot: 'bg-purple-400',
    solidBg: 'bg-purple-600',
  },
  3: { // Steve Bolt
    name: 'Steve Bolt',
    accentColor: '#fbbf24', // amber-400
    borderAccent: 'border-l-amber-400',
    cardBg: 'bg-[#241705]/90 hover:bg-[#451a03]/80',
    cardBorder: 'border-amber-500/30',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    dot: 'bg-amber-400',
    solidBg: 'bg-amber-600',
  },
}

const FALLBACK_THEMES = [
  { accentColor: '#38bdf8', borderAccent: 'border-l-sky-400', cardBg: 'bg-[#0f172a]/90', cardBorder: 'border-sky-500/30', badgeBg: 'bg-sky-500/20', badgeText: 'text-sky-300', dot: 'bg-sky-400', solidBg: 'bg-sky-600' },
  { accentColor: '#34d399', borderAccent: 'border-l-emerald-400', cardBg: 'bg-[#062017]/90', cardBorder: 'border-emerald-500/30', badgeBg: 'bg-emerald-500/20', badgeText: 'text-emerald-300', dot: 'bg-emerald-400', solidBg: 'bg-emerald-600' },
  { accentColor: '#c084fc', borderAccent: 'border-l-purple-400', cardBg: 'bg-[#1e1338]/90', cardBorder: 'border-purple-500/30', badgeBg: 'bg-purple-500/20', badgeText: 'text-purple-300', dot: 'bg-purple-400', solidBg: 'bg-purple-600' },
  { accentColor: '#fbbf24', borderAccent: 'border-l-amber-400', cardBg: 'bg-[#241705]/90', cardBorder: 'border-amber-500/30', badgeBg: 'bg-amber-500/20', badgeText: 'text-amber-300', dot: 'bg-amber-400', solidBg: 'bg-amber-600' },
  { accentColor: '#f43f5e', borderAccent: 'border-l-rose-400', cardBg: 'bg-[#250912]/90', cardBorder: 'border-rose-500/30', badgeBg: 'bg-rose-500/20', badgeText: 'text-rose-300', dot: 'bg-rose-400', solidBg: 'bg-rose-600' },
  { accentColor: '#2dd4bf', borderAccent: 'border-l-teal-400', cardBg: 'bg-[#04201e]/90', cardBorder: 'border-teal-500/30', badgeBg: 'bg-teal-500/20', badgeText: 'text-teal-300', dot: 'bg-teal-400', solidBg: 'bg-teal-600' },
]

export function getMechanicTheme(mechanicId: number | null | undefined) {
  if (!mechanicId) return FALLBACK_THEMES[0]
  if (MECHANIC_THEMES[mechanicId]) return MECHANIC_THEMES[mechanicId]
  return FALLBACK_THEMES[Math.abs(Number(mechanicId)) % FALLBACK_THEMES.length]
}

function avatarUrl(name: string) {
  const hash = (name || 'M').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  const bg = ['1e3a5f', '0f766e', 'b45309', '7c3aed', 'be123c', '15803d'][hash % 6]
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'M')}&background=${bg}&color=fff&size=120&bold=true`
}

const currency = (v: number) => `₱${Number(v || 0).toLocaleString()}`

const fmtDateLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const fmtMonthYear = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const fmtTime = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const fmtShortTime = (d: Date) => {
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'pm' : 'am'
  const displayH = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${displayH}${ampm}` : `${displayH}:${String(m).padStart(2, '0')}${ampm}`
}

const isSameDay = (d1: Date, d2: Date) =>
  d1.getFullYear() === d2.getFullYear() &&
  d1.getMonth() === d2.getMonth() &&
  d1.getDate() === d2.getDate()

type ViewMode = 'timeline' | 'agenda'

interface LayoutEvent {
  task: ScheduleTask
  startMinutes: number
  endMinutes: number
  colIndex: number
  totalCols: number
}

// Compute overlapping sub-columns for tasks sharing a lane
function computeEventLayout(tasks: ScheduleTask[], targetDate: Date): LayoutEvent[] {
  const dayTasks = tasks
    .filter((t) => {
      if (!t.scheduled_date) return false
      const d = new Date(t.scheduled_date)
      return isSameDay(d, targetDate)
    })
    .map((t) => {
      const start = new Date(t.scheduled_date!)
      const startMin = start.getHours() * 60 + start.getMinutes()
      const estHours = Number(t.estimated_hours || 1.5)
      let endMin = startMin + Math.round(estHours * 60)
      if (t.estimated_finish) {
        const finish = new Date(t.estimated_finish)
        if (!isNaN(finish.getTime()) && isSameDay(finish, start)) {
          const calcEnd = finish.getHours() * 60 + finish.getMinutes()
          if (calcEnd > startMin) endMin = calcEnd
        }
      }
      // Give minimum 35 minutes for comfortable visual presentation
      if (endMin - startMin < 35) {
        endMin = startMin + 35
      }
      return {
        task: t,
        startMinutes: Math.max(0, startMin),
        endMinutes: Math.min(24 * 60, endMin),
        colIndex: 0,
        totalCols: 1,
      }
    })
    .sort((a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes))

  if (dayTasks.length === 0) return []

  const active: { endMinutes: number; colIndex: number }[] = []
  const clusterGroups: LayoutEvent[][] = []
  let currentCluster: LayoutEvent[] = []
  let clusterEnd = 0

  for (const item of dayTasks) {
    if (item.startMinutes >= clusterEnd && currentCluster.length > 0) {
      clusterGroups.push(currentCluster)
      currentCluster = []
      active.length = 0
    }

    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMinutes <= item.startMinutes) {
        active.splice(i, 1)
      }
    }

    const usedCols = new Set(active.map((a) => a.colIndex))
    let col = 0
    while (usedCols.has(col)) {
      col++
    }

    item.colIndex = col
    active.push({ endMinutes: item.endMinutes, colIndex: col })
    currentCluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMinutes)
  }

  if (currentCluster.length > 0) {
    clusterGroups.push(currentCluster)
  }

  for (const cluster of clusterGroups) {
    const maxCol = cluster.reduce((m, c) => Math.max(m, c.colIndex), 0) + 1
    for (const c of cluster) {
      c.totalCols = maxCol
    }
  }

  return dayTasks
}

export interface GroupedJobOrder {
  id: string
  job_order_id: number
  mechanic_id: number
  mechanic_name: string
  vehicle_model: string | null
  vehicle_year: number | null
  plate_number: string | null
  customer_name: string | null
  customer_phone: string | null
  customer_email: string | null
  job_order_status: string | null
  scheduled_date: string
  estimated_finish: string
  total_price: number
  total_hours: number
  primary_task_title: string
  tasks: ScheduleTask[]
}

export interface LayoutJobOrderEvent {
  jobOrder: GroupedJobOrder
  startMinutes: number
  endMinutes: number
  colIndex: number
  totalCols: number
}

// Group multiple concurrent services on the same vehicle / Job Order into one cohesive block
export function groupTasksByJobOrder(tasks: ScheduleTask[], targetDate: Date): GroupedJobOrder[] {
  const map = new Map<string, GroupedJobOrder>()

  for (const t of tasks) {
    if (!t.scheduled_date) continue
    const d = new Date(t.scheduled_date)
    if (!isSameDay(d, targetDate)) continue

    const key = `${t.mechanic_id || 0}_${t.job_order_id}`

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        job_order_id: t.job_order_id,
        mechanic_id: t.mechanic_id || 0,
        mechanic_name: t.mechanic_name || 'Mechanic',
        vehicle_model: t.vehicle_model,
        vehicle_year: t.vehicle_year,
        plate_number: t.plate_number,
        customer_name: t.customer_name,
        customer_phone: t.customer_phone,
        customer_email: t.customer_email,
        job_order_status: t.job_order_status,
        scheduled_date: t.scheduled_date,
        estimated_finish: t.estimated_finish || t.scheduled_date,
        total_price: 0,
        total_hours: 0,
        primary_task_title: t.title,
        tasks: [],
      })
    }

    const group = map.get(key)!
    group.tasks.push(t)
    group.total_price += Number(t.price || 0)
    group.total_hours += Number(t.estimated_hours || 1.5)

    if (new Date(t.scheduled_date).getTime() < new Date(group.scheduled_date).getTime()) {
      group.scheduled_date = t.scheduled_date
    }
    const finish = t.estimated_finish || t.scheduled_date
    if (new Date(finish).getTime() > new Date(group.estimated_finish).getTime()) {
      group.estimated_finish = finish
    }
  }

  return Array.from(map.values())
}

export function computeJobOrderLayout(jobOrders: GroupedJobOrder[]): LayoutJobOrderEvent[] {
  const items = jobOrders
    .map((jo) => {
      const start = new Date(jo.scheduled_date)
      const startMin = start.getHours() * 60 + start.getMinutes()

      let endMin = startMin + 45
      if (jo.estimated_finish) {
        const finish = new Date(jo.estimated_finish)
        if (!isNaN(finish.getTime()) && isSameDay(finish, start)) {
          const calcEnd = finish.getHours() * 60 + finish.getMinutes()
          if (calcEnd > startMin) endMin = calcEnd
        }
      } else {
        endMin = startMin + Math.round(jo.total_hours * 60)
      }

      if (endMin - startMin < 45) {
        endMin = startMin + 45
      }

      return {
        jobOrder: jo,
        startMinutes: Math.max(0, startMin),
        endMinutes: Math.min(24 * 60, endMin),
        colIndex: 0,
        totalCols: 1,
      }
    })
    .sort(
      (a, b) =>
        a.startMinutes - b.startMinutes ||
        (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes)
    )

  if (items.length === 0) return []

  const active: { endMinutes: number; colIndex: number }[] = []
  const clusterGroups: LayoutJobOrderEvent[][] = []
  let currentCluster: LayoutJobOrderEvent[] = []
  let clusterEnd = 0

  for (const item of items) {
    if (item.startMinutes >= clusterEnd && currentCluster.length > 0) {
      clusterGroups.push(currentCluster)
      currentCluster = []
      active.length = 0
    }

    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].endMinutes <= item.startMinutes) {
        active.splice(i, 1)
      }
    }

    const usedCols = new Set(active.map((a) => a.colIndex))
    let col = 0
    while (usedCols.has(col)) {
      col++
    }

    item.colIndex = col
    active.push({ endMinutes: item.endMinutes, colIndex: col })
    currentCluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.endMinutes)
  }

  if (currentCluster.length > 0) {
    clusterGroups.push(currentCluster)
  }

  for (const cluster of clusterGroups) {
    const maxCol = cluster.reduce((m, c) => Math.max(m, c.colIndex), 0) + 1
    for (const c of cluster) {
      c.totalCols = maxCol
    }
  }

  return items
}

interface MechanicCalendarProps {
  tasks: ScheduleTask[]
  mechanics: Mechanic[]
  selectedMechanicIds?: number[]
  onSelectMechanics?: (ids: number[]) => void
  selectedMechanicId?: number | 'all'
  onSelectMechanic?: (id: number | 'all') => void
  onOpenMechanicProfile?: (mechanic: Mechanic) => void
}

export function MechanicCalendar({
  tasks,
  mechanics,
  selectedMechanicIds: propsSelectedMechanicIds,
  onSelectMechanics,
  selectedMechanicId,
  onSelectMechanic,
  onOpenMechanicProfile
}: MechanicCalendarProps) {
  // Calendar Navigation
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [viewMode, setViewMode] = useState<ViewMode>('timeline')
  const [selectedDayFilter, setSelectedDayFilter] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedTask, setSelectedTask] = useState<ScheduleTask | null>(null)
  const [selectedJobOrder, setSelectedJobOrder] = useState<GroupedJobOrder | null>(null)
  const [groupByJobOrder, setGroupByJobOrder] = useState<boolean>(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Multi-select state: track selected mechanic IDs (supports checking 2, 3, or all mechanics)
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>(() =>
    mechanics.map((m) => m.id)
  )

  // Auto-initialize internal selection to all mechanics when list is available
  useEffect(() => {
    if (
      mechanics.length > 0 &&
      internalSelectedIds.length === 0 &&
      (!propsSelectedMechanicIds || propsSelectedMechanicIds.length === 0)
    ) {
      setInternalSelectedIds(mechanics.map((m) => m.id))
    }
  }, [mechanics])

  const activeMechanicIds = useMemo(() => {
    if (propsSelectedMechanicIds !== undefined) {
      return propsSelectedMechanicIds
    }
    return internalSelectedIds
  }, [propsSelectedMechanicIds, internalSelectedIds])

  const updateSelectedMechanicIds = (newIds: number[]) => {
    setInternalSelectedIds(newIds)
    onSelectMechanics?.(newIds)
    if (onSelectMechanic) {
      if (newIds.length === mechanics.length) {
        onSelectMechanic('all')
      } else if (newIds.length === 1) {
        onSelectMechanic(newIds[0])
      }
    }
  }

  // Scroll time grid to business hours (~7:00 AM) on initial load
  const timeGridRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (timeGridRef.current) {
      timeGridRef.current.scrollTop = 420
    }
  }, [viewMode])

  // Filter tasks based on search query AND active mechanic selection (strictly only selected mechanics!)
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Must belong to one of the checked mechanics
      if (activeMechanicIds.length === 0) return false
      if (!t.mechanic_id || !activeMechanicIds.includes(Number(t.mechanic_id))) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchTitle = t.title?.toLowerCase().includes(q)
        const matchJO = String(t.job_order_id).includes(q) || `jo-${t.job_order_id}`.includes(q)
        const matchPlate = t.plate_number?.toLowerCase().includes(q)
        const matchVehicle = t.vehicle_model?.toLowerCase().includes(q)
        const matchCustomer = t.customer_name?.toLowerCase().includes(q)
        const matchMechanic = t.mechanic_name?.toLowerCase().includes(q)
        if (!matchTitle && !matchJO && !matchPlate && !matchVehicle && !matchCustomer && !matchMechanic) {
          return false
        }
      }
      return true
    })
  }, [tasks, activeMechanicIds, searchQuery])

  // Date Navigation
  const navigatePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() - 1)
      if (selectedDayFilter) {
        setSelectedDayFilter(new Date(next))
      }
      return next
    })
  }

  const navigateNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev)
      next.setDate(next.getDate() + 1)
      if (selectedDayFilter) {
        setSelectedDayFilter(new Date(next))
      }
      return next
    })
  }

  const navigateToday = () => {
    const now = new Date()
    setCurrentDate(now)
    if (viewMode === 'agenda') {
      setSelectedDayFilter(now)
    }
  }

  return (
    <div className="flex flex-col h-[860px] w-full rounded-2xl border border-slate-800/90 bg-[#0d1117] text-slate-100 shadow-2xl overflow-hidden font-sans">
      {/* ========================================================================= */}
      {/* TOP BAR                                                                   */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800/90 bg-[#161b22] px-5 py-3 gap-4 shrink-0">
        {/* Left: Brand & Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-2.5 mr-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 font-extrabold text-white shadow-md text-sm ring-1 ring-white/20">
              {new Date().getDate()}
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white block leading-none">
                Mechanic Schedule
              </span>
              <span className="text-[11px] text-slate-400 font-medium">AutoKita Workshop</span>
            </div>
          </div>

          <button
            onClick={navigateToday}
            className="rounded-lg border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            Today
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={navigatePrev}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={navigateNext}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <span className="text-base font-bold text-slate-100 ml-1">
            {fmtMonthYear(currentDate)}
          </span>
        </div>

        {/* Center: Search */}
        <div className="relative min-w-[200px] max-w-sm flex-1 hidden md:block">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search service, JO #, vehicle, plate..."
            className="w-full rounded-xl border border-slate-700/80 bg-slate-900/90 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none transition-all shadow-inner"
          />
        </div>

        {/* Job Order Grouping Mode Switcher - Only shown in Agenda view! */}
        {viewMode === 'agenda' && (
          <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-900/80 p-1 text-xs font-semibold animate-fadeIn">
            <button
              onClick={() => setGroupByJobOrder(true)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                groupByJobOrder
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Group concurrent services into clean Job Order blocks (Recommended)"
            >
              <Briefcase size={12} />
              <span className="hidden sm:inline">By Job Order</span>
              <span className="sm:hidden">Job Orders</span>
            </button>
            <button
              onClick={() => setGroupByJobOrder(false)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                !groupByJobOrder
                  ? 'bg-blue-600 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Show individual service tasks separately"
            >
              <Wrench size={12} />
              <span className="hidden sm:inline">By Service</span>
              <span className="sm:hidden">Services</span>
            </button>
          </div>
        )}

        {/* Right: View Switcher (Timeline & Agenda only) */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-900/80 p-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode('timeline')}
              className={`rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
                viewMode === 'timeline'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`rounded-lg px-3.5 py-1.5 transition-all cursor-pointer ${
                viewMode === 'agenda'
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Agenda
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BODY                                                                      */}
      {/* ========================================================================= */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT SIDEBAR */}
        {sidebarOpen && (
          <div className="w-72 border-r border-slate-800/90 bg-[#161b22] p-4 flex flex-col gap-5 overflow-y-auto shrink-0 select-none">
            {/* Mini Month Picker */}
            <MiniMonthPicker
              currentDate={currentDate}
              selectedDayFilter={selectedDayFilter}
              onSelectDate={(d) => {
                setCurrentDate(d)
                setSelectedDayFilter(d)
              }}
            />

            {/* Mechanics Filter List */}
            <div className="space-y-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Mechanics
                </span>
                <div className="flex items-center gap-2">
                  {activeMechanicIds.length < mechanics.length ? (
                    <button
                      onClick={() => updateSelectedMechanicIds(mechanics.map((m) => m.id))}
                      className="text-[11px] font-semibold text-blue-400 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                  ) : (
                    <button
                      onClick={() => updateSelectedMechanicIds([])}
                      className="text-[11px] font-semibold text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  )}
                </div>
              </div>

              {/* All Mechanics Button */}
              {(() => {
                const allSelected = mechanics.length > 0 && activeMechanicIds.length === mechanics.length
                const someSelected = activeMechanicIds.length > 0 && activeMechanicIds.length < mechanics.length

                return (
                  <button
                    onClick={() => {
                      if (allSelected) {
                        updateSelectedMechanicIds([])
                      } else {
                        updateSelectedMechanicIds(mechanics.map((m) => m.id))
                      }
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-all cursor-pointer ${
                      allSelected
                        ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40 shadow-xs'
                        : someSelected
                        ? 'bg-slate-800/80 text-slate-200 border border-slate-700/60'
                        : 'text-slate-400 hover:bg-slate-800/60 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-4 w-4 items-center justify-center rounded transition-colors ${
                        allSelected
                          ? 'bg-blue-600 text-white'
                          : someSelected
                          ? 'bg-blue-600/60 text-white'
                          : 'border border-slate-600 bg-slate-800'
                      }`}>
                        {allSelected && <Check size={11} strokeWidth={3} />}
                        {someSelected && <span className="h-1.5 w-1.5 rounded-xs bg-white" />}
                      </span>
                      <span>All Mechanics</span>
                    </div>
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                      {activeMechanicIds.length}/{mechanics.length}
                    </span>
                  </button>
                )
              })()}

              {/* Individual Mechanic Cards (Multi-Selectable) */}
              <div className="space-y-1.5">
                {mechanics.map((m) => {
                  const theme = getMechanicTheme(m.id)
                  const isSelected = activeMechanicIds.includes(m.id)
                  const onLeave = m.employeeStatus === 'on_leave'
                  const full = m.openTasks >= m.jobsCapacity

                  const toggleSelect = () => {
                    if (isSelected) {
                      updateSelectedMechanicIds(activeMechanicIds.filter((id) => id !== m.id))
                    } else {
                      updateSelectedMechanicIds([...activeMechanicIds, m.id])
                    }
                  }

                  const selectOnlyThis = (e: React.MouseEvent) => {
                    e.stopPropagation()
                    updateSelectedMechanicIds([m.id])
                  }

                  return (
                    <div
                      key={m.id}
                      onClick={toggleSelect}
                      className={`group w-full flex items-center justify-between rounded-xl p-2 text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-slate-800/90 text-white font-bold border-slate-600 shadow-sm ring-1 ring-white/15'
                          : 'text-slate-400 border-transparent hover:bg-slate-800/40 hover:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Colored Accent Checkbox */}
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded transition-colors shrink-0"
                          style={{
                            backgroundColor: isSelected ? theme.accentColor : 'transparent',
                            borderColor: isSelected ? theme.accentColor : '#475569',
                            borderWidth: 1.5,
                          }}
                        >
                          {isSelected && (
                            <Check size={11} strokeWidth={3} className="text-black font-extrabold" />
                          )}
                        </span>

                        <div className="text-left min-w-0">
                          <p className={`font-bold truncate ${isSelected ? 'text-slate-100' : 'text-slate-400'}`}>
                            {m.name}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">{m.rank || 'Mechanic'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Quick 'Only' button to isolate this mechanic */}
                        <button
                          onClick={selectOnlyThis}
                          title={`Show only ${m.name}`}
                          className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded bg-slate-700 hover:bg-blue-600 text-[9.5px] font-semibold text-slate-200 hover:text-white cursor-pointer"
                        >
                          Only
                        </button>

                        {onLeave ? (
                          <span className="rounded bg-amber-500/20 text-amber-300 px-1.5 py-0.2 text-[9px] font-semibold border border-amber-500/30">
                            Leave
                          </span>
                        ) : (
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            full ? 'bg-rose-500/20 text-rose-300' : 'bg-slate-800 text-slate-400'
                          }`}>
                            {m.openTasks}/{m.jobsCapacity}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mechanic Filtering Helper Note */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3 text-[11px] text-slate-400 leading-relaxed space-y-1">
                <p className="font-semibold text-slate-300 flex items-center gap-1">
                  <Filter size={12} className="text-blue-400" /> Mechanic Filter
                </p>
                <p className="text-[10.5px]">
                  {activeMechanicIds.length === 0
                    ? 'No mechanics selected. Check one or more mechanics above to view their schedule.'
                    : activeMechanicIds.length === mechanics.length
                    ? 'Showing services for all mechanics. Check specific mechanics to view only their assigned jobs.'
                    : `Filtered to ${activeMechanicIds.length} mechanic${activeMechanicIds.length > 1 ? 's' : ''}. Only their services appear on the calendar.`}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CALENDAR DISPLAY AREA */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
          {viewMode === 'timeline' && (
            <ModernTimelineView
              currentDate={currentDate}
              tasks={visibleTasks}
              mechanics={mechanics}
              selectedMechanicIds={activeMechanicIds}
              groupByJobOrder={false}
              onSelectTask={setSelectedTask}
              onSelectJobOrder={setSelectedJobOrder}
            />
          )}

          {viewMode === 'agenda' && (
            <ModernAgendaView
              tasks={visibleTasks}
              currentDate={currentDate}
              selectedMechanicIds={activeMechanicIds}
              groupByJobOrder={groupByJobOrder}
              selectedDayFilter={selectedDayFilter}
              onClearDayFilter={() => setSelectedDayFilter(null)}
              onSelectDayFilter={(d) => {
                setSelectedDayFilter(d)
                setCurrentDate(d)
              }}
              onSelectTask={setSelectedTask}
              onSelectJobOrder={setSelectedJobOrder}
              onSelectDay={(d) => {
                setCurrentDate(d)
                setViewMode('timeline')
              }}
            />
          )}
        </div>
      </div>

      {/* JOB ORDER DETAIL MODAL */}
      {selectedJobOrder && (
        <JobOrderDetailModal
          jobOrder={selectedJobOrder}
          onClose={() => setSelectedJobOrder(null)}
          onSelectTask={setSelectedTask}
        />
      )}

      {/* SERVICE DETAIL MODAL */}
      {selectedTask && (
        <ServiceDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

// =========================================================================
// MINI MONTH PICKER
// =========================================================================

function MiniMonthPicker({
  currentDate,
  selectedDayFilter,
  onSelectDate,
}: {
  currentDate: Date
  selectedDayFilter?: Date | null
  onSelectDate: (d: Date) => void
}) {
  const [displayMonth, setDisplayMonth] = useState<Date>(() => new Date(currentDate))

  useEffect(() => {
    setDisplayMonth(new Date(currentDate))
  }, [currentDate])

  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const days: { date: Date; inMonth: boolean }[] = []
  const offset = firstDay.getDay()

  for (let i = offset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true })
  }
  const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), inMonth: false })
  }

  const today = new Date()

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold text-slate-200">
        <span>{fmtMonthYear(displayMonth)}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDisplayMonth(new Date(year, month - 1, 1))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => setDisplayMonth(new Date(year, month + 1, 1))}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-slate-500">
        <span>S</span>
        <span>M</span>
        <span>T</span>
        <span>W</span>
        <span>T</span>
        <span>F</span>
        <span>S</span>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {days.map(({ date, inMonth }, i) => {
          const isToday = isSameDay(date, today)
          const isFiltered = selectedDayFilter && isSameDay(date, selectedDayFilter)
          const isSelected = !selectedDayFilter && isSameDay(date, currentDate)

          return (
            <button
              key={i}
              onClick={() => onSelectDate(date)}
              className={`flex h-6 w-6 mx-auto items-center justify-center rounded-full text-[11px] transition-colors cursor-pointer ${
                isFiltered
                  ? 'bg-blue-600 font-bold text-white shadow-md ring-2 ring-blue-400'
                  : isToday
                  ? 'bg-blue-600/80 font-bold text-white shadow-xs'
                  : isSelected
                  ? 'bg-blue-600/30 font-bold text-blue-300'
                  : inMonth
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-600 hover:bg-slate-800/40'
              }`}
            >
              {date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// =========================================================================
// MODERN DAY VIEW (Dedicated Mechanic Columns — Ultra Pleasing!)
// =========================================================================

function ModernDayView({
  currentDate,
  tasks,
  mechanics,
  selectedMechanicIds,
  groupByJobOrder = true,
  onSelectTask,
  onSelectJobOrder,
  timeGridRef,
}: {
  currentDate: Date
  tasks: ScheduleTask[]
  mechanics: Mechanic[]
  selectedMechanicIds: number[]
  groupByJobOrder?: boolean
  onSelectTask: (t: ScheduleTask) => void
  onSelectJobOrder: (jo: GroupedJobOrder) => void
  timeGridRef: React.RefObject<HTMLDivElement | null>
}) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const today = new Date()
  const isToday = isSameDay(currentDate, today)

  // Track expanded cards (for accordion functionality)
  const [expandedJoIds, setExpandedJoIds] = useState<Set<string>>(new Set())
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())

  const toggleExpandJo = (id: string) => {
    setExpandedJoIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleExpandTask = (id: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Determine which mechanics to show columns for (strictly only checked mechanics!)
  const displayedMechanics = useMemo(() => {
    return mechanics.filter((m) => selectedMechanicIds.includes(m.id))
  }, [mechanics, selectedMechanicIds])

  // Precompute layout for each mechanic for this day (Job Orders vs Individual Tasks)
  const mechanicJobOrderLayouts = useMemo(() => {
    return displayedMechanics.map((mech) => {
      const mechTasks = tasks.filter((t) => Number(t.mechanic_id) === Number(mech.id))
      const jobOrders = groupTasksByJobOrder(mechTasks, currentDate)
      return computeJobOrderLayout(jobOrders)
    })
  }, [displayedMechanics, tasks, currentDate])

  const mechanicTaskLayouts = useMemo(() => {
    return displayedMechanics.map((mech) => {
      const mechTasks = tasks.filter((t) => Number(t.mechanic_id) === Number(mech.id))
      return computeEventLayout(mechTasks, currentDate)
    })
  }, [displayedMechanics, tasks, currentDate])

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowTopPx = nowMinutes

  if (displayedMechanics.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Users size={36} className="mb-2 text-slate-600" />
        <p className="text-sm font-semibold text-slate-200">No Mechanics Selected</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Select one or more mechanics from the sidebar to view their schedule columns.
        </p>
      </div>
    )
  }

  // Minimum column width so columns never crunch into unreadable widths
  const colMinWidth = 280
  const minContainerWidth = Math.max(760, displayedMechanics.length * colMinWidth + 64)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
      {/* Outer Horizontal Scroll Container keeping header & grid in sync */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
        <div className="flex flex-col flex-1" style={{ minWidth: `${minContainerWidth}px` }}>
          {/* Day Header Row: Mechanic Column Titles */}
          <div className="flex border-b border-slate-800/90 bg-[#161b22] pr-3 shrink-0">
            <div className="w-16 shrink-0 border-r border-slate-800 py-3 text-center text-[10px] font-bold text-slate-500">
              GMT+08
            </div>

            <div
              className="grid flex-1 divide-x divide-slate-800 text-left"
              style={{ gridTemplateColumns: `repeat(${displayedMechanics.length}, minmax(0, 1fr))` }}
            >
              {displayedMechanics.map((mech, idx) => {
                const theme = getMechanicTheme(mech.id)
                const joEvents = mechanicJobOrderLayouts[idx]
                const taskEvents = mechanicTaskLayouts[idx]
                const onLeave = mech.status === 'On Leave' || mech.employeeStatus === 'on_leave'

                const countLabel = groupByJobOrder
                  ? `${joEvents.length} ${joEvents.length === 1 ? 'Job Order' : 'Job Orders'}`
                  : `${taskEvents.length} ${taskEvents.length === 1 ? 'task' : 'tasks'}`

                return (
                  <div key={mech.id} className="py-2.5 px-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${theme.dot}`} />
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-white truncate">{mech.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{mech.rank || 'Mechanic'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onLeave ? (
                        <span className="rounded bg-amber-500/20 text-amber-300 px-2 py-0.5 text-[9px] font-semibold border border-amber-500/30">
                          Leave
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[10px] font-mono text-slate-300 font-semibold">
                          {countLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hourly Time Grid with Dedicated Mechanic Columns */}
          <div ref={timeGridRef} className="flex-1 overflow-y-auto relative select-none">
            <div className="flex relative" style={{ height: '1440px' }}>
              {/* Time Column (Left) */}
              <div className="w-16 shrink-0 border-r border-slate-800/80 bg-[#12161f] text-right select-none">
                {hours.map((hour) => {
                  const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
                  return (
                    <div
                      key={hour}
                      className="relative h-[60px] pr-2 text-[11px] font-semibold text-slate-400 flex items-start justify-end"
                    >
                      <span className="-translate-y-2">{label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Mechanic Columns Grid Area */}
              <div
                className="grid flex-1 divide-x divide-slate-800/80 relative"
                style={{ gridTemplateColumns: `repeat(${displayedMechanics.length}, minmax(0, 1fr))` }}
              >
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {hours.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-slate-800/40 w-full" />
                  ))}
                </div>

                {/* Current Time Red Line */}
                {isToday && (
                  <div
                    className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
                    style={{ top: `${nowTopPx}px` }}
                  >
                    <div className="h-2.5 w-2.5 -ml-1.5 rounded-full bg-red-500 shadow-sm" />
                    <div className="h-[2px] w-full bg-red-500 shadow-sm" />
                  </div>
                )}

                {/* Lanes for each mechanic */}
                {displayedMechanics.map((mech, mIdx) => {
                  const theme = getMechanicTheme(mech.id)
                  const onLeave = mech.status === 'On Leave' || mech.employeeStatus === 'on_leave'

                  return (
                    <div key={mech.id} className="relative h-full p-1">
                      {onLeave && (
                        <div className="absolute inset-2 rounded-2xl border-2 border-dashed border-amber-500/20 bg-amber-500/5 flex flex-col items-center justify-center p-4 text-center z-0">
                          <p className="text-xs font-bold text-amber-300">Mechanic On Leave</p>
                          <p className="text-[10px] text-slate-400 mt-1">No services assigned today</p>
                        </div>
                      )}

                      {/* MODE 1: GROUPED BY JOB ORDER (Clean Single Card per Job Order!) */}
                      {groupByJobOrder &&
                        mechanicJobOrderLayouts[mIdx].map((evt) => {
                          const jo = evt.jobOrder
                          const isExpanded = expandedJoIds.has(jo.id)
                          const top = evt.startMinutes
                          const baseHeight = Math.max(58, evt.endMinutes - evt.startMinutes)
                          const height = isExpanded
                            ? Math.max(baseHeight, 90 + jo.tasks.length * 36)
                            : baseHeight

                          let leftStyle = '6px'
                          let widthStyle = 'calc(100% - 12px)'
                          let zIndex = isExpanded ? 60 : 10 + evt.colIndex

                          if (evt.totalCols === 2) {
                            leftStyle = evt.colIndex === 0 ? '6px' : 'calc(50% + 2px)'
                            widthStyle = 'calc(50% - 8px)'
                          }

                          const startTime = fmtShortTime(new Date(jo.scheduled_date))
                          const finishTime = jo.estimated_finish
                            ? fmtShortTime(new Date(jo.estimated_finish))
                            : ''

                          return (
                            <div
                              key={jo.id}
                              onClick={() => onSelectJobOrder(jo)}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: leftStyle,
                                width: widthStyle,
                                zIndex,
                              }}
                              className={`absolute rounded-xl p-2.5 border border-l-4 transition-all duration-150 cursor-pointer shadow-md backdrop-blur-md overflow-hidden hover:!z-50 hover:scale-[1.01] hover:shadow-2xl hover:ring-2 hover:ring-white/80 ${
                                theme.cardBg
                              } ${theme.borderAccent} ${theme.cardBorder} ${
                                isExpanded
                                  ? 'ring-2 ring-blue-400/80 bg-slate-900 shadow-2xl'
                                  : 'opacity-95'
                              }`}
                              title={`Click to view Job Order #${jo.job_order_id} details`}
                            >
                              {/* Header: Time, JO #, Status */}
                              <div className="flex items-center justify-between gap-1 leading-none">
                                <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1 font-mono">
                                  <Clock size={11} className="text-slate-400 shrink-0" />
                                  {startTime} {finishTime ? `– ${finishTime}` : ''}
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                  {jo.job_order_status && (
                                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.2 text-[9px] font-bold uppercase">
                                      {jo.job_order_status}
                                    </span>
                                  )}
                                  <span className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-white shrink-0">
                                    JO-{jo.job_order_id}
                                  </span>
                                </div>
                              </div>

                              {/* Vehicle Title */}
                              <h4 className="font-bold text-xs text-white truncate mt-1 flex items-center gap-1.5">
                                <Car size={12} className="text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {jo.vehicle_model || 'Vehicle'} {jo.vehicle_year ? `(${jo.vehicle_year})` : ''}
                                </span>
                                {jo.plate_number && (
                                  <span className="text-[10px] text-slate-300 font-mono shrink-0">
                                    ({jo.plate_number})
                                  </span>
                                )}
                              </h4>

                              {/* Accordion Pill / Single Service Title */}
                              {jo.tasks.length > 1 ? (
                                <div className="mt-1.5 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      toggleExpandJo(jo.id)
                                    }}
                                    className="flex items-center gap-1 rounded-md bg-white/10 hover:bg-white/20 px-2 py-0.5 text-[9.5px] font-semibold text-slate-200 transition-all cursor-pointer ring-1 ring-white/10"
                                    title="Click to toggle service checklist"
                                  >
                                    <Briefcase size={10} className="text-blue-400 shrink-0" />
                                    <span>{jo.tasks.length} Services Included</span>
                                    {isExpanded ? (
                                      <ChevronUp size={11} className="text-slate-300" />
                                    ) : (
                                      <ChevronDown size={11} className="text-slate-300" />
                                    )}
                                  </button>
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                                    ₱{jo.total_price.toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-1 flex items-center justify-between gap-1 text-[10.5px] text-slate-300">
                                  <span className="truncate flex items-center gap-1">
                                    <Wrench size={10} className="text-slate-400 shrink-0" />
                                    {jo.primary_task_title}
                                  </span>
                                  {jo.total_price > 0 && (
                                    <span className="font-mono font-bold text-emerald-400 text-[10px] shrink-0">
                                      ₱{jo.total_price.toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Accordion Expanded List: Clean inline list with NO background stacked boxes! */}
                              {isExpanded && (
                                <div className="mt-2 space-y-1 pt-1.5 border-t border-white/15 animate-fadeIn">
                                  {jo.tasks.map((task) => (
                                    <div
                                      key={task.id}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onSelectTask(task)
                                      }}
                                      className="flex items-center justify-between text-[10.5px] bg-black/40 hover:bg-black/60 rounded px-2 py-1 text-slate-200 transition-colors cursor-pointer"
                                      title="Click to view service details"
                                    >
                                      <span className="truncate font-medium flex items-center gap-1">
                                        <Wrench size={10} className="text-slate-400 shrink-0" />
                                        {task.title}
                                      </span>
                                      <span className="font-mono text-emerald-300 font-semibold shrink-0 ml-1">
                                        {task.price > 0
                                          ? `₱${Number(task.price).toLocaleString()}`
                                          : 'Included'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Customer info & duration (if height permits) */}
                              {!isExpanded && height > 68 && (
                                <div className="mt-1 flex items-center justify-between text-[9.5px] text-slate-400">
                                  <span className="truncate">
                                    {jo.customer_name ? `Cust: ${jo.customer_name}` : ''}
                                  </span>
                                  <span className="shrink-0">~{formatHours(jo.total_hours)}</span>
                                </div>
                              )}
                            </div>
                          )
                        })}

                      {/* MODE 2: BY INDIVIDUAL SERVICE (With True Accordion for Concurrent Tasks) */}
                      {!groupByJobOrder &&
                        (() => {
                          const taskEvents = mechanicTaskLayouts[mIdx]
                          // Group events by overlapping start time cluster
                          const clusters = new Map<number, typeof taskEvents>()

                          for (const evt of taskEvents) {
                            let found = false
                            for (const [, clusterList] of clusters.entries()) {
                              const head = clusterList[0]
                              if (Math.abs(head.startMinutes - evt.startMinutes) < 15) {
                                clusterList.push(evt)
                                found = true
                                break
                              }
                            }
                            if (!found) {
                              clusters.set(evt.task.id, [evt])
                            }
                          }

                          return Array.from(clusters.values()).map((cluster) => {
                            const masterEvt = cluster[0]
                            const masterTask = masterEvt.task
                            const otherTasks = cluster.slice(1).map((e) => e.task)
                            const isExpanded = expandedTaskIds.has(masterTask.id)

                            const top = masterEvt.startMinutes
                            const baseHeight = Math.max(50, masterEvt.endMinutes - masterEvt.startMinutes)
                            const height = isExpanded
                              ? Math.max(baseHeight, 80 + otherTasks.length * 34)
                              : baseHeight

                            const leftStyle = '6px'
                            const widthStyle = 'calc(100% - 12px)'
                            const zIndex = isExpanded ? 60 : 15

                            const startTime = fmtShortTime(new Date(masterTask.scheduled_date!))
                            const finishTime = masterTask.estimated_finish
                              ? fmtShortTime(new Date(masterTask.estimated_finish))
                              : ''

                            return (
                              <div
                                key={masterTask.id}
                                onClick={() => onSelectTask(masterTask)}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: leftStyle,
                                  width: widthStyle,
                                  zIndex,
                                }}
                                className={`absolute rounded-xl p-2.5 border border-l-4 transition-all duration-150 cursor-pointer shadow-md backdrop-blur-md overflow-hidden hover:!z-50 hover:scale-[1.01] hover:shadow-2xl hover:ring-2 hover:ring-white/80 ${
                                  theme.cardBg
                                } ${theme.borderAccent} ${theme.cardBorder} ${
                                  isExpanded
                                    ? 'ring-2 ring-blue-400/80 bg-slate-900 shadow-2xl'
                                    : 'opacity-95'
                                }`}
                                title={`${masterTask.title} (${startTime} – ${finishTime}) • JO-${masterTask.job_order_id}`}
                              >
                                <div className="flex items-center justify-between gap-1 leading-none">
                                  <span className="text-[11px] font-bold text-slate-200 flex items-center gap-1 font-mono">
                                    <Clock size={11} className="text-slate-400 shrink-0" />
                                    {startTime} {finishTime ? `– ${finishTime}` : ''}
                                  </span>
                                  <span className="bg-black/50 border border-white/10 rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold text-white shrink-0">
                                    JO-{masterTask.job_order_id}
                                  </span>
                                </div>

                                <h4 className="font-bold text-xs text-white truncate mt-1 leading-snug">
                                  {masterTask.title}
                                </h4>

                                <div className="mt-1 flex items-center justify-between gap-1 text-[10px] text-slate-300">
                                  <div className="flex items-center gap-1 truncate">
                                    <Car size={11} className="shrink-0 text-slate-400" />
                                    <span className="truncate">
                                      {masterTask.vehicle_model || 'Vehicle'}{' '}
                                      {masterTask.plate_number && `(${masterTask.plate_number})`}
                                    </span>
                                  </div>
                                  {masterTask.price && Number(masterTask.price) > 0 && (
                                    <span className="text-[9.5px] font-mono font-bold text-emerald-400 shrink-0">
                                      ₱{Number(masterTask.price).toLocaleString()}
                                    </span>
                                  )}
                                </div>

                                {/* Accordion toggle: Never render stacked boxes behind, use inline expander! */}
                                {otherTasks.length > 0 && (
                                  <div className="mt-1.5">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleExpandTask(masterTask.id)
                                      }}
                                      className="flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[9.5px] font-semibold cursor-pointer hover:bg-amber-500/30 transition-all"
                                    >
                                      <Layers size={10} />
                                      <span>+{otherTasks.length} concurrent tasks</span>
                                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                    </button>
                                  </div>
                                )}

                                {isExpanded && otherTasks.length > 0 && (
                                  <div className="mt-2 space-y-1 pt-1.5 border-t border-white/15 animate-fadeIn">
                                    {otherTasks.map((ot) => (
                                      <div
                                        key={ot.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onSelectTask(ot)
                                        }}
                                        className="flex items-center justify-between text-[10.5px] bg-black/40 hover:bg-black/60 rounded px-2 py-1 text-slate-200 transition-colors cursor-pointer"
                                      >
                                        <span className="truncate font-medium flex items-center gap-1">
                                          <Wrench size={10} className="text-slate-400 shrink-0" />
                                          {ot.title}
                                        </span>
                                        <span className="font-mono text-emerald-300 font-semibold shrink-0 ml-1">
                                          ₱{Number(ot.price).toLocaleString()}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// MODERN TIMELINE VIEW (Horizontal Workshop Swimlanes — Dispatch Gantt)
// =========================================================================

function ModernTimelineView({
  currentDate,
  tasks,
  mechanics,
  selectedMechanicIds,
  groupByJobOrder = true,
  onSelectTask,
  onSelectJobOrder,
}: {
  currentDate: Date
  tasks: ScheduleTask[]
  mechanics: Mechanic[]
  selectedMechanicIds: number[]
  groupByJobOrder?: boolean
  onSelectTask: (t: ScheduleTask) => void
  onSelectJobOrder: (jo: GroupedJobOrder) => void
}) {
  // Timeline hours from 7 AM to 12 AM Midnight (18 hours: 7 to 24)
  const timelineHours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
  const hourWidth = 90
  const totalWidth = timelineHours.length * hourWidth

  const displayedMechanics = useMemo(() => {
    return mechanics.filter((m) => selectedMechanicIds.includes(m.id))
  }, [mechanics, selectedMechanicIds])

  const now = new Date()
  const isToday = isSameDay(currentDate, now)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowLeft = (nowMinutes - 7 * 60) * (hourWidth / 60)

  if (displayedMechanics.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Users size={36} className="mb-2 text-slate-600" />
        <p className="text-sm font-semibold text-slate-200">No Mechanics Selected</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Select one or more mechanics from the sidebar to view their timeline swimlanes.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
      {/* Timeline Controls / Stats Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-[#161b22] px-4 py-2.5 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Workshop Dispatch Timeline:</span>
          <span className="font-bold text-white">{fmtDateLabel(currentDate)}</span>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
            {displayedMechanics.length} {displayedMechanics.length === 1 ? 'Mechanic' : 'Mechanics'}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-3">
          {displayedMechanics.map((m) => {
            const theme = getMechanicTheme(m.id)
            return (
              <span key={m.id} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${theme.dot}`} /> {m.name}
              </span>
            )
          })}
        </div>
      </div>

      {/* Main Swimlanes Container */}
      <div className="flex-1 overflow-auto relative">
        <div className="flex min-w-max">
          {/* Left Sticky Mechanic Column */}
          <div className="sticky left-0 z-30 w-64 shrink-0 border-r border-slate-800/90 bg-[#161b22] shadow-xl">
            {/* Corner Cell */}
            <div className="h-11 border-b border-slate-800 px-4 flex items-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Mechanic
            </div>

            {/* Mechanic Rows */}
            {displayedMechanics.map((mech) => {
              const mechTasks = tasks.filter(
                (t) => Number(t.mechanic_id) === Number(mech.id) && t.scheduled_date && isSameDay(new Date(t.scheduled_date), currentDate)
              )
              const jobOrders = groupTasksByJobOrder(mechTasks, currentDate)
              const rowCount = groupByJobOrder ? jobOrders.length : mechTasks.length

              return (
                <div
                  key={mech.id}
                  className="h-24 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between transition-colors bg-[#161b22] hover:bg-slate-800/30"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={avatarUrl(mech.name)}
                      alt={mech.name}
                      className="h-9 w-9 rounded-full ring-2 ring-slate-700 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white truncate">{mech.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{mech.rank || 'Mechanic'}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300 block">
                      {rowCount} {groupByJobOrder ? (rowCount === 1 ? 'JO' : 'JOs') : (rowCount === 1 ? 'job' : 'jobs')}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Swimlanes Area with Hours Ruler */}
          <div className="relative" style={{ width: `${totalWidth}px` }}>
            {/* Time Ruler (Sticky Top) */}
            <div className="sticky top-0 z-20 flex h-11 border-b border-slate-800 bg-[#12161f]">
              {timelineHours.map((hour) => {
                const isLunch = hour === 12
                const label =
                  hour === 24 || hour === 0
                    ? '12 AM'
                    : hour < 12
                    ? `${hour} AM`
                    : hour === 12
                    ? '12 PM'
                    : `${hour - 12} PM`
                return (
                  <div
                    key={hour}
                    style={{ width: `${hourWidth}px` }}
                    className={`shrink-0 border-r border-slate-800/60 px-2 py-3 text-[11px] font-semibold flex items-center justify-between ${
                      isLunch ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'text-slate-400'
                    }`}
                  >
                    <span>{label}</span>
                    {isLunch && (
                      <span className="text-[9px] text-amber-400 font-bold">🍽️ Lunch</span>
                    )}
                    {hour === 24 && (
                      <span className="text-[9px] text-slate-500 font-normal">Midnight</span>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 12:00 PM – 1:00 PM Mandatory Lunch Break Column */}
            <div
              className="absolute top-0 bottom-0 z-10 pointer-events-none border-x border-amber-500/20 bg-amber-500/[0.04]"
              style={{
                left: `${(12 - 7) * hourWidth}px`,
                width: `${hourWidth}px`,
              }}
            >
              <div className="sticky top-11 flex items-center justify-center gap-1 py-1 bg-amber-500/10 text-[9px] font-bold uppercase tracking-wider text-amber-400/80 border-b border-amber-500/20 backdrop-blur-xs">
                <span>🍽️</span> Lunch Break
              </div>
            </div>

            {/* Grid Background Lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="flex h-full">
                {timelineHours.map((hour) => (
                  <div
                    key={hour}
                    style={{ width: `${hourWidth}px` }}
                    className="shrink-0 border-r border-slate-800/30 h-full"
                  />
                ))}
              </div>
            </div>

            {/* Current Time Line */}
            {isToday && nowMinutes >= 7 * 60 && nowMinutes <= 24 * 60 && (
              <div
                className="absolute top-0 bottom-0 z-20 pointer-events-none"
                style={{ left: `${nowLeft}px` }}
              >
                <div className="h-full w-[2px] bg-red-500 shadow-sm" />
                <div className="h-2.5 w-2.5 -ml-1 rounded-full bg-red-500 shadow-sm" />
              </div>
            )}

            {/* Mechanic Swimlanes */}
            {displayedMechanics.map((mech) => {
              const theme = getMechanicTheme(mech.id)
              const mechTasks = tasks.filter(
                (t) => Number(t.mechanic_id) === Number(mech.id) && t.scheduled_date && isSameDay(new Date(t.scheduled_date), currentDate)
              )
              const onLeave = mech.status === 'On Leave' || mech.employeeStatus === 'on_leave'
              const opacityStyle = 'opacity-95 hover:opacity-100 shadow-md ring-1 ring-white/10'

              return (
                <div
                  key={mech.id}
                  className="relative h-24 border-b border-slate-800/60 p-2"
                >
                  {onLeave ? (
                    <div className="h-full w-full rounded-xl border border-dashed border-amber-500/30 bg-amber-500/5 flex items-center justify-center text-xs font-semibold text-amber-400/80">
                      Mechanic On Leave Today
                    </div>
                  ) : groupByJobOrder ? (
                    // MODE 1: Job Orders on Timeline
                    (() => {
                      const jobOrders = groupTasksByJobOrder(mechTasks, currentDate)

                      if (jobOrders.length === 0) {
                        return (
                          <div className="h-full w-full flex items-center pl-6 text-xs text-slate-600 font-medium italic">
                            No job orders scheduled for this mechanic today
                          </div>
                        )
                      }

                      return jobOrders.map((jo, joIdx) => {
                        const start = new Date(jo.scheduled_date)
                        const startMin = start.getHours() * 60 + start.getMinutes()
                        let finishMin = startMin + 45
                        if (jo.estimated_finish) {
                          const finish = new Date(jo.estimated_finish)
                          if (!isNaN(finish.getTime()) && isSameDay(finish, start)) {
                            const calcEnd = finish.getHours() * 60 + finish.getMinutes()
                            if (calcEnd > startMin) finishMin = calcEnd
                          }
                        }
                        if (finishMin - startMin < 45) finishMin = startMin + 45

                        const leftPx = Math.max(0, (startMin - 7 * 60) * (hourWidth / 60))
                        const widthPx = Math.max(150, (finishMin - startMin) * (hourWidth / 60))
                        const topOffset = (joIdx % 2) * 36 + 6
                        const startTimeStr = fmtShortTime(start)
                        const finishTimeStr = jo.estimated_finish ? fmtShortTime(new Date(jo.estimated_finish)) : ''

                        return (
                          <div
                            key={jo.id}
                            onClick={() => onSelectJobOrder(jo)}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              top: `${topOffset}px`,
                              height: '32px',
                            }}
                            className={`absolute rounded-lg px-2.5 py-1 border border-l-4 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-md backdrop-blur-md hover:!z-50 hover:scale-[1.02] hover:shadow-xl hover:ring-2 hover:ring-white/80 overflow-hidden ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder} ${opacityStyle}`}
                            title={`JO-${jo.job_order_id}: ${jo.vehicle_model || 'Vehicle'} (${startTimeStr} – ${finishTimeStr}) • ${jo.tasks.length} Services`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-bold text-slate-200 shrink-0 font-mono">
                                {startTimeStr}
                              </span>
                              <span className="font-bold text-xs text-white truncate">
                                {jo.vehicle_model || 'Vehicle'}
                              </span>
                              <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] text-blue-200 font-semibold shrink-0">
                                {jo.tasks.length} svc
                              </span>
                            </div>

                            <span className="rounded bg-black/40 border border-white/10 px-1.5 py-0.2 text-[9px] font-mono text-slate-200 shrink-0">
                              JO-{jo.job_order_id}
                            </span>
                          </div>
                        )
                      })
                    })()
                  ) : (
                    // MODE 2: Individual Tasks on Timeline
                    mechTasks.length === 0 ? (
                      <div className="h-full w-full flex items-center pl-6 text-xs text-slate-600 font-medium italic">
                        No services scheduled for this mechanic today
                      </div>
                    ) : (
                      mechTasks.map((task, tIdx) => {
                        const start = new Date(task.scheduled_date!)
                        const startMin = start.getHours() * 60 + start.getMinutes()
                        const estHours = Number(task.estimated_hours || 1.5)
                        let finishMin = startMin + Math.round(estHours * 60)
                        if (task.estimated_finish) {
                          const finish = new Date(task.estimated_finish)
                          if (!isNaN(finish.getTime()) && isSameDay(finish, start)) {
                            const calcEnd = finish.getHours() * 60 + finish.getMinutes()
                            if (calcEnd > startMin) finishMin = calcEnd
                          }
                        }
                        if (finishMin - startMin < 40) finishMin = startMin + 40

                        const leftPx = Math.max(0, (startMin - 7 * 60) * (hourWidth / 60))
                        const widthPx = Math.max(120, (finishMin - startMin) * (hourWidth / 60))
                        const topOffset = (tIdx % 2) * 36 + 6
                        const startTimeStr = fmtShortTime(start)
                        const finishTimeStr = task.estimated_finish ? fmtShortTime(new Date(task.estimated_finish)) : ''

                        return (
                          <div
                            key={task.id}
                            onClick={() => onSelectTask(task)}
                            style={{
                              left: `${leftPx}px`,
                              width: `${widthPx}px`,
                              top: `${topOffset}px`,
                              height: '32px',
                            }}
                            className={`absolute rounded-lg px-2.5 py-1 border border-l-4 flex items-center justify-between gap-2 cursor-pointer transition-all shadow-md backdrop-blur-md hover:!z-50 hover:scale-[1.02] hover:shadow-xl hover:ring-2 hover:ring-white/80 overflow-hidden ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder} ${opacityStyle}`}
                            title={`${task.title} (${startTimeStr} – ${finishTimeStr}) • JO-${task.job_order_id} • ${task.vehicle_model || 'Vehicle'}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-bold text-slate-200 shrink-0 font-mono">
                                {startTimeStr}
                              </span>
                              <span className="font-bold text-xs text-white truncate">
                                {task.title}
                              </span>
                            </div>

                            <span className="rounded bg-black/40 border border-white/10 px-1 py-0.2 text-[9px] font-mono text-slate-200 shrink-0">
                              JO-{task.job_order_id}
                            </span>
                          </div>
                        )
                      })
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// MODERN WEEK VIEW (7 Days Grid with Modern Glass Cards)
// =========================================================================

function ModernWeekView({
  currentDate,
  tasks,
  selectedMechanicIds,
  groupByJobOrder = true,
  onSelectTask,
  onSelectJobOrder,
  timeGridRef,
  onSelectDay,
  weekSubView = '7day',
}: {
  currentDate: Date
  tasks: ScheduleTask[]
  selectedMechanicIds?: number[]
  groupByJobOrder?: boolean
  onSelectTask: (t: ScheduleTask) => void
  onSelectJobOrder: (jo: GroupedJobOrder) => void
  timeGridRef: React.RefObject<HTMLDivElement | null>
  onSelectDay: (d: Date) => void
  weekSubView?: '7day' | '5day'
}) {
  const weekDays = useMemo(() => {
    const start = new Date(currentDate)
    const day = start.getDay()

    if (weekSubView === '5day') {
      // Monday to Friday
      const diff = start.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(start.setDate(diff))
      const days: Date[] = []
      for (let i = 0; i < 5; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        days.push(d)
      }
      return days
    } else {
      // Sunday to Saturday (7 days)
      start.setDate(start.getDate() - day)
      const days: Date[] = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(start)
        d.setDate(start.getDate() + i)
        days.push(d)
      }
      return days
    }
  }, [currentDate, weekSubView])

  const hours = Array.from({ length: 24 }, (_, i) => i)
  const today = new Date()

  // Track expanded tasks in individual mode
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<number>>(new Set())
  const toggleExpandTask = (id: number) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Precompute layout for each day
  const dayJobOrderLayouts = useMemo(() => {
    return weekDays.map((d) => computeJobOrderLayout(groupTasksByJobOrder(tasks, d)))
  }, [weekDays, tasks])

  const dayTaskLayouts = useMemo(() => {
    return weekDays.map((d) => computeEventLayout(tasks, d))
  }, [weekDays, tasks])

  const now = new Date()
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const nowTopPx = nowMinutes

  const colCount = weekDays.length
  const minDayWidth = weekSubView === '5day' ? 180 : 160
  const totalMinWidth = Math.max(860, colCount * minDayWidth + 64)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
      {/* Outer Horizontal Scroll Container keeping header & grid in sync */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex flex-col">
        <div className="flex flex-col flex-1" style={{ minWidth: `${totalMinWidth}px` }}>
          {/* Week Header Row */}
          <div className="flex border-b border-slate-800/90 bg-[#161b22] pr-3 shrink-0">
            <div className="w-16 shrink-0 border-r border-slate-800 py-3 text-center text-[10px] font-bold text-slate-500">
              GMT+08
            </div>

            <div
              className="grid flex-1 text-center divide-x divide-slate-800"
              style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
            >
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, today)
                const dayName = day.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
                const count = groupByJobOrder
                  ? dayJobOrderLayouts[i]?.length || 0
                  : dayTaskLayouts[i]?.length || 0

                return (
                  <div
                    key={i}
                    onClick={() => onSelectDay(day)}
                    className={`py-2 px-2 cursor-pointer transition-colors hover:bg-slate-800/40 ${
                      isToday ? 'bg-blue-600/10' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[11px] font-bold tracking-wider text-slate-400">
                        {dayName}
                      </p>
                      {count > 0 && (
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded-full">
                          {count} {groupByJobOrder ? 'JO' : ''}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex justify-center">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-extrabold transition-all ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-md'
                            : 'text-slate-100 hover:text-white'
                        }`}
                      >
                        {day.getDate()}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Hourly Grid */}
          <div ref={timeGridRef} className="flex-1 overflow-y-auto relative select-none">
            <div className="flex relative" style={{ height: '1440px' }}>
              {/* Time Column */}
              <div className="w-16 shrink-0 border-r border-slate-800/80 bg-[#12161f] text-right select-none">
                {hours.map((hour) => {
                  const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`
                  return (
                    <div
                      key={hour}
                      className="relative h-[60px] pr-2 text-[11px] font-semibold text-slate-400 flex items-start justify-end"
                    >
                      <span className="-translate-y-2">{label}</span>
                    </div>
                  )
                })}
              </div>

              {/* Days Columns */}
              <div
                className="grid flex-1 divide-x divide-slate-800/80 relative"
                style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
              >
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-0 pointer-events-none">
                  {hours.map((hour) => (
                    <div key={hour} className="h-[60px] border-b border-slate-800/40 w-full" />
                  ))}
                </div>

                {/* Current Time Red Line */}
                {weekDays.map((day, dIdx) => {
                  const isToday = isSameDay(day, today)

                  return (
                    <div key={dIdx} className={`relative h-full ${isToday ? 'bg-blue-950/10' : ''}`}>
                      {isToday && (
                        <div
                          className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
                          style={{ top: `${nowTopPx}px` }}
                        >
                          <div className="h-2.5 w-2.5 -ml-1.5 rounded-full bg-red-500 shadow-sm" />
                          <div className="h-[2px] w-full bg-red-500 shadow-sm" />
                        </div>
                      )}

                      {/* MODE 1: Job Orders on Week Grid (Recommended) */}
                      {groupByJobOrder &&
                        dayJobOrderLayouts[dIdx].map((evt) => {
                          const jo = evt.jobOrder
                          const theme = getMechanicTheme(jo.mechanic_id)
                          const top = evt.startMinutes
                          const height = Math.max(48, evt.endMinutes - evt.startMinutes)

                          let leftStyle = '4px'
                          let widthStyle = 'calc(100% - 8px)'
                          let zIndex = 10 + evt.colIndex

                          if (evt.totalCols === 2) {
                            leftStyle = evt.colIndex === 0 ? '4px' : 'calc(50% + 2px)'
                            widthStyle = 'calc(50% - 6px)'
                          }

                          const startTime = fmtShortTime(new Date(jo.scheduled_date))
                          const finishTime = jo.estimated_finish
                            ? fmtShortTime(new Date(jo.estimated_finish))
                            : ''

                          return (
                            <div
                              key={jo.id}
                              onClick={() => onSelectJobOrder(jo)}
                              style={{
                                top: `${top}px`,
                                height: `${height}px`,
                                left: leftStyle,
                                width: widthStyle,
                                zIndex,
                              }}
                              className={`absolute rounded-xl p-2 border border-l-4 overflow-hidden cursor-pointer transition-all duration-150 text-left backdrop-blur-md shadow-md hover:!z-50 hover:scale-[1.02] hover:shadow-2xl hover:ring-2 hover:ring-white/80 opacity-95 ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder}`}
                              title={`JO-${jo.job_order_id} • ${jo.vehicle_model || 'Vehicle'} • ${jo.mechanic_name} (${startTime} – ${finishTime})`}
                            >
                              <div className="flex items-center justify-between gap-1 leading-none">
                                <span className="text-[10px] font-bold text-slate-200 truncate flex items-center gap-1 font-mono">
                                  <Clock size={10} className="text-slate-400 shrink-0" />
                                  {startTime}
                                </span>
                                <span className="bg-black/50 border border-white/10 rounded px-1.5 py-0.2 text-[9px] font-mono font-bold text-white shrink-0">
                                  JO-{jo.job_order_id}
                                </span>
                              </div>

                              <p className="font-bold text-xs text-white truncate mt-1 leading-snug">
                                {jo.vehicle_model || 'Vehicle'}
                              </p>

                              {height > 52 && (
                                <div className="mt-1 flex items-center justify-between gap-1 text-[9.5px] text-slate-300 truncate">
                                  <span className="truncate text-slate-300 font-medium">
                                    {jo.mechanic_name}
                                  </span>
                                  <span className="rounded bg-white/10 px-1 py-0.2 text-[9px] text-blue-200 shrink-0 font-semibold">
                                    {jo.tasks.length} svc
                                  </span>
                                </div>
                              )}
                            </div>
                          )
                        })}

                      {/* MODE 2: Individual Tasks on Week Grid */}
                      {!groupByJobOrder &&
                        (() => {
                          const taskEvents = dayTaskLayouts[dIdx]
                          // Group by concurrent start cluster
                          const clusters = new Map<number, typeof taskEvents>()

                          for (const evt of taskEvents) {
                            let found = false
                            for (const [, clusterList] of clusters.entries()) {
                              const head = clusterList[0]
                              if (Math.abs(head.startMinutes - evt.startMinutes) < 15) {
                                clusterList.push(evt)
                                found = true
                                break
                              }
                            }
                            if (!found) {
                              clusters.set(evt.task.id, [evt])
                            }
                          }

                          return Array.from(clusters.values()).map((cluster) => {
                            const masterEvt = cluster[0]
                            const masterTask = masterEvt.task
                            const otherTasks = cluster.slice(1).map((e) => e.task)
                            const isExpanded = expandedTaskIds.has(masterTask.id)

                            const theme = getMechanicTheme(masterTask.mechanic_id)
                            const top = masterEvt.startMinutes
                            const baseHeight = Math.max(46, masterEvt.endMinutes - masterEvt.startMinutes)
                            const height = isExpanded
                              ? Math.max(baseHeight, 74 + otherTasks.length * 30)
                              : baseHeight

                            const leftStyle = '4px'
                            const widthStyle = 'calc(100% - 8px)'
                            const zIndex = isExpanded ? 60 : 12

                            const startTime = fmtShortTime(new Date(masterTask.scheduled_date!))

                            return (
                              <div
                                key={masterTask.id}
                                onClick={() => onSelectTask(masterTask)}
                                style={{
                                  top: `${top}px`,
                                  height: `${height}px`,
                                  left: leftStyle,
                                  width: widthStyle,
                                  zIndex,
                                }}
                                className={`absolute rounded-xl p-2 border border-l-4 overflow-hidden cursor-pointer transition-all duration-150 text-left backdrop-blur-md shadow-md hover:!z-50 hover:scale-[1.02] hover:shadow-2xl hover:ring-2 hover:ring-white/80 ${
                                  theme.cardBg
                                } ${theme.borderAccent} ${theme.cardBorder} ${
                                  isExpanded ? 'ring-2 ring-blue-400 bg-slate-900 shadow-2xl' : 'opacity-95'
                                }`}
                                title={`${masterTask.title} (${startTime}) • ${masterTask.mechanic_name} • JO-${masterTask.job_order_id}`}
                              >
                                <div className="flex items-center justify-between gap-1 leading-none">
                                  <span className="text-[10px] font-bold text-slate-200 truncate flex items-center gap-1 font-mono">
                                    <Clock size={10} className="text-slate-400 shrink-0" />
                                    {startTime}
                                  </span>
                                  <span className="bg-black/50 border border-white/10 rounded px-1 py-0.2 text-[9px] font-mono font-bold text-white shrink-0">
                                    JO-{masterTask.job_order_id}
                                  </span>
                                </div>

                                <p className="font-bold text-xs text-white truncate mt-1 leading-snug">
                                  {masterTask.title}
                                </p>

                                <div className="mt-1 flex items-center justify-between gap-1 text-[9.5px] text-slate-300 truncate">
                                  <span className="truncate text-slate-300 font-medium">
                                    {masterTask.mechanic_name || 'Mechanic'}
                                  </span>
                                </div>

                                {otherTasks.length > 0 && (
                                  <div className="mt-1">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleExpandTask(masterTask.id)
                                      }}
                                      className="flex items-center gap-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 text-[8.5px] font-semibold cursor-pointer"
                                    >
                                      <Layers size={9} />
                                      <span>+{otherTasks.length} concurrent</span>
                                      {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                  </div>
                                )}

                                {isExpanded && otherTasks.length > 0 && (
                                  <div className="mt-1.5 space-y-1 pt-1 border-t border-white/15 animate-fadeIn">
                                    {otherTasks.map((ot) => (
                                      <div
                                        key={ot.id}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          onSelectTask(ot)
                                        }}
                                        className="text-[9.5px] bg-black/40 hover:bg-black/60 rounded px-1.5 py-0.5 text-slate-200 truncate cursor-pointer"
                                      >
                                        • {ot.title}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })
                        })()}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// MODERN MONTH VIEW
// =========================================================================

function ModernMonthView({
  currentDate,
  tasks,
  selectedMechanicIds,
  onSelectTask,
  onSelectDay,
}: {
  currentDate: Date
  tasks: ScheduleTask[]
  selectedMechanicIds?: number[]
  onSelectTask: (t: ScheduleTask) => void
  onSelectDay: (d: Date) => void
}) {
  const daysInMonth = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()

    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const days: { date: Date; isCurrentMonth: boolean }[] = []
    const startOffset = firstDay.getDay()
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), isCurrentMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    const remaining = 35 - days.length > 0 ? 35 - days.length : 42 - days.length
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }
    return days
  }, [currentDate])

  const tasksByDate = useMemo(() => {
    const map = new Map<string, ScheduleTask[]>()
    for (const t of tasks) {
      if (!t.scheduled_date) continue
      const d = new Date(t.scheduled_date)
      if (isNaN(d.getTime())) continue
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const existing = map.get(key) || []
      existing.push(t)
      map.set(key, existing)
    }
    return map
  }, [tasks])

  const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const today = new Date()

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
      <div className="grid grid-cols-7 border-b border-slate-800/90 bg-[#161b22] text-center text-xs font-bold text-slate-400 py-2.5">
        {weekdays.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="flex-1 grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-800/80 overflow-y-auto">
        {daysInMonth.map(({ date, isCurrentMonth }, idx) => {
          const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
          const dayTasks = tasksByDate.get(dateKey) || []
          const isToday = isSameDay(date, today)

          return (
            <div
              key={idx}
              className={`min-h-[115px] p-2 flex flex-col transition-colors ${
                isCurrentMonth ? 'bg-[#12161f]' : 'bg-[#0a0d12] text-slate-600'
              } ${isToday ? 'bg-blue-950/20' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <button
                  onClick={() => onSelectDay(date)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold cursor-pointer hover:bg-slate-700 ${
                    isToday
                      ? 'bg-blue-600 text-white font-extrabold shadow-sm'
                      : isCurrentMonth
                      ? 'text-slate-200'
                      : 'text-slate-600'
                  }`}
                >
                  {date.getDate()}
                </button>
                {dayTasks.length > 0 && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {dayTasks.length}
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-1 overflow-hidden">
                {dayTasks.slice(0, 3).map((task) => {
                  const theme = getMechanicTheme(task.mechanic_id)
                  const opacityClass = 'opacity-95 hover:opacity-100 font-medium'

                  const startTime = fmtShortTime(new Date(task.scheduled_date!))

                  return (
                    <button
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className={`w-full text-left rounded-md px-1.5 py-1 text-[10px] leading-tight truncate block cursor-pointer transition-all border border-l-2 ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder} text-white ${opacityClass}`}
                      title={`${task.title} • ${task.mechanic_name} • JO-${task.job_order_id}`}
                    >
                      <span className="font-bold text-slate-300 mr-1">{startTime}</span>
                      <span>{task.title}</span>
                    </button>
                  )
                })}

                {dayTasks.length > 3 && (
                  <button
                    onClick={() => onSelectDay(date)}
                    className="w-full text-left text-[10px] font-semibold text-blue-400 hover:underline pt-0.5 cursor-pointer pl-1"
                  >
                    +{dayTasks.length - 3} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// =========================================================================
// MODERN AGENDA LIST VIEW (Upcoming Future Services Grouped by Date)
// =========================================================================

interface DateGroup {
  dateKey: string // YYYY-MM-DD
  date: Date
  isToday: boolean
  isTomorrow: boolean
  tasks: ScheduleTask[]
  totalRevenue: number
}

function ModernAgendaView({
  tasks,
  currentDate,
  selectedMechanicIds,
  groupByJobOrder = true,
  selectedDayFilter,
  onClearDayFilter,
  onSelectDayFilter,
  onSelectTask,
  onSelectJobOrder,
  onSelectDay,
}: {
  tasks: ScheduleTask[]
  currentDate?: Date
  selectedMechanicIds?: number[]
  groupByJobOrder?: boolean
  selectedDayFilter?: Date | null
  onClearDayFilter?: () => void
  onSelectDayFilter?: (d: Date) => void
  onSelectTask: (t: ScheduleTask) => void
  onSelectJobOrder: (jo: GroupedJobOrder) => void
  onSelectDay?: (d: Date) => void
}) {
  const [rangeFilter, setRangeFilter] = useState<'all' | '7d' | '14d' | '30d'>('30d')

  // Calculate start of today (local midnight)
  const today = useMemo(() => new Date(), [])
  const startOfToday = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0),
    [today]
  )

  // Filter tasks to only future / upcoming services (today onwards) or strictly selectedDayFilter
  const futureTasks = useMemo(() => {
    if (selectedDayFilter) {
      return tasks
        .filter((t) => {
          if (!t.scheduled_date) return false
          const d = new Date(t.scheduled_date)
          if (isNaN(d.getTime())) return false
          return isSameDay(d, selectedDayFilter)
        })
        .sort((a, b) => {
          const da = new Date(a.scheduled_date!).getTime()
          const db = new Date(b.scheduled_date!).getTime()
          return da - db
        })
    }

    const todayMs = startOfToday.getTime()

    let maxMs = Infinity
    if (rangeFilter === '7d') {
      maxMs = todayMs + 7 * 24 * 60 * 60 * 1000
    } else if (rangeFilter === '14d') {
      maxMs = todayMs + 14 * 24 * 60 * 60 * 1000
    } else if (rangeFilter === '30d') {
      maxMs = todayMs + 30 * 24 * 60 * 60 * 1000
    }

    return tasks
      .filter((t) => {
        if (!t.scheduled_date) return false
        const d = new Date(t.scheduled_date)
        if (isNaN(d.getTime())) return false
        const tMs = d.getTime()
        // Strictly future services only — exclude past services (already in service history!)
        return tMs >= todayMs && tMs <= maxMs
      })
      .sort((a, b) => {
        const da = new Date(a.scheduled_date!).getTime()
        const db = new Date(b.scheduled_date!).getTime()
        return da - db
      })
  }, [tasks, startOfToday, rangeFilter, selectedDayFilter])

  // Group upcoming tasks by date — dates with NO services are naturally skipped!
  const groupedDates = useMemo(() => {
    const map = new Map<string, DateGroup>()
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    for (const task of futureTasks) {
      const d = new Date(task.scheduled_date!)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (!map.has(key)) {
        const groupDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
        map.set(key, {
          dateKey: key,
          date: groupDate,
          isToday: isSameDay(groupDate, today),
          isTomorrow: isSameDay(groupDate, tomorrow),
          tasks: [],
          totalRevenue: 0,
        })
      }

      const group = map.get(key)!
      group.tasks.push(task)
      if (task.price && Number(task.price) > 0) {
        group.totalRevenue += Number(task.price)
      }
    }

    return Array.from(map.values())
  }, [futureTasks, today])

  const totalUpcomingCount = futureTasks.length

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0d1117]">
      {/* Top Controls / Filter Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 bg-[#161b22] px-5 py-3 gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <CalendarDays size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              {selectedDayFilter
                ? `Services for ${fmtDateLabel(selectedDayFilter)}`
                : 'Upcoming Service Agenda'}
              <span className="rounded-full bg-blue-600/20 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-mono font-semibold text-blue-300">
                {totalUpcomingCount} {selectedDayFilter ? (totalUpcomingCount === 1 ? 'service' : 'services') : 'upcoming'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              {selectedDayFilter
                ? `Filtered strictly to ${fmtDateLabel(selectedDayFilter)} • Click remove filter to restore upcoming list`
                : 'Future scheduled services from today onwards • Past jobs archived in Service History'}
            </p>
          </div>
        </div>

        {/* Range Selector Pills & Active Day Filter Badge */}
        <div className="flex items-center gap-2">
          {selectedDayFilter && (
            <div
              onClick={onClearDayFilter}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/50 bg-blue-600/20 px-3 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 hover:border-blue-400 transition-all cursor-pointer shadow-sm group animate-fadeIn"
              title="Click to remove date filter"
            >
              <CalendarIcon size={12} className="text-blue-400" />
              <span>Filtered: {fmtDateLabel(selectedDayFilter)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClearDayFilter?.()
                }}
                className="rounded-full p-0.5 hover:bg-blue-500/40 text-blue-300 hover:text-white transition-colors cursor-pointer"
                title="Remove filter"
              >
                <X size={12} strokeWidth={2.5} />
              </button>
            </div>
          )}

          <div className="flex items-center rounded-xl border border-slate-700/80 bg-slate-900/80 p-1 text-xs font-semibold">
            <button
              onClick={() => {
                onClearDayFilter?.()
                setRangeFilter('7d')
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                !selectedDayFilter && rangeFilter === '7d'
                  ? 'bg-slate-700 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => {
                onClearDayFilter?.()
                setRangeFilter('14d')
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                !selectedDayFilter && rangeFilter === '14d'
                  ? 'bg-slate-700 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              14 Days
            </button>
            <button
              onClick={() => {
                onClearDayFilter?.()
                setRangeFilter('30d')
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                !selectedDayFilter && rangeFilter === '30d'
                  ? 'bg-slate-700 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => {
                onClearDayFilter?.()
                setRangeFilter('all')
              }}
              className={`rounded-lg px-2.5 py-1 transition-all cursor-pointer ${
                !selectedDayFilter && rangeFilter === 'all'
                  ? 'bg-slate-700 text-white font-bold shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Upcoming
            </button>
          </div>
        </div>
      </div>

      {/* Main Agenda List Area */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {groupedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 rounded-2xl border border-dashed border-slate-800 bg-[#161b22]/50 my-8">
            {selectedDayFilter ? (
              <>
                <CalendarIcon size={40} className="mb-3 text-blue-400" />
                <p className="text-base font-bold text-slate-200">
                  No Services Scheduled for {fmtDateLabel(selectedDayFilter)}
                </p>
                <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                  There are no service orders scheduled for this specific date for the selected mechanics.
                </p>
                <button
                  onClick={onClearDayFilter}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 transition-all cursor-pointer shadow-md"
                >
                  Clear Date Filter & Show Upcoming
                </button>
              </>
            ) : (
              <>
                <CheckCircle2 size={40} className="mb-3 text-emerald-400" />
                <p className="text-base font-bold text-slate-200">No Upcoming Services Scheduled</p>
                <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                  There are no future service orders scheduled for the selected mechanics in this timeframe. Past completed jobs are archived in the Service History view.
                </p>
              </>
            )}
          </div>
        ) : (
          groupedDates.map((group) => {
            const dayName = group.date.toLocaleDateString('en-US', { weekday: 'long' })
            const fullDateStr = group.date.toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })

            const jobOrders = groupTasksByJobOrder(group.tasks, group.date)

            return (
              <div key={group.dateKey} className="space-y-3">
                {/* Date Section Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between rounded-xl border border-slate-800/90 bg-[#161b22]/95 px-4 py-2.5 backdrop-blur-md shadow-sm">
                  <div className="flex items-center gap-3">
                    <div
                      onClick={() => onSelectDayFilter?.(group.date)}
                      className={`flex h-9 w-9 items-center justify-center rounded-xl font-extrabold text-sm shadow-inner transition-transform cursor-pointer hover:scale-105 ${
                        group.isToday
                          ? 'bg-blue-600 text-white ring-2 ring-blue-400/50'
                          : group.isTomorrow
                          ? 'bg-indigo-600 text-white ring-1 ring-indigo-400/40'
                          : 'bg-slate-800 text-slate-200 border border-slate-700'
                      }`}
                      title="Click to filter only this day"
                    >
                      {group.date.getDate()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">
                          {dayName}, {fullDateStr}
                        </span>
                        {group.isToday && (
                          <span className="rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider">
                            Today
                          </span>
                        )}
                        {group.isTomorrow && (
                          <span className="rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.2 text-[10px] font-bold uppercase tracking-wider">
                            Tomorrow
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {groupByJobOrder
                          ? `${jobOrders.length} ${jobOrders.length === 1 ? 'job order scheduled' : 'job orders scheduled'} (${group.tasks.length} total services)`
                          : `${group.tasks.length} ${group.tasks.length === 1 ? 'service scheduled' : 'services scheduled'}`}
                        {group.totalRevenue > 0 && ` • Estimated Revenue: ₱${group.totalRevenue.toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {onSelectDay && (
                    <button
                      onClick={() => onSelectDay(group.date)}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1 cursor-pointer"
                      title="View this day on Timeline"
                    >
                      Timeline <ArrowRight size={12} />
                    </button>
                  )}
                </div>

                {/* Cards for this Date */}
                <div className="grid grid-cols-1 gap-2.5 pl-2 sm:pl-4">
                  {/* MODE 1: Job Orders in Agenda (Recommended) */}
                  {groupByJobOrder ? (
                    jobOrders.map((jo) => {
                      const theme = getMechanicTheme(jo.mechanic_id)
                      const startTime = fmtTime(jo.scheduled_date)
                      const finishTime = fmtTime(jo.estimated_finish)

                      return (
                        <div
                          key={jo.id}
                          onClick={() => onSelectJobOrder(jo)}
                          className={`group rounded-2xl border border-l-4 p-4 transition-all cursor-pointer backdrop-blur-md shadow-sm hover:scale-[1.01] hover:shadow-lg hover:ring-1 hover:ring-white/20 ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder}`}
                        >
                          {/* Top Row: Time, JO badge, Status, Mechanic, Price */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 shrink-0 min-w-[80px] text-center">
                                <span className="text-[11px] font-bold text-white font-mono flex items-center gap-1">
                                  <Clock size={11} className="text-slate-400 shrink-0" />
                                  {startTime || 'Unscheduled'}
                                </span>
                                {finishTime && (
                                  <span className="text-[9.5px] text-slate-400 font-mono">
                                    to {finishTime}
                                  </span>
                                )}
                              </div>

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="rounded bg-black/40 border border-white/10 px-1.5 py-0.2 text-[10px] font-mono font-bold text-white shrink-0">
                                    JO-{jo.job_order_id}
                                  </span>
                                  {jo.job_order_status && (
                                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded px-1.5 py-0.2 text-[9.5px] font-bold uppercase">
                                      {jo.job_order_status}
                                    </span>
                                  )}
                                  <h4 className="font-bold text-sm text-slate-100 group-hover:text-blue-300 transition-colors">
                                    {jo.vehicle_model || 'Vehicle'} {jo.vehicle_year ? `(${jo.vehicle_year})` : ''}
                                  </h4>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                                  {jo.plate_number && <span>Plate: {jo.plate_number}</span>}
                                  {jo.customer_name && <span>Customer: {jo.customer_name}</span>}
                                  <span>~{formatHours(jo.total_hours)} total</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 ml-auto">
                              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                                ₱{jo.total_price.toLocaleString()}
                              </span>
                              <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700/80 px-2.5 py-1">
                                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${theme.dot}`} />
                                <span className="text-xs font-semibold text-slate-200">
                                  {jo.mechanic_name}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Services Checklist inside this Job Order */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {jo.tasks.map((task, tIdx) => (
                              <div
                                key={task.id || tIdx}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectTask(task)
                                }}
                                className="flex items-center justify-between gap-2 rounded-lg bg-black/30 hover:bg-black/50 border border-white/5 px-2.5 py-1.5 text-xs text-slate-200 transition-colors"
                              >
                                <span className="truncate flex items-center gap-1.5">
                                  <Wrench size={11} className="text-blue-400 shrink-0" />
                                  <span className="truncate">{task.title}</span>
                                </span>
                                <span className="font-mono text-emerald-300 font-semibold text-[11px] shrink-0">
                                  {task.price > 0 ? `₱${Number(task.price).toLocaleString()}` : 'Included'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    /* MODE 2: Individual Tasks in Agenda */
                    group.tasks.map((task) => {
                      const theme = getMechanicTheme(task.mechanic_id)
                      const startTime = fmtTime(task.scheduled_date)
                      const finishTime = fmtTime(task.estimated_finish)

                      return (
                        <div
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          className={`group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-l-4 p-3.5 transition-all cursor-pointer backdrop-blur-md shadow-sm hover:scale-[1.01] hover:shadow-lg hover:ring-1 hover:ring-white/20 ${theme.cardBg} ${theme.borderAccent} ${theme.cardBorder}`}
                        >
                          <div className="flex items-center gap-3.5 min-w-0">
                            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-900/90 border border-slate-700/80 px-2.5 py-1.5 shrink-0 min-w-[80px] text-center">
                              <span className="text-[11px] font-bold text-white font-mono flex items-center gap-1">
                                <Clock size={11} className="text-slate-400 shrink-0" />
                                {startTime || 'Unscheduled'}
                              </span>
                              {finishTime && (
                                <span className="text-[9.5px] text-slate-400 font-mono">
                                  to {finishTime}
                                </span>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-slate-100 truncate group-hover:text-blue-300 transition-colors">
                                  {task.title}
                                </h4>
                                <span className="rounded bg-black/40 border border-white/10 px-1.5 py-0.2 text-[9.5px] font-mono font-bold text-white shrink-0">
                                  JO-{task.job_order_id}
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400 mt-1">
                                {(task.vehicle_model || task.plate_number) && (
                                  <span className="flex items-center gap-1 text-slate-300">
                                    <Car size={12} className="text-slate-400 shrink-0" />
                                    <span className="truncate">
                                      {task.vehicle_model || 'Vehicle'} {task.plate_number && `(${task.plate_number})`}
                                    </span>
                                  </span>
                                )}
                                {task.customer_name && (
                                  <span className="flex items-center gap-1 text-slate-400">
                                    <User size={12} className="text-slate-500 shrink-0" />
                                    <span className="truncate">{task.customer_name}</span>
                                  </span>
                                )}
                                {task.estimated_hours && (
                                  <span className="text-[11px] text-slate-400">
                                    {formatHours(task.estimated_hours)} duration
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-auto">
                            {task.price && Number(task.price) > 0 && (
                              <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-xl">
                                ₱{Number(task.price).toLocaleString()}
                              </span>
                            )}

                            <div className="flex items-center gap-2 rounded-xl bg-slate-900/80 border border-slate-700/80 px-2.5 py-1">
                              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${theme.dot}`} />
                              <span className="text-xs font-semibold text-slate-200">
                                {task.mechanic_name || 'Mechanic'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// =========================================================================
// JOB ORDER DETAIL MODAL (Complete Service Checklist & Customer Info)
// =========================================================================

function JobOrderDetailModal({
  jobOrder,
  onClose,
  onSelectTask,
}: {
  jobOrder: GroupedJobOrder
  onClose: () => void
  onSelectTask?: (task: ScheduleTask) => void
}) {
  const theme = getMechanicTheme(jobOrder.mechanic_id)
  const dateStr = jobOrder.scheduled_date
    ? fmtDateLabel(new Date(jobOrder.scheduled_date))
    : 'Unscheduled'
  const startStr = fmtTime(jobOrder.scheduled_date)
  const finishStr = fmtTime(jobOrder.estimated_finish)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-[#161b22] shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 text-slate-100 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-800 ${GRADIENT} shrink-0`}>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-black/40 rounded-lg px-2.5 py-0.5 text-xs font-mono font-bold text-white border border-white/20">
                Job Order #{jobOrder.job_order_id}
              </span>
              {jobOrder.job_order_status && (
                <span className="bg-blue-500/30 text-blue-200 border border-blue-400/40 rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  {jobOrder.job_order_status}
                </span>
              )}
            </div>
            <h3 className="mt-1.5 text-lg font-bold text-white flex items-center gap-2">
              <Car size={18} className="text-blue-300" />
              <span>
                {jobOrder.vehicle_model || 'Vehicle'}{' '}
                {jobOrder.vehicle_year ? `(${jobOrder.vehicle_year})` : ''}
              </span>
              {jobOrder.plate_number && (
                <span className="font-mono text-sm text-blue-200 bg-white/10 px-2 py-0.5 rounded-md">
                  {jobOrder.plate_number}
                </span>
              )}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-full p-1.5 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Scheduled Window
              </span>
              <p className="text-xs font-bold text-white mt-1 flex items-center gap-1 truncate">
                <Clock size={12} className="text-blue-400 shrink-0" />
                {startStr} – {finishStr}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{dateStr}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Assigned Mechanic
              </span>
              <p className="text-xs font-bold text-white mt-1 flex items-center gap-1.5 truncate">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${theme.dot}`} />
                <span className="truncate">{jobOrder.mechanic_name}</span>
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Primary Technician</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Services
              </span>
              <p className="text-xs font-bold text-white mt-1 flex items-center gap-1">
                <Briefcase size={12} className="text-amber-400 shrink-0" />
                {jobOrder.tasks.length} {jobOrder.tasks.length === 1 ? 'Service' : 'Services'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">~{formatHours(jobOrder.total_hours)} total</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                Total Revenue
              </span>
              <p className="text-xs font-bold font-mono text-emerald-400 mt-1">
                ₱{jobOrder.total_price.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Estimated</p>
            </div>
          </div>

          {/* Customer Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm shrink-0">
                <User size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                  Customer
                </p>
                <p className="text-sm font-bold text-white truncate">
                  {jobOrder.customer_name || 'Walk-in Customer'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-300 shrink-0">
              {jobOrder.customer_phone && (
                <a
                  href={`tel:${jobOrder.customer_phone}`}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-slate-200 transition-colors"
                >
                  <Phone size={12} className="text-slate-400" />
                  <span>{jobOrder.customer_phone}</span>
                </a>
              )}
              {jobOrder.customer_email && (
                <a
                  href={`mailto:${jobOrder.customer_email}`}
                  className="flex items-center gap-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 text-slate-200 transition-colors hidden sm:flex"
                >
                  <Mail size={12} className="text-slate-400" />
                  <span className="truncate max-w-[140px]">{jobOrder.customer_email}</span>
                </a>
              )}
            </div>
          </div>

          {/* Services Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Wrench size={13} className="text-blue-400" />
                Services Included in this Job Order ({jobOrder.tasks.length})
              </h4>
              <span className="text-[11px] text-slate-400">
                Concurrent execution by {jobOrder.mechanic_name}
              </span>
            </div>

            <div className="space-y-2">
              {jobOrder.tasks.map((task, idx) => {
                const sTime = task.scheduled_date ? fmtShortTime(new Date(task.scheduled_date)) : ''
                const fTime = task.estimated_finish ? fmtShortTime(new Date(task.estimated_finish)) : ''

                return (
                  <div
                    key={task.id || idx}
                    className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-white truncate">{task.title}</p>
                        <div className="flex items-center gap-2 text-[10.5px] text-slate-400 mt-0.5">
                          {sTime && (
                            <span className="flex items-center gap-1">
                              <Clock size={10} />
                              {sTime} {fTime ? `– ${fTime}` : ''}
                            </span>
                          )}
                          <span>• {formatHours(task.estimated_hours || 1.5)} duration</span>
                          {task.status && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9.5px] text-slate-300">
                              {task.status}
                            </span>
                          )}
                        </div>
                        {task.note && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5 truncate">
                            Note: {task.note}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                        {task.price > 0 ? `₱${Number(task.price).toLocaleString()}` : 'Included'}
                      </span>
                      {onSelectTask && (
                        <button
                          onClick={() => {
                            onClose()
                            onSelectTask(task)
                          }}
                          className="text-[10.5px] text-blue-400 hover:text-blue-300 underline px-1 cursor-pointer"
                        >
                          Details
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-[#12161f] shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Total Estimated:</span>
            <span className="font-mono font-bold text-sm text-emerald-400">
              ₱{jobOrder.total_price.toLocaleString()}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <Link
              href={`/job-orders/${jobOrder.job_order_id}/progress`}
              className={`flex items-center gap-1.5 rounded-xl ${GRADIENT} px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 cursor-pointer`}
            >
              <Wrench size={13} />
              Open Job Progress
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// =========================================================================
// SERVICE DETAIL MODAL
// =========================================================================

function ServiceDetailModal({
  task,
  onClose,
}: {
  task: ScheduleTask
  onClose: () => void
}) {
  const theme = getMechanicTheme(task.mechanic_id)
  const dateStr = task.scheduled_date ? fmtDateLabel(new Date(task.scheduled_date)) : 'Unscheduled'
  const startStr = fmtTime(task.scheduled_date)
  const finishStr = fmtTime(task.estimated_finish)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#161b22] shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-150 text-slate-100">
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b border-slate-800 ${GRADIENT}`}>
          <div>
            <span className="bg-black/30 rounded px-2 py-0.5 text-xs font-bold text-white border border-white/20">
              Job Order #{task.job_order_id}
            </span>
            <h3 className="mt-1 text-lg font-bold text-white">{task.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white rounded-full p-1 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Time & Duration */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Scheduled Time</p>
            <p className="text-sm font-bold text-white flex items-center gap-2">
              <CalendarIcon size={14} className="text-blue-400" /> {dateStr}
            </p>
            <p className="text-xs text-blue-300 font-medium flex items-center gap-1.5">
              <Clock size={13} /> {startStr ? `${startStr} – ${finishStr || 'End'}` : 'Time unscheduled'}
            </p>
            <p className="text-xs text-slate-400 pt-1 border-t border-slate-800">
              Estimated Duration: {formatHours(task.estimated_hours || 1.5)} {task.price > 0 && `• ${currency(task.price)}`}
            </p>
          </div>

          {/* Assigned Mechanic */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex items-center gap-3">
            <span className={`h-3.5 w-3.5 rounded-full shrink-0 ${theme.dot}`} />
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Assigned Mechanic</p>
              <p className="font-bold text-white text-sm">{task.mechanic_name}</p>
            </div>
          </div>

          {/* Vehicle & Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Car size={13} /> Vehicle
              </p>
              <p className="font-bold text-white text-sm">
                {task.vehicle_model || 'Vehicle'} {task.vehicle_year ? `(${task.vehicle_year})` : ''}
              </p>
              <p className="text-xs text-slate-400">Plate: {task.plate_number || 'N/A'}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User size={13} /> Customer
              </p>
              <p className="font-bold text-white text-sm">{task.customer_name || 'Customer'}</p>
              {task.customer_phone && <p className="text-xs text-slate-400">{task.customer_phone}</p>}
            </div>
          </div>

          {task.note && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Service Notes</p>
              <p className="text-xs text-slate-300 leading-relaxed">{task.note}</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <Link
              href={`/job-orders/${task.job_order_id}/progress`}
              className={`flex items-center gap-1.5 rounded-xl ${GRADIENT} px-4 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 cursor-pointer`}
            >
              <Wrench size={13} />
              Open Job Progress
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
