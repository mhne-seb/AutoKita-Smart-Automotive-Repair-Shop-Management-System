'use client'

// ReportFindingModal — the mechanic found something mid-service that the
// approved quotation didn't cover. They describe it, optionally attach a
// photo, list the services/parts it would take, and send it to the customer.
// Nothing is added to the job until the customer approves.
//
// Opened from a task card the finding is tied to that task; opened from the
// sidebar it's a general finding (something noticed while the car was in the
// shop, not part of any one service).

import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, Loader2, Plus, Search, Send, Trash2, Upload, X, Pencil, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { ProposedPart, ProposedService } from '@/data/types'
import { reportFinding, uploadFindingPhoto } from '@/controllers/findingsController'

type CatalogService = { id: number; service_name: string; base_price: string | number; base_duration_hours: string | number; is_price_fixed?: boolean }
type TaskOption = { id: number; title: string }

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function ReportFindingModal({
  jobOrderId,
  task,
  vehicle,
  onClose,
  onSent,
}: {
  jobOrderId: string
  task?: TaskOption // present = opened from that task's card; absent = general finding
  vehicle?: { year: number | null; type: string; mileage: number | null }
  onClose: () => void
  onSent: () => void
}) {
  const [findings, setFindings] = useState('')

  // Photo — uploaded as soon as it's picked so Send only has to pass the URL.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  // Service catalog + the same searchable picker the quotation page uses.
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [search, setSearch] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [services, setServices] = useState<ProposedService[]>([])
  const [parts, setParts] = useState<ProposedPart[]>([])

  // "+ Custom service" — a service the catalog doesn't have. Name, hours and
  // price are typed in; it's created in the catalog only if the customer approves.
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [customHours, setCustomHours] = useState('1')
  const [customPrice, setCustomPrice] = useState('')

  // Inline "add part" row — which service it's for and the three fields.
  const [partFor, setPartFor] = useState<string | null>(null)
  const [partName, setPartName] = useState('')
  const [partNo, setPartNo] = useState('')
  const [partQty, setPartQty] = useState('1')
  const [partPrice, setPartPrice] = useState('')
  const [partInStock, setPartInStock] = useState(false)
  const [editVals, setEditVals] = useState<Record<string, { hours: string; price: string }>>({})

  const [aiPredictions, setAiPredictions] = useState<Record<string, { predicted_amount: number; predicted_duration_mins?: number; is_mock?: boolean; is_low_data?: boolean; sample_count?: number; min_samples_required?: number }>>({})

  const [sending, setSending] = useState(false)

  useEffect(() => {
    let active = true
    fetch('/api/services')
      .then((r) => r.json())
      .then((d) => { if (active && d.success) setCatalog(d.services) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = catalog.filter(
    (s) => s.service_name.toLowerCase().includes(search.toLowerCase()) && !services.some((x) => x.serviceId === s.id),
  )

  function addService(s: CatalogService) {
    setServices((prev) => [...prev, { serviceId: s.id, name: s.service_name, hours: Number(s.base_duration_hours || 1), price: Number(s.base_price || 0) }])
    setSearch('')
    setDropdownOpen(false)

    if (vehicle) {
      const age = Math.max(0, new Date().getFullYear() - (vehicle.year || new Date().getFullYear()))
      const actualMileage = vehicle.mileage || (age * 15000)
      const baseHours = Number(s.base_duration_hours || 1)
      const basePrice = Number(s.base_price || 0)

      fetch('/api/predict/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estimated_duration_mins: baseHours * 60,
          service_id: s.id,
          base_price: basePrice,
          base_duration_hours: baseHours,
          is_price_fixed: s.is_price_fixed ? 1 : 0,
          vehicle_age: age,
          vehicle_type: vehicle.type,
          mileage: actualMileage,
        }),
      })
      .then(r => r.json())
      .then(data => {
        if (data.is_low_data || data.can_estimate === false) {
          setAiPredictions(prev => ({ ...prev, [s.service_name]: { is_low_data: true, sample_count: data.sample_count ?? 0, min_samples_required: data.min_samples_required ?? 10, predicted_amount: 0 } }))
        } else if (data.predicted_amount) {
          setAiPredictions(prev => ({ ...prev, [s.service_name]: data }))
        }
      })
      .catch(() => {})
    }
  }
  function updateService(name: string, hours: number, price: number) {
    setServices((prev) => prev.map((s) => (s.name === name ? { ...s, hours, price } : s)))
  }
  function validateHoursStr(str: string) {
    const t = str.trim()
    if (!t) return 'Enter the hours.'
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return 'Enter the hours as a number, like 1.5.'
    const n = Number(t)
    if (n <= 0) return 'Hours must be more than 0.'
    if (n > 100) return 'Hours is too high.'
    return null
  }
  // Checks the typed text itself: Number('-000') is -0, which slips past a "< 0" test.
  function validatePriceStr(str: string, what = 'labor price') {
    const t = str.trim()
    if (!t) return `Enter the ${what}.`
    if (t.startsWith('-')) return "Price can't be negative."
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return `Enter the ${what} as a number, like 3500 or 3500.50.`
    if (Number(t) > 1000000) return 'Price is too high.'
    return null
  }
  function addCustomService() {
    const name = customName.trim()
    if (!name) return toast.error('Give the service a name.')
    if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast.error('That service is already added.')
    const hoursError = validateHoursStr(customHours)
    if (hoursError) return toast.error(hoursError)
    const priceError = validatePriceStr(customPrice)
    if (priceError) return toast.error(priceError)
    setServices((prev) => [...prev, { serviceId: null, name, hours: Number(customHours), price: Number(customPrice) }])
    setCustomName(''); setCustomHours('1'); setCustomPrice('')
    setCustomOpen(false)
  }
  function removeService(name: string) {
    setServices((prev) => prev.filter((s) => s.name !== name))
    setParts((prev) => prev.filter((p) => p.serviceName !== name)) // its parts go with it
    if (partFor === name) setPartFor(null)
  }
  function addPart() {
    if (!partFor) return
    if (!partName.trim()) return toast.error('Give the part a name.')
    const priceError = validatePriceStr(partPrice, 'part price')
    if (priceError) return toast.error(priceError)
    const qty = Math.max(1, Math.round(Number(partQty) || 1))
    setParts((prev) => [...prev, { name: partName.trim(), partNo: partNo.trim(), qty, unitPrice: Number(partPrice), serviceName: partFor, inStock: partInStock }])
    setPartName(''); setPartNo(''); setPartQty('1'); setPartPrice(''); setPartInStock(false)
    setPartFor(null)
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = '' // re-picking the same file still fires onChange
    if (!f) return
    if (f.size > 5 * 1024 * 1024) return toast.error('Photo must be under 5MB.')
    setUploading(true)
    const r = await uploadFindingPhoto(jobOrderId, f)
    setUploading(false)
    if (!r.ok) return toast.error(r.message)
    setPhotoUrl(r.url ?? null)
  }

  const labor = services.reduce((s, x) => s + x.price, 0)
  const partsCost = parts.reduce((s, p) => s + p.unitPrice * p.qty, 0)
  const total = labor + partsCost

  async function send() {
    if (!findings.trim()) return toast.error('Describe what you found.')
    // A row that's typed but not added would be silently lost — stop here.
    if (customOpen && customName.trim()) return toast.error('Finish adding the custom service (click Add) or cancel it first.')
    if (partFor && (partName.trim() || partPrice.trim())) return toast.error('Finish adding the part (click Add) or cancel it first.')
    if (services.length === 0) return toast.error('Add at least one service — parts are listed under a service.')
    for (const [name, vals] of Object.entries(editVals)) {
      if (validateHoursStr(vals.hours) || validatePriceStr(vals.price)) return toast.error('Please fix invalid values before sending.')
    }
    const finalServices = services.map(s => editVals[s.name] !== undefined ? { ...s, hours: Number(editVals[s.name].hours), price: Number(editVals[s.name].price) } : s)

    setSending(true)
    const r = await reportFinding(jobOrderId, { taskId: task?.id ?? null, findings: findings.trim(), photoUrl, services: finalServices, parts })
    setSending(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(r.emailed ? 'Sent to the customer — they were emailed too.' : 'Sent to the customer.')
    onSent()
    onClose()
  }

  const input = 'w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500'
  // Enter in an inline row = its Add button; Escape = its Cancel.
  const onRowKey = (add: () => void, cancel: () => void) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); add() }
    if (e.key === 'Escape') { e.preventDefault(); cancel() }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><AlertTriangle size={18} className="text-amber-500" /> Report a finding</h3>
            <p className="mt-0.5 text-sm text-slate-500">The customer must approve before anything is added to the job.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md" aria-label="Close"><X size={16} className="text-slate-500" /></button>
        </div>

        <p className="mt-4 text-sm text-slate-600">
          {task
            ? <>Found while working on <span className="font-semibold text-slate-900">{task.title}</span></>
            : <>General finding — <span className="text-slate-500">noticed while the vehicle was in the shop, not part of an approved service.</span></>}
        </p>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">What did you find?</label>
          <textarea value={findings} onChange={(e) => setFindings(e.target.value)} rows={3} placeholder="Rear brake pads below 2 mm, left rotor scored…" className={input} />
        </div>

        <div className="mt-3 flex items-center gap-3">
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={pickPhoto} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickPhoto} />
          {/* capture="environment" only means anything on a touch device with
              a camera (phone OR tablet) — gate on pointer type, not screen
              width, since a tablet is wide but still has a working camera. */}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none [@media(pointer:fine)]:hidden">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} {photoUrl ? 'Retake' : 'Take Photo'}
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
            <Upload size={13} />
            <span className="[@media(pointer:fine)]:hidden">Gallery</span>
            <span className="hidden [@media(pointer:fine)]:inline">{photoUrl ? 'Replace photo' : 'Add photo'}</span>
          </button>
          {photoUrl && (
            <div className="flex items-center gap-2">
              <img src={photoUrl} alt="Finding" className="h-12 w-16 rounded-md border object-cover" />
              <button type="button" onClick={() => setPhotoUrl(null)} className="text-slate-400 hover:text-red-500" aria-label="Remove photo"><Trash2 size={14} /></button>
            </div>
          )}
          <span className="text-xs text-slate-400">Optional</span>
        </div>

        {/* Services */}
        <div className="mt-5">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Services to add</label>
          <div ref={dropdownRef} className="relative">
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true) }}
                onFocus={() => setDropdownOpen(true)}
                placeholder="Type to search services…"
                className={`${input} pl-9`}
              />
            </div>
            {dropdownOpen && (
              <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {filtered.length > 0 ? filtered.map((s) => (
                  <button key={s.id} type="button" onMouseDown={(e) => { e.preventDefault(); addService(s) }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-100 cursor-pointer">
                    <span>{s.service_name}</span>
                    <span className="text-xs text-slate-400">{peso(Number(s.base_price || 0))}</span>
                  </button>
                )) : <div className="px-3 py-2 text-sm text-slate-400">No matching services</div>}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setCustomOpen(true); setCustomName(search.trim()); setSearch(''); setDropdownOpen(false) }}
                  className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-emerald-600 hover:bg-emerald-100 cursor-pointer"
                >
                  + Custom Service (Not Listed)
                </button>
              </div>
            )}
          </div>

          {customOpen && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5" onKeyDown={onRowKey(addCustomService, () => setCustomOpen(false))}>
              <p className="text-xs font-semibold text-emerald-700">New custom service <span className="font-normal text-slate-500">— fill this in and click Add; you can add its parts after.</span></p>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Service name
                <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="e.g. Cabin Filter Replacement" className="mt-0.5 w-full rounded-md border border-slate-200 p-1.5 text-xs font-normal normal-case tracking-normal text-slate-700" autoFocus />
              </label>
              <div className="grid grid-cols-[90px_1fr_auto] items-end gap-1.5">
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Hours
                  <input value={customHours} onChange={(e) => setCustomHours(e.target.value)} type="number" min={0.5} step={0.5} className="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 p-1.5 text-xs font-normal text-slate-700" />
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Labor price (₱)
                  <input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} type="number" min={0} placeholder="0" className="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 p-1.5 text-xs font-normal text-slate-700" />
                </label>
                <div className="flex gap-1">
                  <button type="button" onClick={addCustomService} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Add</button>
                  <button type="button" onClick={() => setCustomOpen(false)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {services.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {services.map((s) => {
                const isEditing = editVals[s.name] !== undefined
                const editPriceStr = isEditing ? editVals[s.name].price : ''
                const editHoursStr = isEditing ? editVals[s.name].hours : ''
                const priceError = isEditing ? validatePriceStr(editPriceStr) : null
                const hoursError = isEditing ? validateHoursStr(editHoursStr) : null
                const error = hoursError || priceError


                const onKey = (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter' && !error) {
                    e.preventDefault()
                    updateService(s.name, Number(editHoursStr), Number(editPriceStr))
                    setEditVals(prev => { const n = {...prev}; delete n[s.name]; return n })
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setEditVals(prev => { const n = {...prev}; delete n[s.name]; return n })
                  }
                }

                return (
                <li key={s.name} className="p-3">
                  <div className="flex items-start justify-between gap-2 text-sm">
                    <div>
                      <span className="font-semibold text-slate-800">{s.name} <span className="font-normal text-slate-400">{s.serviceId === null ? ' · custom' : ''}</span></span>

                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => setEditVals(prev => ({...prev, [s.name]: { hours: String(s.hours), price: String(s.price) }}))}
                          className="text-slate-400 hover:text-emerald-600 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"
                          aria-label={`Edit for ${s.name}`}
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      <button type="button" onClick={() => removeService(s.name)} className="text-slate-400 hover:text-red-500 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0" aria-label={`Remove ${s.name}`}><X size={14} /></button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-start gap-6 text-sm">
                    {/* Time Column */}
                    <div className="flex-1">
                      <p className="mb-1 flex items-center gap-1.5 text-slate-400">
                        Labor Time
                        {!s.serviceId || aiPredictions[s.name]?.is_low_data ? (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
                            title={aiPredictions[s.name]?.sample_count !== undefined
                              ? `Need at least 10 completed jobs for AI estimation (${aiPredictions[s.name].sample_count}/10 completed)`
                              : "Need more historical data for AI estimation"}
                          >
                            🤖 Low Data
                          </span>
                        ) : aiPredictions[s.name] && aiPredictions[s.name].predicted_duration_mins && (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-200"
                            title={`${aiPredictions[s.name].is_mock ? 'ai' : 'AI'} suggests ${Math.round(aiPredictions[s.name].predicted_duration_mins! / 60 * 10) / 10} hrs`}
                          >
                            🤖 {Math.round(aiPredictions[s.name].predicted_duration_mins! / 60 * 10) / 10} hrs
                          </span>
                        )}
                      </p>
                      {isEditing ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={editHoursStr}
                              onChange={e => setEditVals(prev => ({...prev, [s.name]: { ...prev[s.name], hours: e.target.value }}))}
                              onKeyDown={onKey}
                              autoFocus
                              className={`w-full rounded-md border p-1.5 text-sm outline-none ${hoursError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-emerald-500'}`}
                            />
                            <span className="text-xs text-slate-500">hrs</span>
                          </div>
                          {hoursError && <span className="text-[10px] leading-tight text-red-500 w-full">{hoursError}</span>}
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-800">{s.hours} hr{s.hours === 1 ? '' : 's'}</span>
                      )}
                    </div>

                    {/* Cost Column */}
                    <div className="flex-1">
                      <p className="mb-1 flex items-center gap-1.5 text-slate-400">
                        Labor Cost
                        {!s.serviceId || aiPredictions[s.name]?.is_low_data ? (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200"
                            title={aiPredictions[s.name]?.sample_count !== undefined
                              ? `Need at least 10 completed jobs for AI estimation (${aiPredictions[s.name].sample_count}/10 completed)`
                              : "Need more historical data for AI estimation"}
                          >
                            🤖 Low Data
                          </span>
                        ) : aiPredictions[s.name] && aiPredictions[s.name].predicted_amount ? (
                          <span
                            className="inline-flex cursor-help items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700 hover:bg-purple-200"
                            title={`${aiPredictions[s.name].is_mock ? 'ai' : 'AI'} suggests ${peso(aiPredictions[s.name].predicted_amount)}`}
                          >
                            🤖 {peso(aiPredictions[s.name].predicted_amount)}
                          </span>
                        ) : null}
                      </p>
                      {isEditing ? (
                        <div className="flex items-start gap-2">
                          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={editPriceStr}
                              onChange={e => setEditVals(prev => ({...prev, [s.name]: { ...prev[s.name], price: e.target.value }}))}
                              onKeyDown={onKey}
                              className={`w-full rounded-md border p-1.5 text-sm outline-none ${priceError ? 'border-red-300 focus:border-red-500' : 'border-slate-200 focus:border-emerald-500'}`}
                            />
                            {priceError && <span className="text-[10px] leading-tight text-red-500 w-full">{priceError}</span>}
                          </div>
                          <button
                            type="button"
                            disabled={!!error}
                            onClick={() => {
                              if (!error) {
                                updateService(s.name, Number(editHoursStr), Number(editPriceStr))
                                setEditVals(prev => { const n = {...prev}; delete n[s.name]; return n })
                              }
                            }}
                            className={`mt-0.5 shrink-0 rounded p-1 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${error ? 'text-slate-300' : 'text-emerald-600 hover:bg-emerald-50 hover:shadow-sm'}`}
                            aria-label="Save edits"
                          >
                            <Check size={16} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold text-slate-800">{peso(s.price)}</span>
                      )}
                    </div>
                  </div>
                  {/* Parts under this service */}
                  {parts.filter((p) => p.serviceName === s.name).map((p, i) => (
                    <div key={`${p.name}-${i}`} className="mt-1.5 flex items-center justify-between pl-3 text-xs text-slate-600">
                      <span>
                        {p.name} <span className="text-slate-400">· {p.partNo || '—'} · ×{p.qty}</span>
                        {p.inStock && <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">In stock</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        {peso(p.unitPrice * p.qty)}
                        <button type="button" onClick={() => setParts((prev) => prev.filter((x) => x !== p))} className="text-slate-400 hover:text-red-500 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0" aria-label={`Remove ${p.name}`}><X size={12} /></button>
                      </span>
                    </div>
                  ))}
                  {partFor === s.name ? (
                    <div className="mt-2 space-y-1.5 rounded-md bg-slate-50 p-2 pl-3" onKeyDown={onRowKey(addPart, () => setPartFor(null))}>
                      <p className="text-[11px] text-slate-500">New part for <span className="font-semibold text-slate-700">{s.name}</span></p>
                      <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Part name
                        <input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="e.g. Cabin air filter" className="mt-0.5 w-full rounded-md border border-slate-200 p-1.5 text-xs font-normal normal-case tracking-normal text-slate-700" autoFocus />
                      </label>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={partInStock}
                          onChange={(e) => setPartInStock(e.target.checked)}
                          className="h-3.5 w-3.5 accent-emerald-600 cursor-pointer"
                        />
                        Already in stock (no need to order)
                      </label>
                      <div className="grid grid-cols-[1fr_64px_1fr_auto] items-end gap-1.5">
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Part no.
                          <input value={partNo} onChange={(e) => setPartNo(e.target.value)} placeholder="optional" className="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 p-1.5 text-xs font-normal normal-case tracking-normal text-slate-700" />
                        </label>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Qty
                          <input value={partQty} onChange={(e) => setPartQty(e.target.value)} type="number" min={1} className="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 p-1.5 text-xs font-normal text-slate-700" />
                        </label>
                        <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Price (₱)
                          <input value={partPrice} onChange={(e) => setPartPrice(e.target.value)} type="number" min={0} placeholder="0" className="mt-0.5 w-full min-w-0 rounded-md border border-slate-200 p-1.5 text-xs font-normal text-slate-700" />
                        </label>
                        <div className="flex gap-1">
                          <button type="button" onClick={addPart} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Add</button>
                          <button type="button" onClick={() => { setPartFor(null); setPartInStock(false) }} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPartFor(s.name)} className="mt-1.5 flex items-center gap-1 pl-3 text-xs font-semibold text-emerald-600 hover:underline cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0"><Plus size={12} /> Add part</button>
                  )}
                </li>
              )})}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-700">Additional cost</span>
          <span className="text-lg font-bold text-slate-900">{peso(total)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Labor {peso(labor)} · Parts {peso(partsCost)}. Nothing is added to the job until the customer approves.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md">Cancel</button>
          <button type="button" onClick={send} disabled={sending || uploading} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to customer
          </button>
        </div>
      </div>
    </div>
  )
}
