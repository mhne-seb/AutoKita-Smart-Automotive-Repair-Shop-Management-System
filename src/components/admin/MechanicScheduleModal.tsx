'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  UserCog,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  Zap,
  Coffee,
  Moon,
  Flag,
  Wrench,
  Check,
} from 'lucide-react'
import { formatHours } from '@/lib/formatHours'

export interface Job {
  ticketId: number
  customerId: string
  name: string
  phone: string
  email: string
  vehicle: string
  plate: string
  serviceMode: string
  status: string
  date: string
  preferredDate: string | null
  servicesNeeded: string[]
  assignedMechanic?: string
  dateArrived?: string | null
}

interface SimulatedSlot {
  serviceId: number
  serviceName: string
  durationHours: number
  startIso: string
  endIso: string
  displayStart: string
  displayEnd: string
  spansLunch: boolean
}

interface EvaluatedMechanic {
  id: number
  name: string
  email: string
  rank: string
  status: string
  canAccommodateAtRequestedTime: boolean
  conflictReason: string | null
  earliestSlot: {
    startIso: string
    finishIso: string
    displayStart: string
    displayFinish: string
  } | null
  timeline: SimulatedSlot[]
}

interface AvailabilityData {
  success: boolean
  ticket: {
    id: number
    customerName: string
    phone: string
    vehicle: string
    plate: string
    preferredDateTime: string | null
    preferredDateDisplay: string | null
    totalLaborHours: number
    services: { id: number; name: string; durationHours: number; price: number }[]
    assignedMechanicId: number | null
  }
  allMechanicsBusy: boolean
  recommendedEarliestSlot: {
    mechanicId: number
    mechanicName: string
    suggestedStartIso: string
    suggestedFinishIso: string
    displayStart: string
    displayFinish: string
    timeline: SimulatedSlot[]
    reason: string
  } | null
  mechanics: EvaluatedMechanic[]
}

interface MechanicScheduleModalProps {
  job: Job
  onClose: () => void
  onConfirm: (mechanicId: string, adjustedStartTime?: string) => void
}

export function MechanicScheduleModal({ job, onClose, onConfirm }: MechanicScheduleModalProps) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AvailabilityData | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Selected mechanic ID
  const [selectedMechanicId, setSelectedMechanicId] = useState<number | null>(() => {
    const parsed = parseInt(job.assignedMechanic || '', 10)
    return !isNaN(parsed) && parsed > 0 ? parsed : null
  })

  // Adjusted start time (if applied from recommended earliest slot)
  const [adjustedStartIso, setAdjustedStartIso] = useState<string | null>(null)
  const [adjustedStartDisplay, setAdjustedStartDisplay] = useState<string | null>(null)

  // Expanded timeline accordions per mechanic ID
  const [expandedTimelines, setExpandedTimelines] = useState<Record<number, boolean>>({})

  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    fetch(`/api/admin/job-queue/availability?ticketId=${job.ticketId}`)
      .then((res) => res.json())
      .then((resData) => {
        if (!isMounted) return
        if (resData.success) {
          setData(resData)
          // If unassigned and there's a recommended mechanic, pre-select or keep current
          if (!selectedMechanicId) {
            const firstAvailable = resData.mechanics.find((m: EvaluatedMechanic) => m.canAccommodateAtRequestedTime)
            if (firstAvailable) {
              setSelectedMechanicId(firstAvailable.id)
            } else if (resData.recommendedEarliestSlot) {
              setSelectedMechanicId(resData.recommendedEarliestSlot.mechanicId)
            }
          }
        } else {
          setError(resData.message || 'Failed to load mechanic availability')
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setError(err.message || 'Network error')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [job.ticketId])

  const toggleTimeline = (mechanicId: number) => {
    setExpandedTimelines((prev) => ({
      ...prev,
      [mechanicId]: !prev[mechanicId],
    }))
  }

  const handleApplyRecommended = () => {
    if (!data?.recommendedEarliestSlot) return
    setSelectedMechanicId(data.recommendedEarliestSlot.mechanicId)
    setAdjustedStartIso(data.recommendedEarliestSlot.suggestedStartIso)
    setAdjustedStartDisplay(data.recommendedEarliestSlot.displayStart)
  }

  const handleConfirm = () => {
    if (!selectedMechanicId) return
    onConfirm(selectedMechanicId.toString(), adjustedStartIso || undefined)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Assign Mechanic & Schedule Feasibility"
        className="relative my-8 w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <UserCog size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Assign Mechanic & Schedule Feasibility</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ticket #{job.ticketId} • {job.name} • {job.vehicle} ({job.plate})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 size={32} className="animate-spin text-brand" />
              <p className="text-sm font-medium">Checking live mechanic dispatch schedules & shop hours...</p>
            </div>
          ) : error || !data ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300 text-sm">
              <p className="font-semibold flex items-center gap-2">
                <AlertCircle size={16} /> Error loading availability
              </p>
              <p className="mt-1 text-xs">{error || 'Unknown error'}</p>
            </div>
          ) : (
            <>
              {/* Ticket Details & Services Bar */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-muted-foreground">Requested Drop-off:</span>
                    <span className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-700 px-2.5 py-1 font-bold text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-2xs">
                      <Calendar size={12} className="text-brand" />
                      {adjustedStartDisplay ? (
                        <>
                          <span className="line-through text-muted-foreground mr-1">
                            {data.ticket.preferredDateDisplay || 'Now'}
                          </span>
                          <span className="text-amber-700 dark:text-amber-400 font-bold">
                            {adjustedStartDisplay} (Adjusted)
                          </span>
                        </>
                      ) : (
                        data.ticket.preferredDateDisplay || 'As soon as possible'
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 font-semibold text-brand text-xs">
                    <Clock size={13} />
                    <span>
                      {data.ticket.services.length} {data.ticket.services.length === 1 ? 'Service' : 'Services'} •{' '}
                      {formatHours(data.ticket.totalLaborHours)} labor
                    </span>
                  </div>
                </div>

                {/* Services Chips */}
                {data.ticket.services.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                    {data.ticket.services.map((svc) => (
                      <span
                        key={svc.id}
                        className="inline-flex items-center gap-1 rounded-md bg-white dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      >
                        <Wrench size={10} className="text-brand" />
                        {svc.name}
                        <span className="text-[10px] text-muted-foreground font-mono">({formatHours(svc.durationHours)})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* All Mechanics Busy Alert Banner */}
              {data.allMechanicsBusy && data.recommendedEarliestSlot && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-full bg-amber-500/20 p-1 text-amber-600 dark:text-amber-400">
                      <AlertCircle size={18} />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div>
                        <h4 className="font-bold text-sm text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
                          All Mechanics Busy at Requested Drop-Off Time
                        </h4>
                        <p className="text-xs text-amber-800 dark:text-amber-300 mt-1 leading-relaxed">
                          All active mechanics are currently occupied handling other ongoing job orders during the requested
                          time. The system has calculated the earliest time a mechanic can accommodate this job order from
                          start to finish:
                        </p>
                      </div>

                      <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-amber-200 dark:border-amber-800/80 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            Recommended: <span className="font-bold text-brand">{data.recommendedEarliestSlot.mechanicName}</span>
                          </p>
                          <p className="text-muted-foreground mt-0.5">
                            Available:{' '}
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">
                              {data.recommendedEarliestSlot.displayStart}
                            </span>{' '}
                            → Est. Finish:{' '}
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {data.recommendedEarliestSlot.displayFinish}
                            </span>
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleApplyRecommended}
                          className="flex items-center gap-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-sm transition-all cursor-pointer"
                        >
                          <Zap size={13} />
                          {adjustedStartIso ? 'Applied' : 'Apply Earliest Schedule'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mechanics List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                  <span>Available Mechanics</span>
                  <span>{data.mechanics.length} Total</span>
                </div>

                <div className="space-y-2.5">
                  {data.mechanics.map((m) => {
                    const isSelected = selectedMechanicId === m.id
                    const isOnLeave = m.status === 'on_leave' || m.status !== 'active'
                    const isExpanded = Boolean(expandedTimelines[m.id])

                    return (
                      <div
                        key={m.id}
                        className={`rounded-xl border transition-all ${
                          isOnLeave
                            ? 'border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-800/30 opacity-60'
                            : isSelected
                            ? 'border-brand bg-brand/5 shadow-sm ring-1 ring-brand/40'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Mechanic Card Header / Row */}
                        <div className="p-3.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              <div className="h-10 w-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-200">
                                {m.name.charAt(0)}
                              </div>
                              <span
                                className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                  isOnLeave
                                    ? 'bg-rose-500'
                                    : m.canAccommodateAtRequestedTime
                                    ? 'bg-emerald-500'
                                    : 'bg-amber-500'
                                }`}
                              />
                            </div>

                            {/* Name & Details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-sm text-foreground truncate">{m.name}</h4>
                                <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.2 text-[10px] text-muted-foreground font-medium shrink-0">
                                  {m.rank || 'Mechanic'}
                                </span>
                              </div>

                              {/* Live Availability Status */}
                              <div className="text-xs mt-0.5">
                                {isOnLeave ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-medium">
                                    On Leave Today
                                  </span>
                                ) : m.canAccommodateAtRequestedTime ? (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                    <CheckCircle2 size={12} className="shrink-0" />
                                    <span className="truncate">Can accommodate at requested drop-off time</span>
                                  </span>
                                ) : (
                                  <span className="text-amber-700 dark:text-amber-400 font-medium truncate block">
                                    {m.conflictReason || 'Busy with existing tasks'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center gap-2 shrink-0">
                            {!isOnLeave && m.timeline.length > 0 && (
                              <button
                                type="button"
                                onClick={() => toggleTimeline(m.id)}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer shrink-0"
                              >
                                {isExpanded ? (
                                  <>
                                    <span>Hide Schedule</span>
                                    <ChevronUp size={13} />
                                  </>
                                ) : (
                                  <>
                                    <span>View Schedule</span>
                                    <ChevronDown size={13} />
                                  </>
                                )}
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isOnLeave}
                              onClick={() => setSelectedMechanicId(m.id)}
                              className={`inline-flex items-center justify-center gap-1.5 min-w-[84px] px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-brand text-brand-foreground shadow-sm'
                                  : 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                              } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                              {isSelected ? (
                                <>
                                  <Check size={12} className="stroke-[3]" />
                                  <span>Assigned</span>
                                </>
                              ) : (
                                <span>Assign</span>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Expandable Proposed Step-by-Step Timeline */}
                        {isExpanded && m.timeline.length > 0 && (
                          <div className="border-t border-slate-200/80 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-900/50 p-3.5 space-y-2 text-xs">
                            <p className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                              <Sparkles size={12} className="text-brand" /> Proposed Schedule for this Mechanic:
                            </p>

                            <div className="space-y-1.5 pl-2 border-l-2 border-brand/30 ml-1">
                              {m.timeline.map((slot, sIdx) => (
                                <React.Fragment key={`${slot.serviceId}-${sIdx}`}>
                                  {/* Task Slot */}
                                  <div className="flex flex-wrap items-center justify-between gap-2 py-1 text-xs">
                                    <div className="flex items-center gap-2">
                                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                                      <span className="font-semibold text-foreground">{slot.serviceName}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono">
                                        ({formatHours(slot.durationHours)})
                                      </span>
                                    </div>
                                    <div className="text-right text-muted-foreground font-mono text-[11px]">
                                      {slot.displayStart} → {slot.displayEnd}
                                    </div>
                                  </div>

                                  {/* Mandatory 12:00 PM - 1:00 PM Lunch Break Pause Indicator */}
                                  {slot.spansLunch && (
                                    <div className="my-1 flex items-center gap-2 rounded-md bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                      <Coffee size={13} className="shrink-0" />
                                      <span>12:00 PM – 1:00 PM Mandatory Lunch Break (Work Paused)</span>
                                    </div>
                                  )}
                                </React.Fragment>
                              ))}

                              {/* Estimated Final Finish */}
                              {m.earliestSlot && (
                                <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-between font-bold text-xs text-brand">
                                  <span className="flex items-center gap-1.5">
                                    <Flag size={12} /> Estimated Job Order Completion:
                                  </span>
                                  <span>{m.earliestSlot.displayFinish}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!selectedMechanicId}
            onClick={handleConfirm}
            className="rounded-lg bg-brand px-5 py-2 text-xs font-bold text-brand-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-sm transition-all"
          >
            Confirm Assignment
          </button>
        </div>
      </div>
    </div>
  )
}
