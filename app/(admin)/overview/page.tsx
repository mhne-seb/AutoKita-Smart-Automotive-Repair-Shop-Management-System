'use client'

// Admin dashboard "Overview" page — KPI cards, revenue/service-mix charts, and the active customers table with row actions (view/edit/mark complete/cancel).
import { useEffect, useState } from 'react'
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Wrench,
  Users,
  Wallet,
  ChevronRight,
  MoreVertical,
  Eye,
  Pencil,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { TopBar } from '@/components/TopBar'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { getJobOrders } from '@/controllers/jobOrderController'
import { JobOrderCard } from '@/data/types'
import { getRevenueTrend, getServiceMix } from '@/controllers/reportController'
import { currency, type Customer, type RevenuePoint, type ServiceMixSlice } from '@/data/mockData'
const heroImage = "/assets/ac/a1.jpg"; // static asset path

export default function page() {
  const router = useRouter()
  const [activeTableOrders, setActiveTableOrders] = useState<any[]>([])
  const [jobOrders, setJobOrders] = useState<JobOrderCard[]>([])
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([])
  const [serviceMix, setServiceMix] = useState<ServiceMixSlice[]>([])
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0)
  const [techniciansCount, setTechniciansCount] = useState<number>(0)
  const totalRevenue = revenueTrend.reduce((sum, item) => sum + item.revenue, 0)
  const activeJobOrders = jobOrders.filter(
    (jobOrder) =>
      jobOrder.stage === 'inspecting' ||
      jobOrder.stage === 'quotation' ||
      jobOrder.stage === 'in-progress'
  ).length

  useEffect(() => {
    let active = true

    // 2. Fetching dashboard table data for Active Job Orders
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && json.data) {
          // Update the table
          if (json.data.activeTable) setActiveTableOrders(json.data.activeTable)

          // Update the Pie Chart (Service Mix)
          if (json.data.serviceMix) setServiceMix(json.data.serviceMix)

          // Update the Area Chart (Revenue Trend)
          if (json.data.chartData) setRevenueTrend(json.data.chartData)
        }
      })
      .catch(console.error)

    // 3. Fetching background job order counts for the stat cards
    getJobOrders(1, 1000000).then((result) => {
      if (active) {
        setJobOrders(result.data)
      }
    })

    // 4. Fetching job queue data for pending tickets & technicians count
    fetch('/api/admin/job-queue')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && data.tickets) {
          const pendingCount = data.tickets.filter(
            (t: any) =>
              t.ticket_status !== 'approved' &&
              t.ticket_status !== 'declined' &&
              t.ticket_status !== 'cancelled'
          ).length

          setPendingTicketsCount(pendingCount)
        }

        if (data.mechanics) {
          setTechniciansCount(data.mechanics.length)
        }
      })
      .catch(console.error)

    return () => {
      active = false
    }
  }, [])


  const inProgressOrders = jobOrders.filter(
    (jobOrder) => jobOrder.stage === 'in-progress'
  ).length

  const [openRowMenu, setOpenRowMenu] = useState<string | null>(null)

  const handleRowAction = async (action: string, jobOrderId: string) => {
    setOpenRowMenu(null)

    if (action === 'View Details') {
      router.push(`/job-orders?customerId=${encodeURIComponent(jobOrderId)}`)
      return
    }
    if (action === 'Edit') {
      router.push(`/job-orders/${jobOrderId}`)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <TopBar title="Dashboard Overview" subtitle="Real-time pulse of the shop floor." showSearch={false} />

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand/85" />
        <div className="relative flex flex-col justify-between gap-6 p-8 text-brand-foreground sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-foreground/70">
              Welcome back
            </p>
            <h2 className="mt-1 text-2xl font-bold">Boss Boyet, here's today's shop floor.</h2>
            <p className="mt-1 max-w-md text-sm text-brand-foreground/80">
              {inProgressOrders} in progress and {pendingTicketsCount} {pendingTicketsCount === 1 ? 'ticket' : 'tickets'} tickets waiting for triage.
            </p>
          </div>
          <button
            onClick={() => router.push('/job-queue')}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-foreground px-4 py-2.5 text-sm font-semibold text-brand hover:opacity-90"
          >
            Go to Job Queue <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-5">
        <Link href="/job-queue" className="min-w-[220px] flex-1">
          <StatCard
            label="Pending Tickets"
            value={`${pendingTicketsCount} Pending`}
            icon={Car}
            iconBg="bg-brand/10"
            iconColor="text-brand"
            trend={{ text: '↗ +0 today' }}
          />
        </Link>
        <Link href="/job-orders" className="min-w-[220px] flex-1">
          <StatCard
            label="Active Job Orders"
            value={activeJobOrders.toString()}
            icon={Wrench}
            iconBg="bg-amber-50"
            iconColor="text-amber-600"
            trend={{ text: '⏱ On Schedule' }}
          />
        </Link>
        <Link href="/mechanics" className="min-w-[220px] flex-1">
          <StatCard
            label="Technicians"
            value={techniciansCount.toString()}
            icon={Users}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            trend={{ text: '✓ All on duty' }}
          />
        </Link>
        <Link href="/sales-payroll" className="min-w-[220px] flex-1">
          <StatCard
            label="6-Mo Revenue"
            value={currency(totalRevenue)}
            icon={Wallet}
            iconBg="bg-violet-50"
            iconColor="text-violet-600"
            trend={{ text: '↗ +18% YoY' }}
          />
        </Link>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">Revenue Trend</h3>
              <p className="text-sm text-muted-foreground">Last 6 months performance</p>
            </div>
            <button
              onClick={() => router.push('/analytics')}
              className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand hover:bg-brand/20"
            >
              ↗ Trending Up
            </button>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrend}>
                <defs>
                  <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1e3a5f" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#1e3a5f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(v) => `₱${v / 1000}k`}
                />
                <Tooltip
                  formatter={(v: number) => currency(v)}
                  cursor={{ stroke: '#1e3a5f', strokeWidth: 1, strokeDasharray: '4 4' }}
                  contentStyle={{ borderRadius: 8, borderColor: '#e2e8f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1e3a5f"
                  strokeWidth={2.5}
                  fill="url(#revFill)"
                  activeDot={{ r: 5, fill: '#1e3a5f', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="text-lg font-bold text-foreground">Service Mix</h3>
          <p className="text-sm text-muted-foreground">Share of jobs this quarter</p>
          <div className="relative mt-4 h-44">
            {serviceMix.length === 0 ? (
              <div className="flex h-full w-full flex-col items-center justify-center text-center">
                <p className="text-sm font-medium text-muted-foreground">Cannot fetch live data.</p>
                <p className="text-xs text-muted-foreground/70">No service records found.</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={serviceMix}
                      dataKey="percent"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {serviceMix.map((slice) => (
                        <Cell key={slice.label} fill={slice.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold text-foreground">100%</p>
                </div>
              </>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-y-2 text-sm">
            {serviceMix.map((slice) => (
              <div key={slice.label} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: slice.color }} />
                <span className="text-muted-foreground">{slice.label}</span>
                <span className="ml-auto font-semibold text-foreground">{slice.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active job orders table */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-foreground">Active Job Orders</h3>
          <button
            onClick={() => router.push('/job-queue')}
            className="flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
          >
            View All Queue <ChevronRight size={14} />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 font-semibold">Customer ID</th>
                <th className="py-3 font-semibold">Customer</th>
                <th className="py-3 font-semibold">Vehicle Details</th>
                <th className="py-3 font-semibold">Total Cost</th>
                <th className="py-3 font-semibold">Balance Due</th>
                <th className="py-3 font-semibold">Status</th>
                <th className="py-3 font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {activeTableOrders.map((c) => {
                const idStr = String(c.jobOrderId)
                return (
                  <tr key={idStr} className="border-b border-border/60 last:border-0">
                    <td className="py-4 font-semibold text-foreground">JO-{c.jobOrderId}</td>
                    <td className="py-4 text-foreground/90">{c.name}</td>
                    <td className="py-4 text-muted-foreground">
                      {c.vehicle} - {c.plate}
                    </td>
                    <td className="py-4 font-semibold text-foreground">{currency(Number(c.totalCost))}</td>
                    <td className="py-4 font-semibold text-destructive">
                      {Number(c.balanceDue) > 0 ? currency(Number(c.balanceDue)) : currency(0)}
                    </td>
                    <td className="py-4">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="relative py-4 text-right">
                      <button
                        aria-label="Row actions"
                        onClick={() => setOpenRowMenu(openRowMenu === idStr ? null : idStr)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical size={16} />
                      </button>

                      {openRowMenu === idStr && (
                        <div className="absolute right-0 top-10 z-10 w-44 rounded-lg border border-border bg-card p-1 text-left shadow-lg">
                          <button
                            onClick={() => handleRowAction('View Details', idStr)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <Eye size={14} /> View Details
                          </button>
                          <button
                            onClick={() => handleRowAction('Edit', idStr)}
                            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent"
                          >
                            <Pencil size={14} /> Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
