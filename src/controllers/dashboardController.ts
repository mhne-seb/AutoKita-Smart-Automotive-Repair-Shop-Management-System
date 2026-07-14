// dashboardController.ts
// Fetches all data the Customer Dashboard needs from PostgreSQL.
// Used by the /api/dashboard API route.

import { db } from '@/lib/db'

export interface DashboardUser {
  id: number
  first_name: string
  last_name: string
  email: string
  contact_number: string
  address: string
}

export interface DashboardVehicle {
  id: number
  vehicle_model: string
  vehicle_year: number
  plate_number: string
  vehicle_type: string
}

export interface DashboardJobOrder {
  id: number
  status: string
  grand_total: string
  balance: string
  jo_date: string
  vehicle_model: string
  vehicle_year: number
  plate_number: string
  service_name: string | null
}

export interface DashboardActivity {
  id: number
  type: 'payment' | 'progress_log' | 'status_change'
  title: string
  description: string
  time: string
  job_order_id: number
}

export interface DashboardShop {
  id: number
  name: string
  address: string
  contact_number: string
  email: string
  operating_hours: Record<string, string>
}

export interface DashboardData {
  user: DashboardUser | null
  vehicles: DashboardVehicle[]
  activeJobOrders: DashboardJobOrder[]
  recentActivity: DashboardActivity[]
  shop: DashboardShop | null
}



export async function getDashboardUser(userId: number): Promise<DashboardUser | null> {
  const { rows } = await db.query(
    `SELECT * FROM get_dashboard_user($1)`,
    [userId],
  )
  return rows[0] ?? null
}

export async function getDashboardVehicles(userId: number): Promise<DashboardVehicle[]> {
  const { rows } = await db.query(
    `SELECT * FROM get_dashboard_vehicles($1)`,
    [userId],
  )
  return rows
}

export async function getDashboardActiveJobOrders(userId: number): Promise<DashboardJobOrder[]> {
  const { rows } = await db.query(
    `SELECT * FROM get_dashboard_active_job_orders($1)`,
    [userId],
  )
  return rows
}

export async function getDashboardRecentActivity(userId: number): Promise<DashboardActivity[]> {
  const { rows } = await db.query(
    `SELECT * FROM get_dashboard_recent_activity($1)`,
    [userId],
  )
  return rows
}

export async function getDashboardShop(): Promise<DashboardShop | null> {
  const { rows } = await db.query(
    `SELECT * FROM get_dashboard_shop()`,
  )
  return rows[0] ?? null
}


export async function getFullDashboardData(userId: number): Promise<DashboardData> {
  const [user, vehicles, activeJobOrders, recentActivity, shop] = await Promise.all([
    getDashboardUser(userId),
    getDashboardVehicles(userId),
    getDashboardActiveJobOrders(userId),
    getDashboardRecentActivity(userId),
    getDashboardShop(),
  ])

  return { user, vehicles, activeJobOrders, recentActivity, shop }
}
