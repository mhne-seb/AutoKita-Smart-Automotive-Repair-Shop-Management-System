'use client'

import { useMemo, useState } from 'react'
import { Plus, Printer, Trash2, X } from 'lucide-react'
import { getJobOrderById } from '../../data/jobOrders'
import { getQuotationById } from '../../data/quotations'
import { currency } from '../../data/mockData'
const autokitaLogo = '/assets/autokita-logo.png' 

interface Props {
  jobOrderId: string
  onClose: () => void
}

interface PartRow {
  id: string
  qty: number
  description: string
  unitPrice: number
}

interface WorkRow {
  id: string
  description: string
  amount: number
}

function LineInput({
  value,
  onChange,
  className = '',
  align = 'left',
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full border-b border-dotted border-slate-300 bg-transparent px-1 py-0.5 text-sm text-slate-900 outline-none focus:border-slate-500 ${
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      } ${className}`}
    />
  )
}

function NumberInput({
  value,
  onChange,
  className = '',
}: {
  value: number
  onChange: (v: number) => void
  className?: string
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`w-full border-b border-dotted border-slate-300 bg-transparent px-1 py-0.5 text-right text-sm text-slate-900 outline-none focus:border-slate-500 ${className}`}
    />
  )
}

export function GenerateJobOrderModal({ jobOrderId, onClose }: Props) {
  const jobOrder = getJobOrderById(jobOrderId)
  const quotation = getQuotationById(jobOrderId)

  const [name, setName] = useState(jobOrder?.customer ?? '')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [datePromised, setDatePromised] = useState('')
  const [motorNo, setMotorNo] = useState(jobOrder?.plate ?? '')
  const [yearModel, setYearModel] = useState(jobOrder?.vehicle ?? '')

  const [partRows, setPartRows] = useState<PartRow[]>(() => {
    const fromQuotation = quotation?.services.flatMap((s) =>
      s.parts.map((p) => ({ id: p.id, qty: p.qty, description: p.name, unitPrice: p.unitPrice }))
    )
    return fromQuotation && fromQuotation.length > 0
      ? fromQuotation
      : [{ id: `part-${Date.now()}`, qty: 1, description: '', unitPrice: 0 }]
  })

  const [workRows, setWorkRows] = useState<WorkRow[]>(() => {
    const fromQuotation = quotation?.services.map((s) => ({ id: s.id, description: s.name, amount: s.laborCost }))
    return fromQuotation && fromQuotation.length > 0
      ? fromQuotation
      : [{ id: `work-${Date.now()}`, description: '', amount: 0 }]
  })

  const [partialPayment, setPartialPayment] = useState(0)
  const [partialPaymentMode, setPartialPaymentMode] = useState('BDO')

  const totalParts = useMemo(() => partRows.reduce((sum, p) => sum + p.qty * p.unitPrice, 0), [partRows])
  const totalService = useMemo(() => workRows.reduce((sum, w) => sum + w.amount, 0), [workRows])
  const grandTotal = totalParts + totalService
  const balance = grandTotal - partialPayment

  function updatePart(id: string, patch: Partial<PartRow>) {
    setPartRows((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  function addPartRow() {
    setPartRows((prev) => [...prev, { id: `part-${Date.now()}`, qty: 1, description: '', unitPrice: 0 }])
  }
  function removePartRow(id: string) {
    setPartRows((prev) => prev.filter((p) => p.id !== id))
  }

  function updateWork(id: string, patch: Partial<WorkRow>) {
    setWorkRows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)))
  }
  function addWorkRow() {
    setWorkRows((prev) => [...prev, { id: `work-${Date.now()}`, description: '', amount: 0 }])
  }
  function removeWorkRow(id: string) {
    setWorkRows((prev) => prev.filter((w) => w.id !== id))
  }

  const rowCount = Math.max(partRows.length, workRows.length)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4 no-print-overlay">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .jo-print-area, .jo-print-area * { visibility: visible; }
          .jo-print-area { position: absolute; inset: 0; width: 100%; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="jo-print-area flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Toolbar (hidden on print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="font-bold text-slate-900">Generate Job Order</p>
            <p className="text-xs text-slate-400">Edit any field below, then print or download.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable sheet */}
        <div className="overflow-y-auto px-8 py-6">
          <div className="flex items-start gap-4">
            <img src={autokitaLogo} alt="AutoKita" className="h-16 w-16 shrink-0 object-contain" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">JOB ORDER</h1>
              <div className="mt-1 text-sm">
                <p className="font-bold text-slate-900">AUTOKITA AUTOMOTIVE MECHANICAL SERVICES</p>
                <p className="text-slate-600">971 Domingo Santiago, Brgy. 576, Sampaloc, Manila</p>
                <p className="text-slate-600">0921-758-2490 / 0945-456-8431</p>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-2 rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Name:</span>
              <LineInput value={name} onChange={setName} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Date:</span>
              <LineInput value={date} onChange={setDate} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Address:</span>
              <LineInput value={address} onChange={setAddress} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Date Promised:</span>
              <LineInput value={datePromised} onChange={setDatePromised} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Phone:</span>
              <LineInput value={phone} onChange={setPhone} />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Motor No.:</span>
              <LineInput value={motorNo} onChange={setMotorNo} />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <span className="w-28 shrink-0 font-semibold text-slate-500">Year &amp; Model:</span>
              <LineInput value={yearModel} onChange={setYearModel} />
            </div>
          </div>

          {/* Line items table */}
          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-rose-50 text-rose-700">
                  <th className="w-12 border-r border-slate-200 px-2 py-2 text-left font-bold">QTY</th>
                  <th className="border-r border-slate-200 px-2 py-2 text-left font-bold">PARTS NO. AND DESCRIPTION</th>
                  <th className="w-20 border-r border-slate-200 px-2 py-2 text-right font-bold">Unit Price</th>
                  <th className="w-24 border-r border-slate-200 px-2 py-2 text-right font-bold">AMOUNT</th>
                  <th className="border-r border-slate-200 px-2 py-2 text-left font-bold">DESCRIPTION OF WORK</th>
                  <th className="w-24 px-2 py-2 text-right font-bold">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: rowCount }).map((_, i) => {
                  const part = partRows[i]
                  const work = workRows[i]
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      <td className="border-r border-slate-100 px-2 py-1.5 align-top">
                        {part && <NumberInput value={part.qty} onChange={(v) => updatePart(part.id, { qty: v })} />}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 align-top">
                        {part && (
                          <div className="flex items-center gap-1">
                            <LineInput value={part.description} onChange={(v) => updatePart(part.id, { description: v })} />
                            <button onClick={() => removePartRow(part.id)} className="no-print shrink-0 text-slate-300 hover:text-rose-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 align-top">
                        {part && <NumberInput value={part.unitPrice} onChange={(v) => updatePart(part.id, { unitPrice: v })} />}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 text-right align-top font-semibold text-slate-800">
                        {part ? currency(part.qty * part.unitPrice) : ''}
                      </td>
                      <td className="border-r border-slate-100 px-2 py-1.5 align-top">
                        {work && (
                          <div className="flex items-center gap-1">
                            <LineInput value={work.description} onChange={(v) => updateWork(work.id, { description: v })} />
                            <button onClick={() => removeWorkRow(work.id)} className="no-print shrink-0 text-slate-300 hover:text-rose-500">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        {work && <NumberInput value={work.amount} onChange={(v) => updateWork(work.id, { amount: v })} />}
                      </td>
                    </tr>
                  )
                })}
                <tr className="border-t border-slate-200 font-bold text-rose-700">
                  <td colSpan={3} className="border-r border-slate-100 px-2 py-2">
                    TOTAL PARTS
                  </td>
                  <td className="border-r border-slate-100 px-2 py-2 text-right">{currency(totalParts)}</td>
                  <td className="border-r border-slate-100 px-2 py-2">TOTAL SERVICE</td>
                  <td className="px-2 py-2 text-right">{currency(totalService)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="no-print mt-2 flex gap-3">
            <button onClick={addPartRow} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
              <Plus size={12} /> Add Part Row
            </button>
            <button onClick={addWorkRow} className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline">
              <Plus size={12} /> Add Work Row
            </button>
          </div>

          {/* Totals block */}
          <div className="mt-5 ml-auto w-full max-w-xs space-y-1 rounded-lg border border-slate-200 p-4 text-sm">
            <div className="flex items-center justify-between text-base font-bold text-slate-900">
              <span>GRAND TOTAL</span>
              <span>{currency(grandTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-slate-500">
                PARTIAL PAYMENT
                <input
                  value={partialPaymentMode}
                  onChange={(e) => setPartialPaymentMode(e.target.value)}
                  className="w-14 border-b border-dotted border-slate-300 bg-transparent text-xs outline-none"
                />
              </span>
              <NumberInput value={partialPayment} onChange={setPartialPayment} className="w-24" />
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-base font-bold text-rose-600">
              <span>BALANCE</span>
              <span>{currency(balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}