'use client'

// GenerateJobOrderModal — the printable Job Order, laid out like the shop's
// paper form (letterhead; name / date / address / date promised / phone /
// plate / year & model; parts on the left, work on the right; totals;
// partial payment; balance). Pre-filled from the database
// (/api/job-orders/[id]/document); every line stays editable so the shop
// can tidy wording or add a hand-written extra before printing.

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Printer, Trash2, X } from 'lucide-react'
import { SHOP_PROFILE } from '@/data/shopProfile'

interface Props {
  jobOrderId: string
  onClose: () => void
}

interface PartRow { id: string; qty: number; description: string; unitPrice: number }
interface WorkRow { id: string; description: string; amount: number }
interface PayRow { id: string; label: string; amount: number }

const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase() : ''

let seq = 0
const rid = (p: string) => `${p}-${++seq}`

function Line({ value, onChange, align = 'left', bold = false }: { value: string; onChange: (v: string) => void; align?: 'left' | 'right'; bold?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full min-w-0 bg-transparent px-1 py-0.5 text-[13px] text-slate-900 outline-none focus:bg-amber-50 ${align === 'right' ? 'text-right' : ''} ${bold ? 'font-semibold' : ''}`}
    />
  )
}
function Num({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="w-full min-w-0 bg-transparent px-1 py-0.5 text-right text-[13px] text-slate-900 outline-none focus:bg-amber-50"
    />
  )
}

export function GenerateJobOrderModal({ jobOrderId, onClose }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [date, setDate] = useState('')
  const [datePromised, setDatePromised] = useState('')
  const [plate, setPlate] = useState('')
  const [yearModel, setYearModel] = useState('')
  const [partRows, setPartRows] = useState<PartRow[]>([])
  const [workRows, setWorkRows] = useState<WorkRow[]>([])
  const [payRows, setPayRows] = useState<PayRow[]>([])

  useEffect(() => {
    let active = true
    fetch(`/api/job-orders/${jobOrderId}/document`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (!d.success) { setError(d.message ?? 'Could not load the job order.'); return }
        setName(d.customer.name)
        setAddress(d.customer.address)
        setPhone(d.customer.phone)
        setDate(fmtDate(d.date))
        setDatePromised(fmtDate(d.datePromised))
        setPlate(d.vehicle.plate)
        setYearModel(d.vehicle.yearModel)
        setPartRows(d.parts.map((p: Omit<PartRow, 'id'>) => ({ id: rid('p'), ...p })))
        setWorkRows(d.services.map((s: Omit<WorkRow, 'id'>) => ({ id: rid('w'), ...s })))
        setPayRows(d.payments.map((p: { amount: number; label: string }) => ({ id: rid('pay'), label: `PARTIAL PAYMENT ${p.label}`.trim(), amount: p.amount })))
      })
      .catch(() => active && setError('Could not load the job order.'))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [jobOrderId])

  const totalParts = useMemo(() => partRows.reduce((s, p) => s + p.qty * p.unitPrice, 0), [partRows])
  const totalService = useMemo(() => workRows.reduce((s, w) => s + w.amount, 0), [workRows])
  const totalPaid = useMemo(() => payRows.reduce((s, p) => s + p.amount, 0), [payRows])
  const grandTotal = totalParts + totalService
  const balance = grandTotal - totalPaid

  const patch = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>) => (id: string, p: Partial<T>) =>
    set((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)))
  const remove = <T extends { id: string }>(set: React.Dispatch<React.SetStateAction<T[]>>) => (id: string) =>
    set((prev) => prev.filter((r) => r.id !== id))
  const updatePart = patch(setPartRows), removePart = remove(setPartRows)
  const updateWork = patch(setWorkRows), removeWork = remove(setWorkRows)
  const updatePay = patch(setPayRows), removePay = remove(setPayRows)

  const rowCount = Math.max(partRows.length, workRows.length, 8) // paper form has room for a few blank lines

  const cell = 'border border-slate-400 px-1.5 py-1 align-top'
  const head = 'border border-slate-400 bg-slate-100 px-1.5 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-slate-700'

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body * { visibility: hidden; }
          .jo-sheet, .jo-sheet * { visibility: visible; }
          .jo-sheet { position: absolute; inset: 0; width: 100%; margin: 0; padding: 0; box-shadow: none !important; border: none !important; }
          .no-print { display: none !important; }
          input { border: none !important; background: transparent !important; }
        }
      `}</style>

      <div className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        {/* Toolbar */}
        <div className="no-print flex items-center justify-between border-b border-slate-200 px-6 py-3">
          <div>
            <p className="font-bold text-slate-900">Job Order · JO-{jobOrderId}</p>
            <p className="text-xs text-slate-400">Pre-filled from the quotation. Click any line to edit before printing.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} disabled={loading} className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">
              <Printer size={14} /> Print
            </button>
            <button onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><X size={16} /></button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading job order…</div>
        ) : error ? (
          <div className="p-16 text-center text-sm text-rose-600">{error}</div>
        ) : (
          <div className="overflow-y-auto bg-slate-100 p-4 sm:p-6">
            {/* The A4 sheet */}
            <div className="jo-sheet mx-auto w-full max-w-[210mm] bg-white p-8 text-slate-900 shadow-md">
              {/* Letterhead */}
              <div className="flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-3">
                <div className="flex items-center gap-3">
                  <img src={SHOP_PROFILE.logo} alt="" className="h-14 w-14 object-contain" />
                  <div className="text-[12px] leading-snug">
                    <p className="text-[14px] font-bold">{SHOP_PROFILE.name}</p>
                    <p>{SHOP_PROFILE.address}</p>
                    <p>{SHOP_PROFILE.phones.join(' / ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h1 className="text-2xl font-black tracking-tight">JOB ORDER</h1>
                  <p className="mt-0.5 inline-block rounded bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">No. JO-{jobOrderId}</p>
                </div>
              </div>

              {/* Customer / vehicle block — same fields, same order, as the paper form */}
              <div className="mt-4 grid grid-cols-2 border border-slate-400 text-[13px]">
                {[
                  ['Name', name, setName], ['Date', date, setDate],
                  ['Address', address, setAddress], ['Date Promised', datePromised, setDatePromised],
                  ['Phone', phone, setPhone], ['Plate No.', plate, setPlate],
                ].map(([label, value, set], i) => (
                  <div key={label as string} className={`flex items-center gap-2 border-slate-400 px-2 py-1 ${i % 2 === 0 ? 'border-r' : ''} ${i < 4 ? 'border-b' : ''}`}>
                    <span className="w-28 shrink-0 font-semibold text-slate-600">{label as string}:</span>
                    <Line value={value as string} onChange={set as (v: string) => void} />
                  </div>
                ))}
                <div className="col-span-2 flex items-center gap-2 border-t border-slate-400 px-2 py-1">
                  <span className="w-28 shrink-0 font-semibold text-slate-600">Year &amp; Model:</span>
                  <Line value={yearModel} onChange={setYearModel} />
                </div>
              </div>

              {/* Parts | Work */}
              <table className="mt-4 w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    <th className={`${head} w-12`}>Qty</th>
                    <th className={head}>Parts No. and Description</th>
                    <th className={`${head} w-20 text-right`}>Unit Price</th>
                    <th className={`${head} w-24 text-right`}>Amount</th>
                    <th className={head}>Description of Work</th>
                    <th className={`${head} w-24 text-right`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: rowCount }).map((_, i) => {
                    const part = partRows[i]
                    const work = workRows[i]
                    return (
                      <tr key={i}>
                        <td className={cell}>{part && <Num value={part.qty} onChange={(v) => updatePart(part.id, { qty: v })} />}</td>
                        <td className={cell}>
                          {part && (
                            <div className="flex items-center gap-1">
                              <Line value={part.description} onChange={(v) => updatePart(part.id, { description: v })} />
                              <button onClick={() => removePart(part.id)} className="no-print shrink-0 text-slate-300 hover:text-rose-500" aria-label="Remove part"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                        <td className={cell}>{part && <Num value={part.unitPrice} onChange={(v) => updatePart(part.id, { unitPrice: v })} />}</td>
                        <td className={`${cell} text-right tabular-nums`}>{part ? peso(part.qty * part.unitPrice) : ''}</td>
                        <td className={cell}>
                          {work && (
                            <div className="flex items-center gap-1">
                              <Line value={work.description} onChange={(v) => updateWork(work.id, { description: v })} />
                              <button onClick={() => removeWork(work.id)} className="no-print shrink-0 text-slate-300 hover:text-rose-500" aria-label="Remove work"><Trash2 size={12} /></button>
                            </div>
                          )}
                        </td>
                        <td className={cell}>{work && <Num value={work.amount} onChange={(v) => updateWork(work.id, { amount: v })} />}</td>
                      </tr>
                    )
                  })}
                  <tr className="font-bold">
                    <td colSpan={3} className={`${cell} bg-slate-50`}>TOTAL PARTS</td>
                    <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(totalParts)}</td>
                    <td className={`${cell} bg-slate-50`}>TOTAL SERVICE</td>
                    <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(totalService)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="no-print mt-1 flex gap-4 text-xs">
                <button onClick={() => setPartRows((p) => [...p, { id: rid('p'), qty: 1, description: '', unitPrice: 0 }])} className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline"><Plus size={12} /> Add part line</button>
                <button onClick={() => setWorkRows((w) => [...w, { id: rid('w'), description: '', amount: 0 }])} className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline"><Plus size={12} /> Add work line</button>
              </div>

              {/* Totals + signatures */}
              <div className="mt-4 flex flex-col items-start justify-between gap-6 sm:flex-row">
                <div className="text-[12px]">
                  <p className="mb-8 text-slate-500">Received the vehicle and agreed to the above:</p>
                  <div className="w-56 border-t border-slate-900 pt-1">Customer signature over printed name</div>
                  <div className="mt-8 w-56 border-t border-slate-900 pt-1">Prepared by</div>
                </div>
                <table className="w-full max-w-[320px] border-collapse text-[13px]">
                  <tbody>
                    <tr className="font-bold">
                      <td className={cell}>GRAND TOTAL</td>
                      <td className={`${cell} text-right tabular-nums`}>{peso(grandTotal)}</td>
                    </tr>
                    {payRows.map((p) => (
                      <tr key={p.id}>
                        <td className={cell}>
                          <div className="flex items-center gap-1">
                            <Line value={p.label} onChange={(v) => updatePay(p.id, { label: v })} />
                            <button onClick={() => removePay(p.id)} className="no-print shrink-0 text-slate-300 hover:text-rose-500" aria-label="Remove payment"><Trash2 size={12} /></button>
                          </div>
                        </td>
                        <td className={`${cell} text-right tabular-nums`}>
                          <div className="flex items-center justify-end">(<Num value={p.amount} onChange={(v) => updatePay(p.id, { amount: v })} />)</div>
                        </td>
                      </tr>
                    ))}
                    <tr className="text-[15px] font-black">
                      <td className={`${cell} bg-slate-50`}>BALANCE</td>
                      <td className={`${cell} bg-slate-50 text-right tabular-nums`}>{peso(balance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="no-print mt-1 flex justify-end text-xs">
                <button onClick={() => setPayRows((p) => [...p, { id: rid('pay'), label: 'PARTIAL PAYMENT', amount: 0 }])} className="flex items-center gap-1 font-semibold text-emerald-600 hover:underline"><Plus size={12} /> Add payment line</button>
              </div>

              <p className="mt-6 text-[10px] text-slate-400">Generated by AutoKita · {new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
