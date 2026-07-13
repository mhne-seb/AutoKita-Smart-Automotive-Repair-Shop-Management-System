'use client'

// Admin "Job Order Detail" page — the work-order builder for a single job order: itemized services + parts, cost estimate, and a "send update to customer" action.
import { useEffect, useState } from 'react'
import Link from "next/link";
import { ArrowLeft, FileText, ShieldCheck, Plus, Pencil, Trash2, RefreshCw, Send, Check, X } from 'lucide-react'
import { currency } from '../data/mockData'
import { getWorkOrderTemplate } from '@/controllers/jobOrderController'
import type { ServiceLine, PartLine } from '@/data/jobOrderWorkOrder'

const SERVICE_PRESETS_FALLBACK = ['Others', 'Oil Change', 'Brake Service']

export function JobOrderDetail() {
  // Starting line items come from the controller (mock API) rather than
  // being hardcoded in this component — see src/data/jobOrderWorkOrder.ts
  // and src/controllers/jobOrderController.ts.
  const [services, setServices] = useState<ServiceLine[]>([])
  const [parts, setParts] = useState<PartLine[]>([])
  const [servicePresets, setServicePresets] = useState<string[]>(SERVICE_PRESETS_FALLBACK)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    getWorkOrderTemplate().then((data) => {
      if (!active) return
      setServices(data.services)
      setParts(data.parts)
      setServicePresets(data.servicePresets)
      setLoaded(true)
    })
    return () => {
      active = false
    }
  }, [])

  const [editingServiceId, setEditingServiceId] = useState<string | null>(null)
  const [editingPartId, setEditingPartId] = useState<string | null>(null)

  const [selectedPreset, setSelectedPreset] = useState(SERVICE_PRESETS_FALLBACK[0])
  const [customDescription, setCustomDescription] = useState('EGR Valve Decarbonizing & Injector Cleaning')
  const [costEstimate, setCostEstimate] = useState('₱4,500')
  const [updateSent, setUpdateSent] = useState(false)
  const [finalizedSent, setFinalizedSent] = useState(false)

  const totalParts = parts.reduce((sum, p) => sum + p.qty * p.unitPrice, 0)
  const totalLabor = 24800
  const grandTotal = totalParts + totalLabor
  const partialPayment = 25000
  const balanceDue = grandTotal - partialPayment

  function addServiceToSheet() {
    const name = selectedPreset === 'Others' ? customDescription.trim() : selectedPreset
    if (!name) return
    setServices((prev) => [...prev, { id: `s${Date.now()}`, name, description: `Cost estimate: ${costEstimate}`, done: false }])
    setCustomDescription('')
    setCostEstimate('₱0')
  }

  function deleteService(id: string) {
    setServices((prev) => prev.filter((s) => s.id !== id))
  }

  function renameService(id: string, name: string, description: string) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, name, description } : s)))
    setEditingServiceId(null)
  }

  function deletePart(id: string) {
    setParts((prev) => prev.filter((p) => p.id !== id))
  }

  function updatePart(id: string, patch: Partial<PartLine>) {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    setEditingPartId(null)
  }

  return (
    <div className="space-y-6 p-8">
      <Link href="/job-orders" className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800">
        <ArrowLeft size={15} /> Back to Customers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Job Orders</h1>
          <p className="mt-1 text-sm text-slate-500">Quotation builder &amp; customer approval workflow.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> Sync Active
          <span className="ml-2 text-slate-400">Customer ID: #CUST-2026-1234</span>
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        <FileText size={15} /> Generate Job Order
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900">AutoKita Automotive Mechanical Services</h2>
                <p className="text-sm text-slate-400">
                  971 Domingo Santiago, Brgy. 576, Sampaloc, Manila · 0921-758-2490 / 0945-456-8431
                </p>
              </div>
              <div className="text-right">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  JO-2026-8830
                </span>
                <p className="mt-1 text-sm text-slate-400">Status: In Progress</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <Field label="Name" value="Juan Dela Cruz" />
              <Field label="Date" value="2026-05-28" />
              <Field label="Address" value="Sampaloc, Manila" />
              <Field label="Date Promised" value="2026-05-30" />
              <Field label="Phone" value="0995-123-4567" />
              <Field label="Motor No" value="ABC 1234" />
              <Field label="Year & Model" value="Tesla Model 3 2022" />
              <Field label="Estimated Repair Duration" value="16 hrs" />
              <Field label="Actual Repair Duration" value="12 hrs (In Progress)" />
              <Field
                label="Description / Remarks"
                value="Customer approved partial payment via BDO. Awaiting transmission parts. Standard mechanical inspections are fully complete."
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Service Scope (Administrative Controls)</h3>
                <p className="text-sm text-slate-400">Add new services or delete current task assignments below.</p>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                <ShieldCheck size={13} /> Admin Authorized
              </span>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Add Service to Sheet</p>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Select Service</label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => setSelectedPreset(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {servicePresets.map((opt) => (
                      <option key={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    Service Description (if others, input here)
                  </label>
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <input
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                      disabled={selectedPreset !== 'Others'}
                      className="flex-1 bg-transparent outline-none disabled:text-slate-300"
                      placeholder="Describe the service..."
                    />
                    {selectedPreset === 'Others' && (
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        UNIQUE SERVICE
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-end gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500">Cost Estimate</label>
                  <input
                    value={costEstimate}
                    onChange={(e) => setCostEstimate(e.target.value)}
                    className="mt-1 w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={addServiceToSheet}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  <Plus size={14} /> Add to Sheet
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {services.map((s) => {
                const editing = editingServiceId === s.id
                return (
                  <div key={s.id} className="rounded-xl border border-slate-100 p-4">
                    {editing ? (
                      <ServiceEditRow service={s} onSave={renameService} onCancel={() => setEditingServiceId(null)} />
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          <span
                            className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                              s.done ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {s.done ? '✓' : '▶'}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-800">{s.name}</p>
                            <p className="text-sm text-slate-400">{s.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditingServiceId(s.id)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteService(s.id)}
                            className="rounded-lg border border-rose-200 p-2 text-rose-500 hover:bg-rose-50"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {services.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">No services added yet.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900">Parts and Inventory Billable Details</h3>
            <table className="mt-4 w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 font-semibold">Qty</th>
                  <th className="py-2 font-semibold">Part No. &amp; Description</th>
                  <th className="py-2 font-semibold">Unit Price</th>
                  <th className="py-2 font-semibold">Amount</th>
                  <th className="py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => {
                  const editing = editingPartId === p.id
                  return (
                    <tr key={p.id} className="border-b border-slate-50 last:border-0">
                      {editing ? (
                        <PartEditRow part={p} onSave={updatePart} onCancel={() => setEditingPartId(null)} />
                      ) : (
                        <>
                          <td className="py-3 font-semibold text-slate-700">{p.qty}</td>
                          <td className="py-3">
                            <p className="font-semibold text-slate-800">{p.name}</p>
                            <p className="text-xs text-slate-400">{p.partNo}</p>
                          </td>
                          <td className="py-3 text-slate-600">{currency(p.unitPrice)}</td>
                          <td className="py-3 font-semibold text-slate-800">{currency(p.qty * p.unitPrice)}</td>
                          <td className="py-3">
                            <div className="flex gap-2">
                              <button onClick={() => setEditingPartId(p.id)} className="text-slate-400 hover:text-slate-600">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => deletePart(p.id)} className="text-rose-400 hover:text-rose-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
                {parts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-sm text-slate-400">
                      No parts added yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-bold text-slate-900">Cost Breakdown Summary</h3>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Total Parts Bill" value={currency(totalParts)} />
              <Row label="Total Service / Labor" value={currency(totalLabor)} />
              <div className="h-px bg-slate-100" />
              <Row label="Grand Total" value={currency(grandTotal)} bold />
              <Row label="Partial Payment (BDO)" value={`(${currency(partialPayment)})`} valueClass="text-emerald-600" />
              <div className="h-px bg-slate-100" />
              <Row label="Balance Due" value={currency(balanceDue)} bold valueClass="text-rose-600" labelClass="text-rose-600" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Customer Portal Updates
            </p>
            <button
              onClick={() => setUpdateSent(true)}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={updateSent}
            >
              <RefreshCw size={15} /> {updateSent ? 'Customer Notified' : 'Update Customer of Changes'}
            </button>
            <p className="mt-2 text-xs text-slate-400">
              Notifies customer to confirm pending additional parts &amp; services
            </p>
            <button
              onClick={() => setFinalizedSent(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={finalizedSent}
            >
              <Send size={15} /> {finalizedSent ? 'Sent to Customer' : 'Send Finalized JO to Customer'}
            </button>
            <p className="mt-2 text-center text-xs text-slate-400">
              Linked to account ID: #CUST-2026-1234
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mechanic Assigned</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-sm font-semibold text-white">
                J
              </div>
              <div>
                <p className="font-semibold text-slate-800">Jose Santos</p>
                <p className="text-sm text-slate-400">Mechanics</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceEditRow({
  service,
  onSave,
  onCancel,
}: {
  service: ServiceLine
  onSave: (id: string, name: string, description: string) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(service.name)
  const [description, setDescription] = useState(service.description)
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 space-y-2">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold" />
        <input value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500" />
      </div>
      <button onClick={() => onSave(service.id, name, description)} className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50">
        <Check size={14} />
      </button>
      <button onClick={onCancel} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
        <X size={14} />
      </button>
    </div>
  )
}

function PartEditRow({
  part,
  onSave,
  onCancel,
}: {
  part: PartLine
  onSave: (id: string, patch: Partial<PartLine>) => void
  onCancel: () => void
}) {
  const [qty, setQty] = useState(part.qty)
  const [unitPrice, setUnitPrice] = useState(part.unitPrice)
  return (
    <td colSpan={5} className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(Number(e.target.value) || 0)}
          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-sm"
        />
        <span className="flex-1 text-sm font-semibold text-slate-700">{part.name}</span>
        <input
          type="number"
          value={unitPrice}
          onChange={(e) => setUnitPrice(Number(e.target.value) || 0)}
          className="w-24 rounded-lg border border-slate-200 px-2 py-1 text-sm"
        />
        <button onClick={() => onSave(part.id, { qty, unitPrice })} className="rounded-lg border border-emerald-200 p-2 text-emerald-600 hover:bg-emerald-50">
          <Check size={14} />
        </button>
        <button onClick={onCancel} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
          <X size={14} />
        </button>
      </div>
    </td>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-800">{value}</p>
    </div>
  )
}

function Row({
  label,
  value,
  bold,
  valueClass = 'text-slate-800',
  labelClass = 'text-slate-500',
}: {
  label: string
  value: string
  bold?: boolean
  valueClass?: string
  labelClass?: string
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={labelClass}>{label}</span>
      <span className={`${bold ? 'text-lg font-bold' : 'font-semibold'} ${valueClass}`}>{value}</span>
    </div>
  )
}