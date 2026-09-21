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
import { AlertTriangle, Camera, Loader2, Plus, Search, Send, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { ProposedPart, ProposedService } from '@/data/types'
import { reportFinding, uploadFindingPhoto } from '@/controllers/findingsController'

type CatalogService = { id: number; service_name: string; base_price: string | number; base_duration_hours: string | number }
type TaskOption = { id: number; title: string }

const peso = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export function ReportFindingModal({
  jobOrderId,
  task,
  onClose,
  onSent,
}: {
  jobOrderId: string
  task?: TaskOption // present = opened from that task's card; absent = general finding
  onClose: () => void
  onSent: () => void
}) {
  const [findings, setFindings] = useState('')

  // Photo — uploaded as soon as it's picked so Send only has to pass the URL.
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
  }
  function addCustomService() {
    const name = customName.trim()
    if (!name) return toast.error('Give the service a name.')
    if (services.some((s) => s.name.toLowerCase() === name.toLowerCase())) return toast.error('That service is already added.')
    if (customPrice.trim() === '' || !(Number(customPrice) >= 0)) return toast.error('Enter the labor price.')
    setServices((prev) => [...prev, { serviceId: null, name, hours: Number(customHours) > 0 ? Number(customHours) : 1, price: Number(customPrice) }])
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
    if (partPrice.trim() === '' || !(Number(partPrice) >= 0)) return toast.error('Enter the part price.')
    const qty = Math.max(1, Math.round(Number(partQty) || 1))
    setParts((prev) => [...prev, { name: partName.trim(), partNo: partNo.trim(), qty, unitPrice: Number(partPrice), serviceName: partFor }])
    setPartName(''); setPartNo(''); setPartQty('1'); setPartPrice('')
    setPartFor(null)
  }

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
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
    if (services.length === 0) return toast.error('Add at least one service — parts are listed under a service.')
    setSending(true)
    const r = await reportFinding(jobOrderId, { taskId: task?.id ?? null, findings: findings.trim(), photoUrl, services, parts })
    setSending(false)
    if (!r.ok) return toast.error(r.message)
    toast.success(r.emailed ? 'Sent to the customer — they were emailed too.' : 'Sent to the customer.')
    onSent()
    onClose()
  }

  const input = 'w-full rounded-lg border border-slate-200 p-2.5 text-sm text-slate-700 outline-none focus:border-emerald-500'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><AlertTriangle size={18} className="text-amber-500" /> Report a finding</h3>
            <p className="mt-0.5 text-sm text-slate-500">The customer must approve before anything is added to the job.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100" aria-label="Close"><X size={16} className="text-slate-500" /></button>
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
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />} {photoUrl ? 'Replace photo' : 'Add photo'}
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
                  <button key={s.id} type="button" onClick={() => addService(s)} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-emerald-100">
                    <span>{s.service_name}</span>
                    <span className="text-xs text-slate-400">{peso(Number(s.base_price || 0))}</span>
                  </button>
                )) : <div className="px-3 py-2 text-sm text-slate-400">No matching services</div>}
                <button
                  type="button"
                  onClick={() => { setCustomOpen(true); setCustomName(search.trim()); setSearch(''); setDropdownOpen(false) }}
                  className="block w-full border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold text-emerald-600 hover:bg-emerald-100"
                >
                  + Custom Service (Not Listed)
                </button>
              </div>
            )}
          </div>

          {customOpen && (
            <div className="mt-2 space-y-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
              <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Service name" className="w-full rounded-md border border-slate-200 p-1.5 text-xs" autoFocus />
              <div className="grid grid-cols-[80px_1fr_auto] items-center gap-1.5">
                <input value={customHours} onChange={(e) => setCustomHours(e.target.value)} type="number" min={0.5} step={0.5} className="min-w-0 rounded-md border border-slate-200 p-1.5 text-xs" aria-label="Hours" title="Labor hours" />
                <input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} type="number" min={0} placeholder="Labor price" className="min-w-0 rounded-md border border-slate-200 p-1.5 text-xs" />
                <div className="flex gap-1">
                  <button type="button" onClick={addCustomService} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Add</button>
                  <button type="button" onClick={() => setCustomOpen(false)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {services.length > 0 && (
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {services.map((s) => (
                <li key={s.name} className="p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-semibold text-slate-800">{s.name} <span className="font-normal text-slate-400">· {s.hours} hr{s.hours === 1 ? '' : 's'}{s.serviceId === null ? ' · custom' : ''}</span></span>
                    <span className="flex items-center gap-3">
                      <span className="font-semibold text-slate-800">{peso(s.price)}</span>
                      <button type="button" onClick={() => removeService(s.name)} className="text-slate-400 hover:text-red-500" aria-label={`Remove ${s.name}`}><X size={14} /></button>
                    </span>
                  </div>
                  {/* Parts under this service */}
                  {parts.filter((p) => p.serviceName === s.name).map((p, i) => (
                    <div key={`${p.name}-${i}`} className="mt-1.5 flex items-center justify-between pl-3 text-xs text-slate-600">
                      <span>{p.name} <span className="text-slate-400">· {p.partNo || '—'} · ×{p.qty}</span></span>
                      <span className="flex items-center gap-3">
                        {peso(p.unitPrice * p.qty)}
                        <button type="button" onClick={() => setParts((prev) => prev.filter((x) => x !== p))} className="text-slate-400 hover:text-red-500" aria-label={`Remove ${p.name}`}><X size={12} /></button>
                      </span>
                    </div>
                  ))}
                  {partFor === s.name ? (
                    <div className="mt-2 space-y-1.5 pl-3">
                      <input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder="Part name" className="w-full rounded-md border border-slate-200 p-1.5 text-xs" autoFocus />
                      <div className="grid grid-cols-[1fr_64px_1fr_auto] items-center gap-1.5">
                        <input value={partNo} onChange={(e) => setPartNo(e.target.value)} placeholder="Part no." className="min-w-0 rounded-md border border-slate-200 p-1.5 text-xs" />
                        <input value={partQty} onChange={(e) => setPartQty(e.target.value)} type="number" min={1} className="min-w-0 rounded-md border border-slate-200 p-1.5 text-xs" aria-label="Quantity" title="Quantity" />
                        <input value={partPrice} onChange={(e) => setPartPrice(e.target.value)} type="number" min={0} placeholder="Unit price" className="min-w-0 rounded-md border border-slate-200 p-1.5 text-xs" />
                        <div className="flex gap-1">
                          <button type="button" onClick={addPart} className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">Add</button>
                          <button type="button" onClick={() => setPartFor(null)} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-50">Cancel</button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setPartFor(s.name)} className="mt-1.5 flex items-center gap-1 pl-3 text-xs font-semibold text-emerald-600 hover:underline"><Plus size={12} /> Add part</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-3">
          <span className="text-sm font-semibold text-slate-700">Additional cost</span>
          <span className="text-lg font-bold text-slate-900">{peso(total)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">Labor {peso(labor)} · Parts {peso(partsCost)}. Nothing is added to the job until the customer approves.</p>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={send} disabled={sending || uploading} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send to customer
          </button>
        </div>
      </div>
    </div>
  )
}
