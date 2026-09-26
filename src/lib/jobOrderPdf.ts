// jobOrderPdf.ts — the Job Order as a PDF, laid out like the shop's paper
// form. Browser-side (jsPDF). Used by the customer's Download button and the
// admin's Generate Job Order modal, so both produce the same document.
//
// Data comes from /api/job-orders/[id]/document; the admin modal may pass
// its edited rows instead.

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { SHOP_PROFILE } from '@/data/shopProfile'

export interface JobOrderPdfData {
  jobOrderId: number | string
  date: string | null
  datePromised: string | null
  releasedAt: string | null
  customer: { name: string; phone: string; address: string }
  vehicle: { yearModel: string; plate: string }
  parts: { qty: number; description: string; unitPrice: number }[]
  warranties: { description: string; expiresAt: string }[]
  services: { description: string; amount: number }[]
  payments: { label: string; amount: number }[]
}

const peso = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const upperDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase() : ''

function loadImage(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      c.getContext('2d')!.drawImage(img, 0, 0)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = reject
    img.src = src
  })
}

/** Fetches the document data for a job order (same source as the admin form). */
export async function fetchJobOrderPdfData(jobOrderId: number | string): Promise<JobOrderPdfData | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/document`, { cache: 'no-store' })
  const d = await res.json().catch(() => null)
  if (!res.ok || !d?.success) return null
  return {
    jobOrderId: d.jobOrderId,
    date: d.date,
    datePromised: d.datePromised,
    releasedAt: d.releasedAt,
    customer: d.customer,
    vehicle: d.vehicle,
    parts: d.parts,
    warranties: d.warranties,
    services: d.services,
    payments: d.payments.map((p: { amount: number; label: string }) => ({ label: `PARTIAL PAYMENT ${p.label}`.trim(), amount: p.amount })),
  }
}

export async function generateJobOrderPdf(data: JobOrderPdfData): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 40
  let y = 44

  // ---- Letterhead
  try {
    const logo = await loadImage(SHOP_PROFILE.logo)
    doc.addImage(logo, 'PNG', M, y - 6, 42, 42)
  } catch { /* no logo, no problem */ }
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20)
  doc.text(SHOP_PROFILE.name, M + 50, y + 6)
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(60)
  doc.text(SHOP_PROFILE.address, M + 50, y + 19)
  doc.text(SHOP_PROFILE.phones.join(' / '), M + 50, y + 31)

  doc.setFont('helvetica', 'bold').setFontSize(22).setTextColor(20)
  doc.text('JOB ORDER', W - M, y + 8, { align: 'right' })
  doc.setFontSize(9).setTextColor(255)
  const tag = `No. JO-${data.jobOrderId}`
  const tw = doc.getTextWidth(tag) + 12
  doc.setFillColor(15, 23, 42).roundedRect(W - M - tw, y + 16, tw, 15, 3, 3, 'F')
  doc.text(tag, W - M - 6, y + 27, { align: 'right' })

  y += 46
  doc.setDrawColor(15, 23, 42).setLineWidth(1.5).line(M, y, W - M, y)
  y += 14

  // ---- Customer / vehicle block (same six fields, same order as the paper).
  // Four real columns — bold label, value — so nothing is overdrawn.
  const half = (W - 2 * M) / 2
  const labelW = 78
  const L = (t: string) => ({ content: t, styles: { fontStyle: 'bold' as const, textColor: 60 as const } })
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: { top: 5, bottom: 5, left: 5, right: 4 }, lineColor: [120, 120, 120], lineWidth: 0.6, textColor: 20, overflow: 'linebreak' },
    body: [
      [L('Name:'), data.customer.name, L('Date:'), upperDate(data.date)],
      [L('Address:'), data.customer.address, L('Date Promised:'), upperDate(data.datePromised)],
      [L('Phone:'), data.customer.phone, L('Plate No.:'), data.vehicle.plate],
      [L('Year & Model:'), { content: data.vehicle.yearModel, colSpan: 3 }],
    ],
    columnStyles: {
      0: { cellWidth: labelW },
      1: { cellWidth: half - labelW },
      2: { cellWidth: labelW },
      3: { cellWidth: half - labelW },
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 14

  // ---- Parts (left) | Work (right), padded to the same row count
  const rows = Math.max(data.parts.length, data.services.length, 8)
  const body: (string | number)[][] = []
  for (let i = 0; i < rows; i++) {
    const p = data.parts[i]
    const s = data.services[i]
    body.push([
      p ? String(p.qty) : '', p ? p.description : '', p ? peso(p.unitPrice) : '', p ? peso(p.qty * p.unitPrice) : '',
      s ? s.description : '', s ? peso(s.amount) : '',
    ])
  }
  const totalParts = data.parts.reduce((t, p) => t + p.qty * p.unitPrice, 0)
  const totalService = data.services.reduce((t, s) => t + s.amount, 0)
  body.push(['', 'TOTAL PARTS', '', peso(totalParts), 'TOTAL SERVICE', peso(totalService)])

  const inner = W - 2 * M
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: 'grid',
    head: [['QTY', 'PARTS NO. AND DESCRIPTION', 'UNIT PRICE', 'AMOUNT', 'DESCRIPTION OF WORK', 'AMOUNT']],
    body,
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [120, 120, 120], lineWidth: 0.6, textColor: 20, minCellHeight: 17 },
    headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: inner * 0.07, halign: 'center' },
      1: { cellWidth: inner * 0.30 },
      2: { cellWidth: inner * 0.10, halign: 'right' },
      3: { cellWidth: inner * 0.12, halign: 'right' },
      4: { cellWidth: inner * 0.29 },
      5: { cellWidth: inner * 0.12, halign: 'right' },
    },
    didParseCell: (h) => {
      if (h.section === 'body' && h.row.index === body.length - 1) {
        h.cell.styles.fontStyle = 'bold'
        h.cell.styles.fillColor = [248, 250, 252]
      }
    },
  })
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16

  // ---- Warranty coverage — one row per part, from the warranties table
  // (set once, at release; nothing there yet just means not released).
  if (data.warranties.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: 'grid',
      head: [['WARRANTY COVERAGE', 'COVERED UNTIL']],
      body: data.warranties.map((w) => [w.description, upperDate(w.expiresAt)]),
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, lineColor: [120, 120, 120], lineWidth: 0.6, textColor: 20 },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold', fontSize: 7.5 },
      columnStyles: { 1: { halign: 'right' } },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16
  } else if (!data.releasedAt) {
    doc.setFont('helvetica', 'italic').setFontSize(8.5).setTextColor(120)
    doc.text('Warranty coverage will be added once the vehicle is released.', M, y)
    y += 20
  }

  // ---- Totals (right) + signatures (left)
  const grand = totalParts + totalService
  const paid = data.payments.reduce((t, p) => t + p.amount, 0)
  const totals: (string | number)[][] = [
    ['GRAND TOTAL', peso(grand)],
    ...data.payments.map((p) => [p.label, `(${peso(p.amount)})`]),
    ['BALANCE', peso(grand - paid)],
  ]
  const boxW = 230
  autoTable(doc, {
    startY: y,
    margin: { left: W - M - boxW, right: M },
    tableWidth: boxW,
    theme: 'grid',
    body: totals,
    styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 5, lineColor: [120, 120, 120], lineWidth: 0.6, textColor: 20 },
    columnStyles: { 0: { cellWidth: boxW * 0.6 }, 1: { cellWidth: boxW * 0.4, halign: 'right' } },
    didParseCell: (h) => {
      const last = h.row.index === totals.length - 1
      if (h.row.index === 0 || last) h.cell.styles.fontStyle = 'bold'
      if (last) { h.cell.styles.fontSize = 11; h.cell.styles.fillColor = [248, 250, 252] }
    },
  })
  const totalsBottom = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(90)
  doc.text('Received the vehicle and agreed to the above:', M, y + 10)
  const sigY = y + 48
  doc.setDrawColor(20).setLineWidth(0.8).line(M, sigY, M + 190, sigY)
  doc.setTextColor(20).text('Customer signature over printed name', M, sigY + 11)
  doc.line(M, sigY + 44, M + 190, sigY + 44)
  doc.text('Prepared by', M, sigY + 55)

  const footY = Math.max(totalsBottom, sigY + 55) + 28
  doc.setFontSize(7.5).setTextColor(150)
  doc.text(`Generated by AutoKita · ${new Date().toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`, M, footY)

  doc.save(`JobOrder_JO-${data.jobOrderId}.pdf`)
}
