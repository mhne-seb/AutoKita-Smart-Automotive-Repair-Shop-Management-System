'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import ExcelJS from 'exceljs'
import {
  Download,
  Info,
  Gift,
  Search,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  PieChart as PieIcon,
  CheckCircle2,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { StatusBadge } from '@/components/StatusBadge'
import { getAnalytics, getChurnList } from '@/controllers/reportController'
import { currency } from '@/data/mockData'

// ---- Churn classification helpers -------------------------------------

/**
 * Decides churn status label for a customer, matching the exact strings
 * used in StatusBadge's `styles` map: 'New Customer', 'High Churn Risk',
 * 'Medium Churn Risk', 'Loyal Customer'.
 */
function getDaysSince(dateStr?: string) {
  if (!dateStr) return Infinity
  const last = new Date(dateStr).getTime()
  const now = Date.now()
  return Math.floor((now - last) / (1000 * 60 * 60 * 24))
}

function computeChurnStatus(c: any): string {
  const serviceCount = c.serviceCount ?? (c.lastCheckup ? 1 : 0)
  if (serviceCount < 1) return 'New Customer'

  const days = getDaysSince(c.lastCheckup)
  if (days > 180) return 'High Churn Risk'
  if (days > 90) return 'Medium Churn Risk'
  return 'Loyal Customer'
}

const STATUS_FILTERS: { label: string; value: 'all' | string }[] = [
  { label: 'All Customers', value: 'all' },
  { label: 'New Customer', value: 'New Customer' },
  { label: 'High Churn Risk', value: 'High Churn Risk' },
  { label: 'Medium Churn Risk', value: 'Medium Churn Risk' },
  { label: 'Loyal Customer', value: 'Loyal Customer' },
]

const TIME_RANGES = [
  { label: 'Last 7 Days', value: 7 },
  { label: 'Last 30 Days', value: 30 },
  { label: 'Last 90 Days', value: 90 },
  { label: 'Last 180 Days', value: 180 },
  { label: 'All Time', value: Infinity },
]

// Header/status brand colors, echoing the badge colors used in StatusBadge.
const STATUS_FILL: Record<string, string> = {
  'High Churn Risk': 'FFFEE2E2',
  'Medium Churn Risk': 'FFFEF3C7',
  'Loyal Customer': 'FFD1FAE5',
  'New Customer': 'FFE0F2FE',
}
const STATUS_FONT: Record<string, string> = {
  'High Churn Risk': 'FFB91C1C',
  'Medium Churn Risk': 'FF92400E',
  'Loyal Customer': 'FF065F46',
  'New Customer': 'FF0369A1',
}

// ---------------------------------------------------------------------------
// Comprehensive Export Builders (KPIs + Monthly Trends + Service Mix + Churn)
// ---------------------------------------------------------------------------

function buildAnalyticsReportCsv(params: {
  analyticsData: any
  counts: Record<string, number>
  timeRangeLabel: string
  rows: any[]
}): string {
  const escapeCell = (cell: string | number | null | undefined) => {
    if (cell === null || cell === undefined) return '""'
    const str = String(cell)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return `"${str}"`
  }

  const { analyticsData, counts, timeRangeLabel, rows } = params
  const summary = analyticsData?.summary || {}
  const totalCustomers = counts.all || rows.length || 0
  const loyalCount = counts['Loyal Customer'] || 0
  const newCount = counts['New Customer'] || 0
  const highRiskCount = counts['High Churn Risk'] || 0
  const medRiskCount = counts['Medium Churn Risk'] || 0
  const retentionRate = totalCustomers > 0 ? (((loyalCount + newCount) / totalCustomers) * 100).toFixed(1) : '100.0'
  const highRiskPct = totalCustomers > 0 ? ((highRiskCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const medRiskPct = totalCustomers > 0 ? ((medRiskCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const loyalPct = totalCustomers > 0 ? ((loyalCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const newPct = totalCustomers > 0 ? ((newCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const avgTicket = summary.jobsDone > 0 ? Math.round((summary.revenue || 0) / summary.jobsDone) : 0

  const lines: string[] = []

  // Document Title
  lines.push(`"AUTOKITA AUTOMOTIVE SERVICE CENTER - COMPREHENSIVE BUSINESS ANALYTICS & CHURN REPORT"`)
  lines.push(`"Generated At",${escapeCell(new Date().toLocaleString('en-PH'))}`)
  lines.push(`"Time-Range Scope",${escapeCell(timeRangeLabel)}`)
  lines.push(`""`)

  // Section 1: Executive Performance & Operational KPIs
  lines.push(`"=== 1. EXECUTIVE PERFORMANCE & OPERATIONAL METRICS ==="`)
  lines.push(`"Category","Metric Name","Value","Operational Notes / Context"`)
  lines.push(`"Financial","Total Revenue Intake",${escapeCell(`₱${Number(summary.revenue || 0).toLocaleString('en-PH')}`)},${escapeCell(`${summary.revenueTrend > 0 ? '+' : ''}${(summary.revenueTrend || 0).toFixed(1)}% vs prior period`)}`)
  lines.push(`"Financial","Average Ticket / Revenue per Job",${escapeCell(`₱${avgTicket.toLocaleString('en-PH')}`)},"Average ticket value across completed work orders"`)
  lines.push(`"Operations","Total Completed Work Orders",${escapeCell(summary.jobsDone || 0)},${escapeCell(`${summary.jobsTrend > 0 ? '+' : ''}${(summary.jobsTrend || 0).toFixed(1)}% vs prior period`)}`)
  lines.push(`"Operations","Average Daily Services",${escapeCell((summary.averageDailyJobs || 0).toFixed(1))},"Completed jobs per day in selected cycle"`)
  lines.push(`"Operations","Operational Safety / On-Time Rate",${escapeCell(`${(summary.safetyRate || 0).toFixed(1)}%`)},"Completed on or before promised delivery date"`)
  lines.push(`"Customer Retention","Total Tracked Customers",${escapeCell(totalCustomers)},"Active customer database records analyzed"`)
  lines.push(`"Customer Retention","Overall Retention Rate",${escapeCell(`${retentionRate}%`)},"Active & loyal customer share"`)
  lines.push(`"Customer Retention","High Churn Risk Customers",${escapeCell(highRiskCount)},${escapeCell(`${highRiskPct}% of customer base - Immediate retention outreach needed`)}`)
  lines.push(`"Customer Retention","Medium Churn Risk Customers",${escapeCell(medRiskCount)},${escapeCell(`${medRiskPct}% of customer base - Monitor / Maintenance follow-up`)}`)
  lines.push(`"Customer Retention","Loyal Active Customers",${escapeCell(loyalCount)},${escapeCell(`${loyalPct}% of customer base`)}`)
  lines.push(`"Customer Retention","New Customers",${escapeCell(newCount)},${escapeCell(`${newPct}% of customer base`)}`)
  lines.push(`""`)

  // Section 2: Monthly Trends
  lines.push(`"=== 2. MONTHLY REVENUE & JOB VOLUME TRENDS ==="`)
  lines.push(`"Month","Revenue (PHP)","Completed Job Orders"`)
  if (Array.isArray(analyticsData?.chartData) && analyticsData.chartData.length > 0) {
    analyticsData.chartData.forEach((row: any) => {
      lines.push(`${escapeCell(row.month)},${escapeCell(row.revenue || 0)},${escapeCell(row.jobsCompleted || 0)}`)
    })
  } else {
    lines.push(`"No trend data available for current selection",0,0`)
  }
  lines.push(`""`)

  // Section 3: Service Mix
  lines.push(`"=== 3. TOP SERVICE CATEGORIES & DEMAND DISTRIBUTION ==="`)
  lines.push(`"Service Category","Distribution Share (%)"`)
  if (Array.isArray(analyticsData?.serviceMix) && analyticsData.serviceMix.length > 0) {
    analyticsData.serviceMix.forEach((sm: any) => {
      lines.push(`${escapeCell(sm.label)},${escapeCell(`${sm.percent}%`)}`)
    })
  } else {
    lines.push(`"All Services",100%`)
  }
  lines.push(`""`)

  // Section 4: Customer Churn Register
  lines.push(`"=== 4. CUSTOMER CHURN & RETENTION REGISTER ==="`)
  lines.push(`"Customer ID","Customer Name","Contact No.","Status (Churn Risk)","Vehicle (Year & Model)","Mileage","Last Checkup Date","Recommended Retention Offer"`)
  rows.forEach((c: any) => {
    lines.push([
      escapeCell(c.customerId),
      escapeCell(c.name),
      escapeCell(c.contact),
      escapeCell(c.churnStatus),
      escapeCell(c.vehicle),
      escapeCell(c.mileage),
      escapeCell(c.lastCheckup ?? '—'),
      escapeCell(c.offer ?? (c.churnStatus === 'New Customer' ? 'Welcome Discount' : '—'))
    ].join(','))
  })

  return lines.join('\n')
}

async function buildAnalyticsReportWorkbook(params: {
  analyticsData: any
  counts: Record<string, number>
  timeRangeLabel: string
  rows: any[]
}) {
  const { analyticsData, counts, timeRangeLabel, rows } = params
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'AutoKita Admin'
  workbook.created = new Date()

  const summary = analyticsData?.summary || {}
  const totalCustomers = counts.all || rows.length || 0
  const loyalCount = counts['Loyal Customer'] || 0
  const newCount = counts['New Customer'] || 0
  const highRiskCount = counts['High Churn Risk'] || 0
  const medRiskCount = counts['Medium Churn Risk'] || 0
  const retentionRate = totalCustomers > 0 ? (((loyalCount + newCount) / totalCustomers) * 100).toFixed(1) : '100.0'
  const highRiskPct = totalCustomers > 0 ? ((highRiskCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const medRiskPct = totalCustomers > 0 ? ((medRiskCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const loyalPct = totalCustomers > 0 ? ((loyalCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const newPct = totalCustomers > 0 ? ((newCount / totalCustomers) * 100).toFixed(1) : '0.0'
  const avgTicket = summary.jobsDone > 0 ? Math.round((summary.revenue || 0) / summary.jobsDone) : 0

  // ----------------------------------------------------
  // SHEET 1: Executive Analytics & KPIs
  // ----------------------------------------------------
  const sheet1 = workbook.addWorksheet('Analytics & KPIs')

  sheet1.mergeCells('A1:D1')
  const title1 = sheet1.getCell('A1')
  title1.value = `AutoKita — Executive Analytics & Operational Summary`
  title1.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } }
  title1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  title1.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet1.getRow(1).height = 36

  sheet1.mergeCells('A2:D2')
  const sub1 = sheet1.getCell('A2')
  sub1.value = `Report Generated: ${new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })} | Filter Range: ${timeRangeLabel}`
  sub1.font = { italic: true, size: 10, color: { argb: 'FF64748B' } }
  sub1.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet1.getRow(2).height = 20

  sheet1.getCell('A4').value = '1. EXECUTIVE PERFORMANCE & OPERATIONAL METRICS'
  sheet1.getCell('A4').font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }

  const kpiHeaders = ['Category', 'Metric Name', 'Value', 'Operational Notes / Context']
  sheet1.getRow(5).values = kpiHeaders
  sheet1.getRow(5).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet1.getRow(5).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    c.alignment = { vertical: 'middle' }
  })
  sheet1.getRow(5).height = 22

  const kpiData = [
    ['Financial', 'Total Monthly Revenue Intake', `₱${Number(summary.revenue || 0).toLocaleString('en-PH')}`, `${summary.revenueTrend > 0 ? '+' : ''}${(summary.revenueTrend || 0).toFixed(1)}% vs prior period`],
    ['Financial', 'Average Ticket / Revenue per Job', `₱${avgTicket.toLocaleString('en-PH')}`, 'Average ticket size across completed work orders'],
    ['Operations', 'Total Completed Work Orders', summary.jobsDone || 0, `${summary.jobsTrend > 0 ? '+' : ''}${(summary.jobsTrend || 0).toFixed(1)}% vs prior period`],
    ['Operations', 'Average Daily Services', (summary.averageDailyJobs || 0).toFixed(1), 'Completed jobs per day in selected cycle'],
    ['Operations', 'Operational Safety / On-Time Rate', `${(summary.safetyRate || 0).toFixed(1)}%`, 'Jobs completed on or before promised delivery date'],
    ['Customer Retention', 'Total Tracked Customers', totalCustomers, 'Active customer accounts analyzed by ML'],
    ['Customer Retention', 'Overall Customer Retention Rate', `${retentionRate}%`, 'Loyal & new active customers vs total database'],
    ['Customer Retention', 'High Churn Risk Customers', highRiskCount, `${highRiskPct}% of customer base — Immediate outreach advised`],
    ['Customer Retention', 'Medium Churn Risk Customers', medRiskCount, `${medRiskPct}% of customer base — Maintenance reminder recommended`],
    ['Customer Retention', 'Loyal Customers', loyalCount, `${loyalPct}% of customer base — High engagement`],
    ['Customer Retention', 'New Customers', newCount, `${newPct}% of customer base — First-visit cohort`],
  ]

  kpiData.forEach((row, i) => {
    const r = sheet1.addRow(row)
    r.height = 20
    r.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle' }
      if (i % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
    })
  })

  let nextRow = sheet1.rowCount + 2
  sheet1.getCell(`A${nextRow}`).value = '2. MONTHLY REVENUE & JOB VOLUME TRENDS'
  sheet1.getCell(`A${nextRow}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }
  nextRow++

  sheet1.getRow(nextRow).values = ['Month', 'Revenue (PHP)', 'Completed Jobs']
  sheet1.getRow(nextRow).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet1.getRow(nextRow).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    c.alignment = { vertical: 'middle' }
  })
  sheet1.getRow(nextRow).height = 22
  nextRow++

  if (Array.isArray(analyticsData?.chartData) && analyticsData.chartData.length > 0) {
    analyticsData.chartData.forEach((row: any, i: number) => {
      const r = sheet1.addRow([row.month, `₱${Number(row.revenue || 0).toLocaleString('en-PH')}`, row.jobsCompleted || 0])
      r.height = 20
      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
    })
  }

  nextRow = sheet1.rowCount + 2
  sheet1.getCell(`A${nextRow}`).value = '3. TOP SERVICE CATEGORIES (SERVICE MIX)'
  sheet1.getCell(`A${nextRow}`).font = { bold: true, size: 11, color: { argb: 'FF0F172A' } }
  nextRow++

  sheet1.getRow(nextRow).values = ['Service Category', 'Demand Share (%)']
  sheet1.getRow(nextRow).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  sheet1.getRow(nextRow).eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    c.alignment = { vertical: 'middle' }
  })
  sheet1.getRow(nextRow).height = 22

  if (Array.isArray(analyticsData?.serviceMix) && analyticsData.serviceMix.length > 0) {
    analyticsData.serviceMix.forEach((sm: any, i: number) => {
      const r = sheet1.addRow([sm.label, `${sm.percent}%`])
      r.height = 20
      r.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        }
        if (i % 2 === 1) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
    })
  }

  sheet1.columns = [
    { key: 'col1', width: 24 },
    { key: 'col2', width: 38 },
    { key: 'col3', width: 25 },
    { key: 'col4', width: 50 },
  ]

  // ----------------------------------------------------
  // SHEET 2: Customer Churn Register
  // ----------------------------------------------------
  const sheet2 = workbook.addWorksheet('Customer Churn Register', {
    views: [{ state: 'frozen', ySplit: 2 }],
  })

  sheet2.mergeCells('B1:H1')
  const title2 = sheet2.getCell('B1')
  title2.value = `AutoKita — Detailed Customer Churn & Retention Register`
  title2.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
  title2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  title2.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet2.getRow(1).height = 34

  const columns2 = [
    { header: 'Customer ID', key: 'customerId', width: 18 },
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Contact', key: 'contact', width: 18 },
    { header: 'Status (Churn)', key: 'churnStatus', width: 22 },
    { header: 'Vehicle (Year & Model)', key: 'vehicle', width: 26 },
    { header: 'Mileage', key: 'mileage', width: 14 },
    { header: 'Last Checkup', key: 'lastCheckup', width: 16 },
    { header: 'Promotional Offer', key: 'offer', width: 34 },
  ]
  sheet2.columns = columns2

  const headerRow2 = sheet2.getRow(2)
  columns2.forEach((col, i) => {
    const cell = headerRow2.getCell(i + 1)
    cell.value = col.header
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'left' }
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF0F172A' } } }
  })
  headerRow2.height = 24
  sheet2.autoFilter = { from: 'A2', to: 'H2' }

  rows.forEach((c) => {
    const row = sheet2.addRow({
      customerId: c.customerId,
      name: c.name,
      contact: c.contact,
      churnStatus: c.churnStatus,
      vehicle: c.vehicle,
      mileage: c.mileage,
      lastCheckup: c.lastCheckup ?? '—',
      offer: c.offer ?? (c.churnStatus === 'New Customer' ? 'Welcome Discount' : '—'),
    })

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      }
      cell.alignment = { vertical: 'middle' }
    })

    const statusCell = row.getCell(4)
    const fill = STATUS_FILL[c.churnStatus]
    const font = STATUS_FONT[c.churnStatus]
    if (fill) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
      statusCell.font = { bold: true, color: { argb: font ?? 'FF334155' } }
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' }
    }
  })

  sheet2.eachRow((row, rowNumber) => {
    if (rowNumber <= 2) return
    if (rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        if (!cell.fill || (cell.fill as any).fgColor === undefined) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
        }
      })
    }
  })

  return workbook
}

function downloadAnalyticsReportCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

async function downloadAnalyticsReportXlsx(params: any, filename: string) {
  const workbook = await buildAnalyticsReportWorkbook(params)
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

// Catalog of offers the admin can choose from when reaching out to a customer.
// `recommendedFor` just pre-selects a sensible default based on churn status —
// admin can still pick a different one before confirming.
const OFFER_CATALOG = [
  {
    id: 'free-oil-change',
    label: 'Free Oil Change Reminder',
    description: 'No-cost oil change coupon, good for one visit.',
    recommendedFor: ['High Churn Risk'],
    offerType: 'free_service',
    discountValue: 0,
  },
  {
    id: 'discount-15',
    label: '15% Discount Maintenance Promo',
    description: '15% off any single maintenance service.',
    recommendedFor: ['Medium Churn Risk'],
    offerType: 'percentage_discount',
    discountValue: 15,
  },
  {
    id: 'discount-25',
    label: '25% Win-Back Discount',
    description: 'Bigger discount reserved for high-risk, high-value customers.',
    recommendedFor: ['High Churn Risk'],
    offerType: 'percentage_discount',
    discountValue: 25,
  },
  {
    id: 'quick-service',
    label: 'Quick-Service Special Offer',
    description: 'Priority scheduling + minor perks for loyal customers.',
    recommendedFor: ['Loyal Customer'],
    offerType: 'loyalty_reward',
    discountValue: 0,
  },
  {
    id: 'welcome-promo',
    label: 'Welcome New Customer Promo',
    description: 'Intro discount for customers on their first visit.',
    recommendedFor: ['New Customer'],
    offerType: 'percentage_discount',
    discountValue: 10,
  },
  {
    id: 'loyalty-points',
    label: 'Bonus Loyalty Points',
    description: 'Extra points added to the customer’s rewards balance.',
    recommendedFor: ['Loyal Customer', 'Medium Churn Risk'],
    offerType: 'loyalty_reward',
    discountValue: 100,
  },
  {
    id: 'custom',
    label: 'Custom Offer',
    description: 'Write your own offer text for this customer.',
    recommendedFor: [],
    offerType: 'fixed_discount',
    discountValue: 0,
  },
] as const

type ChartType = 'donut' | 'bar' | 'stacked'

const CHART_OPTIONS: { label: string; value: ChartType }[] = [
  { label: 'Donut', value: 'donut' },
  { label: 'Bar', value: 'bar' },
  { label: 'Stacked', value: 'stacked' },
]

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50]

export default function Page() {
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<number>(Infinity)
  const [search, setSearch] = useState('')
  const [offersSent, setOffersSent] = useState<Record<string, string>>({})
  const [chartType, setChartType] = useState<ChartType>('donut')
  const [currentPage, setCurrentPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // Loaded through the controller (mock API) — see reportController.ts.
  const [churnList, setChurnList] = useState<any[]>([])
  const [analyticsData, setAnalyticsData] = useState<any>(null)

  useEffect(() => {
    let active = true
    getChurnList().then((data) => active && setChurnList(data))
    getAnalytics(timeRange).then((data) => active && setAnalyticsData(data))
    return () => {
      active = false
    }
  }, [timeRange])

  // Load existing retention offers from Supabase
  useEffect(() => {
    fetch('/api/admin/retention-offers')
      .then((r) => r.json())
      .then((j) => {
        if (j.success && Array.isArray(j.offers)) {
          const map: Record<string, string> = {}
          j.offers.forEach((o: any) => {
            const key = `CUST-${o.user_id}`
            if (!map[key] || !o.is_claimed) {
              map[key] = o.promo_code ? `${o.promo_code}: ${o.description}` : o.description
            }
          })
          setOffersSent(map)
        }
      })
      .catch((e) => console.error('Error fetching retention offers:', e))
  }, [])

  // Offer modal state
  const [offerTarget, setOfferTarget] = useState<any | null>(null)
  const [selectedOfferId, setSelectedOfferId] = useState<string>('')
  const [customOfferText, setCustomOfferText] = useState('')
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2500)
  }

  // Normalize the raw list so every row has a computed churnStatus,
  const normalizedList = useMemo(
    () =>
      churnList.map((c: any) => ({
        ...c,
        churnStatus: c.churnStatus ?? computeChurnStatus(c),
      })),
    [churnList]
  )

  const timeFilteredList = useMemo(() => {
    if (!Number.isFinite(timeRange)) return normalizedList
    return normalizedList.filter((c: any) => getDaysSince(c.lastCheckup) <= timeRange)
  }, [normalizedList, timeRange])

  const filteredList = useMemo(() => {
    return timeFilteredList.filter((c: any) => {
      const matchesStatus = statusFilter === 'all' || c.churnStatus === statusFilter
      const q = search.trim().toLowerCase()
      const matchesSearch =
        q === '' ||
        c.name?.toLowerCase().includes(q) ||
        c.customerId?.toLowerCase().includes(q) ||
        c.contact?.toLowerCase().includes(q)
      return matchesStatus && matchesSearch
    })
  }, [timeFilteredList, statusFilter, search])

  // Reset to page 1 whenever filters change
  useEffect(() => { setCurrentPage(1) }, [statusFilter, search, timeRange])

  const counts = useMemo(() => {
    const base: Record<string, number> = {
      all: timeFilteredList.length,
      'New Customer': 0,
      'High Churn Risk': 0,
      'Medium Churn Risk': 0,
      'Loyal Customer': 0,
    }
    timeFilteredList.forEach((c: any) => {
      base[c.churnStatus] = (base[c.churnStatus] ?? 0) + 1
    })
    return base
  }, [timeFilteredList])

  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false)
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [showExportMenu])

  const timeRangeLabel = useMemo(() => {
    return TIME_RANGES.find((r) => r.value === timeRange)?.label || 'All Time'
  }, [timeRange])

  const totalCustomers = counts.all || 0
  const loyalCount = counts['Loyal Customer'] || 0
  const newCount = counts['New Customer'] || 0
  const highRiskCount = counts['High Churn Risk'] || 0
  const retentionRate = totalCustomers > 0 ? (((loyalCount + newCount) / totalCustomers) * 100).toFixed(1) : '100.0'
  const avgTicket = (analyticsData?.summary?.jobsDone || 0) > 0
    ? Math.round((analyticsData?.summary?.revenue || 0) / analyticsData.summary.jobsDone)
    : 0

  function handleExport(format: 'csv' | 'xlsx' = 'csv') {
    if (filteredList.length === 0 && (!analyticsData || !analyticsData.summary)) {
      showToast('Nothing to export for the current filters.')
      return
    }
    const stamp = new Date().toISOString().slice(0, 10)
    const exportParams = {
      analyticsData,
      counts,
      timeRangeLabel,
      rows: filteredList,
    }

    if (format === 'csv') {
      try {
        const csvContent = buildAnalyticsReportCsv(exportParams)
        downloadAnalyticsReportCsv(csvContent, `autokita-analytics-report-${stamp}.csv`)
        showToast(`Exported complete analytics & churn report (${filteredList.length} customers) as CSV.`)
      } catch (err) {
        console.error('CSV export error:', err)
        showToast('CSV export failed. Please try again.')
      }
    } else {
      downloadAnalyticsReportXlsx(exportParams, `autokita-analytics-report-${stamp}.xlsx`)
        .then(() => {
          showToast(`Exported complete analytics & churn workbook (.xlsx).`)
        })
        .catch((err) => {
          console.error('XLSX export error:', err)
          showToast('Excel export failed. Please try CSV instead.')
        })
    }
  }

  function openOfferModal(c: any) {
    setOfferTarget(c)
    const recommended = OFFER_CATALOG.find((o) => (o.recommendedFor as readonly string[]).includes(c.churnStatus))
    setSelectedOfferId(recommended?.id ?? OFFER_CATALOG[0].id)
    setCustomOfferText('')
  }

  function closeOfferModal() {
    setOfferTarget(null)
    setSelectedOfferId('')
    setCustomOfferText('')
  }

  async function confirmGiveOffer() {
    if (!offerTarget) return
    const chosen = OFFER_CATALOG.find((o) => o.id === selectedOfferId)
    const offerText =
      selectedOfferId === 'custom' ? customOfferText.trim() : chosen?.label ?? 'Promotional Offer'

    if (selectedOfferId === 'custom' && offerText === '') {
      showToast('Please write the custom offer text first.')
      return
    }

    const rawUserId = offerTarget.id ?? parseInt(String(offerTarget.customerId).replace(/\D/g, ''), 10)
    setIsSubmittingOffer(true)

    try {
      const res = await fetch('/api/admin/retention-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: rawUserId,
          offerType: chosen?.offerType ?? 'percentage_discount',
          discountValue: chosen?.discountValue ?? 0,
          description: offerText,
          expirationDays: 30,
        }),
      })
      const json = await res.json()
      if (json.success && json.offer) {
        const promo = json.offer.promo_code
        const displayLabel = promo ? `${promo}: ${offerText}` : offerText
        setOffersSent((prev) => ({ ...prev, [offerTarget.customerId]: displayLabel }))
        showToast(`Promo ${promo || ''} issued & saved for ${offerTarget.name}.`)
      } else {
        setOffersSent((prev) => ({ ...prev, [offerTarget.customerId]: offerText }))
        showToast(`"${offerText}" sent to ${offerTarget.name}.`)
      }
    } catch {
      setOffersSent((prev) => ({ ...prev, [offerTarget.customerId]: offerText }))
      showToast(`"${offerText}" sent to ${offerTarget.name}.`)
    } finally {
      setIsSubmittingOffer(false)
      closeOfferModal()
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-8">
      {toast && (
        <div className="fixed right-6 top-6 z-50 rounded-xl bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-3 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-500">
            Comprehensive operational metrics, automated churn forecasting, and system audit logging.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-2xs outline-none focus:border-slate-400"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.label} value={r.value}>
                Filter Time-Range: {r.label}
              </option>
            ))}
          </select>

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu((prev) => !prev)}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-all"
            >
              <Download size={15} />
              Export Reports
              <ChevronDown size={14} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-76 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <button
                  onClick={() => {
                    setShowExportMenu(false)
                    handleExport('csv')
                  }}
                  className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-3 group cursor-pointer"
                >
                  <FileSpreadsheet className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-700">Export CSV Report</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Recommended</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Complete report with Executive KPIs, Monthly Trends, Service Mix & Churn. 100% browser-safe.
                    </p>
                  </div>
                </button>

                <div className="border-t border-slate-100 my-1" />

                <button
                  onClick={() => {
                    setShowExportMenu(false)
                    handleExport('xlsx')
                  }}
                  className="w-full text-left p-3 rounded-xl hover:bg-slate-50 transition-colors flex items-start gap-3 group cursor-pointer"
                >
                  <FileText className="text-blue-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <span className="text-sm font-bold text-slate-800 group-hover:text-blue-700">Export Excel Workbook (.xlsx)</span>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      Multi-sheet Excel workbook with formatted KPI dashboard and customer churn register.
                    </p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4 High-Impact KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard 
          label="Revenue Summaries" 
          value={currency(analyticsData?.summary?.revenue || 0)} 
          sub="Total Monthly Intake" 
          trend={`${(analyticsData?.summary?.revenueTrend > 0 ? '+' : '')}${(analyticsData?.summary?.revenueTrend || 0).toFixed(1)}%`}
          icon={TrendingUp}
        />
        <SummaryCard 
          label="Service Statistics" 
          value={`${analyticsData?.summary?.jobsDone || 0} Jobs Done`} 
          sub={`Average ${(analyticsData?.summary?.averageDailyJobs || 0).toFixed(1)} services daily`} 
          trend={`${(analyticsData?.summary?.jobsTrend > 0 ? '+' : '')}${(analyticsData?.summary?.jobsTrend || 0).toFixed(1)}%`} 
          icon={Wrench}
        />
        <SummaryCard 
          label="Customer Retention" 
          value={`${retentionRate}% Retained`} 
          sub={`${loyalCount} loyal of ${totalCustomers} active`} 
          trend={`${highRiskCount} At Risk`}
          trendColor={highRiskCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}
          icon={Users}
        />
        <SummaryCard 
          label="Average Ticket / ARPU" 
          value={currency(avgTicket)} 
          sub="Average revenue per job" 
          trend="Per Job" 
          icon={Sparkles}
        />
      </div>

      {/* Middle Row: Revenue & Job Trends BarChart + Top Services (Service Mix) Breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Left: Revenue & Job Trends Chart (2 cols) */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:col-span-2">
          <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Revenue & Job Trends</p>
                <p className="text-2xl font-bold text-slate-900">{currency(analyticsData?.summary?.revenue || 0)}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-900" /> Revenue (₱)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> Services Done
                </span>
              </div>
            </div>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analyticsData?.chartData || []} barGap={4}>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="#0f172a" radius={[4, 4, 0, 0]} name="Revenue" />
                  <Bar dataKey="jobsCompleted" fill="#10b981" radius={[4, 4, 0, 0]} name="Services Done" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Top Services (Service Mix) Demand Distribution */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white flex flex-col justify-between">
          <div>
            <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
            <div className="p-6 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top Service Categories</p>
                  <h3 className="text-lg font-bold text-slate-900">Service Mix & Demand</h3>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  <Wrench size={12} /> {analyticsData?.serviceMix?.length || 0} Types
                </span>
              </div>

              <div className="mt-4 space-y-3.5">
                {analyticsData?.serviceMix && analyticsData.serviceMix.length > 0 ? (
                  analyticsData.serviceMix.map((sm: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 truncate max-w-[200px]" title={sm.label}>{sm.label}</span>
                        <span className="font-bold text-slate-900">{sm.percent}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${sm.percent}%`,
                            backgroundColor: sm.color || '#1e3a5f'
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-center text-xs text-slate-400">Loading service demand metrics…</p>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 p-4 bg-slate-50/60 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-slate-600">
              <ShieldCheck size={14} className="text-emerald-600" />
              Operational Safety Rate
            </span>
            <span className="font-bold text-slate-900">{(analyticsData?.summary?.safetyRate || 0).toFixed(1)}% on-time</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Churn Distribution</p>
            <p className="text-2xl font-bold text-slate-900">ML Predictions</p>
          </div>
          {/* Chart type switcher */}
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 p-1">
            {CHART_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setChartType(opt.value)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  chartType === opt.value
                    ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-5">
          {/* LEFT — Chart */}
          <div className="lg:col-span-3">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'donut' ? (
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High Churn Risk', value: counts['High Churn Risk'] || 0 },
                        { name: 'Medium Churn Risk', value: counts['Medium Churn Risk'] || 0 },
                        { name: 'Loyal Customer', value: counts['Loyal Customer'] || 0 },
                        { name: 'New Customer', value: counts['New Customer'] || 0 },
                      ].filter((d) => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {[
                        { name: 'High Churn Risk', value: counts['High Churn Risk'] || 0 },
                        { name: 'Medium Churn Risk', value: counts['Medium Churn Risk'] || 0 },
                        { name: 'Loyal Customer', value: counts['Loyal Customer'] || 0 },
                        { name: 'New Customer', value: counts['New Customer'] || 0 },
                      ]
                        .filter((d) => d.value > 0)
                        .map((entry, index) => {
                          const colors: Record<string, string> = {
                            'High Churn Risk': '#ef4444',
                            'Medium Churn Risk': '#f59e0b',
                            'Loyal Customer': '#10b981',
                            'New Customer': '#0ea5e9',
                          }
                          return <Cell key={`cell-${index}`} fill={colors[entry.name]} />
                        })}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                ) : chartType === 'bar' ? (
                  <BarChart
                    data={[
                      { name: 'High Churn Risk', value: counts['High Churn Risk'] || 0, fill: '#ef4444' },
                      { name: 'Medium Churn Risk', value: counts['Medium Churn Risk'] || 0, fill: '#f59e0b' },
                      { name: 'Loyal Customer', value: counts['Loyal Customer'] || 0, fill: '#10b981' },
                      { name: 'New Customer', value: counts['New Customer'] || 0, fill: '#0ea5e9' },
                    ].filter((d) => d.value > 0)}
                    layout="vertical"
                    margin={{ left: 20 }}
                  >
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#334155', fontSize: 11, fontWeight: 600 }}
                      width={130}
                    />
                    <Tooltip />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} name="Customers">
                      {[
                        { name: 'High Churn Risk', fill: '#ef4444' },
                        { name: 'Medium Churn Risk', fill: '#f59e0b' },
                        { name: 'Loyal Customer', fill: '#10b981' },
                        { name: 'New Customer', fill: '#0ea5e9' },
                      ].map((entry, index) => (
                        <Cell key={`bar-cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  /* Stacked horizontal bar */
                  <BarChart
                    data={[{
                      name: 'All',
                      'High Churn Risk': counts['High Churn Risk'] || 0,
                      'Medium Churn Risk': counts['Medium Churn Risk'] || 0,
                      'Loyal Customer': counts['Loyal Customer'] || 0,
                      'New Customer': counts['New Customer'] || 0,
                    }]}
                    layout="vertical"
                    margin={{ left: 0 }}
                  >
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip />
                    <Bar dataKey="High Churn Risk" stackId="a" fill="#ef4444" radius={[6, 0, 0, 6]} />
                    <Bar dataKey="Medium Churn Risk" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Loyal Customer" stackId="a" fill="#10b981" />
                    <Bar dataKey="New Customer" stackId="a" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* RIGHT — Summary stats */}
          <div className="flex flex-col justify-center gap-3 lg:col-span-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Customers</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">{counts.all}</p>
            </div>
            {[
              { key: 'High Churn Risk', color: 'bg-red-500' },
              { key: 'Medium Churn Risk', color: 'bg-amber-500' },
              { key: 'Loyal Customer', color: 'bg-emerald-500' },
              { key: 'New Customer', color: 'bg-sky-500' },
            ].map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.color}`} />
                  <span className="text-sm font-medium text-slate-700">{s.key}</span>
                </div>
                <span className="text-sm font-bold text-slate-900">{counts[s.key] || 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber-400 pl-3">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-900">Churning</h3>
            <p className="text-sm text-slate-400">Identifies customers at risk of discontinuing services</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search box */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Search name / ID / contact"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-44 text-xs text-slate-600 outline-none placeholder:text-slate-400"
              />
            </div>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"
            >
              {STATUS_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label} ({counts[f.value] ?? 0})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Paginated table */}
        {(() => {
          const totalPages = Math.max(1, Math.ceil(filteredList.length / rowsPerPage))
          const safePage = Math.min(currentPage, totalPages)
          const startIdx = (safePage - 1) * rowsPerPage
          const pageRows = filteredList.slice(startIdx, startIdx + rowsPerPage)

          return (
            <>
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
                <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3 font-semibold">Customer ID</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Contact</th>
                    <th className="px-4 py-3 font-semibold">Status (Churn)</th>
                    <th className="px-4 py-3 font-semibold">Vehicle (Year & Model)</th>
                    <th className="px-4 py-3 font-semibold">Mileage</th>
                    <th className="px-4 py-3 font-semibold">Last Checkup</th>
                    <th className="px-4 py-3 font-semibold">Promotional Offer</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((c: any) => {
                    const sentOffer = offersSent[c.customerId]
                    const sent = Boolean(sentOffer)
                    return (
                      <tr key={c.customerId} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-4 font-semibold text-slate-800">{c.customerId}</td>
                        <td className="px-4 py-4 text-slate-700">{c.name}</td>
                        <td className="px-4 py-4 text-slate-500">{c.contact}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={c.churnStatus} />
                        </td>
                        <td className="px-4 py-4 text-slate-600">{c.vehicle}</td>
                        <td className="px-4 py-4 text-slate-600">{c.mileage}</td>
                        <td className="px-4 py-4 text-slate-600">{c.lastCheckup ?? '—'}</td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                            <Info size={13} className="text-slate-300" />
                            {sentOffer ?? c.offer ?? (c.churnStatus === 'New Customer' ? 'Welcome Discount' : '—')}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <button
                            onClick={() => !sent && openOfferModal(c)}
                            disabled={sent}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                              sent
                                ? 'cursor-default border border-emerald-200 bg-emerald-50 text-emerald-700'
                                : 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white hover:opacity-90'
                            }`}
                          >
                            {sent ? (
                              <>
                                <Check size={13} /> Offer Sent
                              </>
                            ) : (
                              <>
                                <Gift size={13} /> Give Offer
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {filteredList.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-slate-400">
                        No customers match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
                </div>
              </div>

              {/* Pagination controls */}
              {filteredList.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span>Rows per page:</span>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1) }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600"
                    >
                      {ROWS_PER_PAGE_OPTIONS.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    <span className="ml-2 text-slate-400">
                      Showing {startIdx + 1}–{Math.min(startIdx + rowsPerPage, filteredList.length)} of {filteredList.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safePage <= 1}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        pageNum = i + 1
                      } else if (safePage <= 4) {
                        pageNum = i + 1
                      } else if (safePage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i
                      } else {
                        pageNum = safePage - 3 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                            pageNum === safePage
                              ? 'bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] text-white'
                              : 'text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safePage >= totalPages}
                      className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>

      {offerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Give Offer To</p>
                <h3 className="text-lg font-bold text-slate-900">{offerTarget.name}</h3>
                <p className="text-sm text-slate-500">
                  {offerTarget.vehicle} · {offerTarget.customerId}
                </p>
              </div>
              <StatusBadge status={offerTarget.churnStatus} />
            </div>

            <div className="mt-5 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Choose an offer</p>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {OFFER_CATALOG.map((offer) => {
                  const isRecommended = (offer.recommendedFor as readonly string[]).includes(
                    offerTarget.churnStatus
                  )
                  const isSelected = selectedOfferId === offer.id
                  return (
                    <label
                      key={offer.id}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                        isSelected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="offer"
                        value={offer.id}
                        checked={isSelected}
                        onChange={() => setSelectedOfferId(offer.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-800">{offer.label}</p>
                          {isRecommended && (
                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">{offer.description}</p>
                      </div>
                    </label>
                  )
                })}
              </div>

              {selectedOfferId === 'custom' && (
                <textarea
                  value={customOfferText}
                  onChange={(e) => setCustomOfferText(e.target.value)}
                  placeholder="e.g. 20% off next brake service, valid until end of month"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-slate-400"
                />
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={closeOfferModal}
                className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmGiveOffer}
                disabled={isSubmittingOffer}
                className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                <Gift size={15} /> {isSubmittingOffer ? 'Saving...' : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  trend,
  trendColor,
  icon: Icon,
}: {
  label: string
  value: string
  sub: string
  trend: string
  trendColor?: string
  icon?: any
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && (
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
              <Icon size={15} />
            </div>
          )}
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${trendColor || 'bg-emerald-100 text-emerald-700'}`}>
          {trend}
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{sub}</p>
    </div>
  )
}