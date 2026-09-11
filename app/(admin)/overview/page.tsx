'use client'

// Admin dashboard "Overview" page — KPI cards, revenue/service-mix charts, and a
// live Job Queue preview (bookings waiting for approval).
import { useEffect, useState } from 'react'
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Car,
  Users,
  Wallet,
  ChevronRight,
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
import { currency, type RevenuePoint, type ServiceMixSlice } from '@/data/mockData'
const heroImage = "/assets/ac/a1.jpg"; // static asset path

type PendingBooking = {
  ticketId: number
  name: string
  vehicle: string
  plate: string
  serviceMode: string
  concern: string
  date: string
}

export default function page() {
  const router = useRouter()
  const [jobOrders, setJobOrders] = useState<JobOrderCard[]>([])
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([])
  const [serviceMix, setServiceMix] = useState<ServiceMixSlice[]>([])
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0)
  const [techniciansCount, setTechniciansCount] = useState<number>(0)
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([])
  const totalRevenue = revenueTrend.reduce((sum, item) => sum + item.revenue, 0)

  useEffect(() => {
    let active = true

    // 2. Fetching chart data (revenue trend + service mix)
    fetch('/api/analytics')
      .then((res) => res.json())
      .then((json) => {
        if (active && json.success && json.data) {
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

    // 4. Fetching job queue data — pending tickets count, technicians count,
    //    and a live preview of the bookings still waiting for approval.
    fetch('/api/admin/job-queue')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && data.tickets) {
          const pending = data.tickets.filter(
            (t: any) =>
              t.ticket_status !== 'approved' &&
              t.ticket_status !== 'declined' &&
              t.ticket_status !== 'cancelled'
          )

          setPendingTicketsCount(pending.length)

          setPendingBookings(
            pending.slice(0, 6).map((t: any) => ({
              ticketId: t.ticket_id,
              name: `${t.first_name} ${t.last_name}`,
              vehicle: `${t.vehicle_model} ${t.vehicle_year}`,
              plate: t.plate_number,
              serviceMode: t.service_mode === 'walk_in' ? 'Shop Visit' : 'Home Service',
              concern: t.customer_concern || 'N/A',
              date: new Date(t.request_date).toLocaleDateString(),
            }))
          )
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

  return (
    <div className="space-y-6 p-8">
      <TopBar title="Dashboard Overview" subtitle="Real-time pulse of the shop floor." showSearch={false} />

      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-2xl">
        <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] opacity-90" />
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
        </div>
      </div>

      {/* Stat cards */}
      <div className="flex flex-wrap gap-5">
        <Link href="/job-queue" className="min-w-[220px] flex-1">
          <StatCard
            label="Pending Tickets"
            value={`${pendingTicketsCount} Pending`}
            icon={Car}
            iconBg="bg-gradient-to-br from-brand/20 to-brand/5"
            iconColor="text-brand"
            trend={{ text: '↗ +0 today' }}
          />
        </Link>
        <Link href="/mechanics" className="min-w-[220px] flex-1">
          <StatCard
            label="Technicians"
            value={techniciansCount.toString()}
            icon={Users}
            iconBg="bg-gradient-to-br from-emerald-100 to-emerald-50"
            iconColor="text-emerald-600"
            trend={{ text: '✓ All on duty' }}
          />
        </Link>
        <Link href="/sales-payroll" className="min-w-[220px] flex-1">
          <StatCard
            label="6-Mo Revenue"
            value={currency(totalRevenue)}
            icon={Wallet}
            iconBg="bg-gradient-to-br from-violet-100 to-violet-50"
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
              className="rounded-full bg-gradient-to-r from-brand/20 to-brand/5 px-3 py-1 text-xs font-semibold text-brand transition-colors hover:from-brand/30 hover:to-brand/10"
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

      {/* Job Queue (Live) — bookings still waiting for approval */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-foreground">Job Queue</h3>
            <p className="text-sm text-muted-foreground">Newest bookings waiting for approval</p>
          </div>
          <button
            onClick={() => router.push('/job-queue')}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4] px-4 py-2 text-sm font-semibold text-brand-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            View All Queue <ChevronRight size={14} />
          </button>
        </div>

        <div className="relative mt-4 overflow-hidden rounded-xl border border-border">
          <div className="h-1 bg-gradient-to-r from-[#0b1730] via-[#1d3a68] to-[#3b6cb4]" />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Vehicle</th>
                  <th className="px-4 py-3 font-semibold">Service Mode</th>
                  <th className="px-4 py-3 font-semibold">Concern</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendingBookings.map((b) => (
                  <tr key={b.ticketId} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-4 font-semibold text-foreground">{b.name}</td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {b.vehicle} - {b.plate}
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{b.serviceMode}</td>
                    <td className="px-4 py-4 text-muted-foreground">{b.concern}</td>
                    <td className="px-4 py-4 text-muted-foreground">{b.date}</td>
                    <td className="px-4 py-4">
                      <StatusBadge status="Pending" />
                    </td>
                  </tr>
                ))}
                {pendingBookings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No bookings waiting for approval right now.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}