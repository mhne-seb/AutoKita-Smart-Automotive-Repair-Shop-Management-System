// dashboardController.ts
// Fetches all data the Customer Dashboard needs from PostgreSQL.
// Used by the /api/dashboard API route.

import { db } from '@/lib/db'

export interface DashboardUser {
  id: number
  nickname: string
  first_name: string | null
  last_name: string | null
  email: string
  contact_number: string
  address: string | null
  loyalty_points: number | null
  tier: string | null
}

export interface DashboardVehicle {
  id: number
  vehicle_model: string
  vehicle_year: number
  plate_number: string
  vehicle_type: string
  mileage: number | null
}

export interface DashboardJobOrder {
  id: number
  status: string
  actual_grand_total: string
  balance: string
  jo_date: string
  vehicle_model: string
  vehicle_year: number
  plate_number: string
  service_name: string | null
}

export interface DashboardActivity {
  id: number
  type: 'payment' | 'progress_log' | 'status_change' | 'booking_accepted' | 'report_ready'
  title: string
  description: string
  time: string
  job_order_id: number
}

// Customer-facing names for job_orders_status values. The stored activity
// function echoes the raw enum ("pending_customer_approval") into its text;
// this is what we swap it for before it reaches the screen.
const STATUS_LABEL: Record<string, string> = {
  inspecting: 'Under Inspection',
  pending_customer_approval: 'Awaiting Your Approval',
  in_progress: 'In Progress',
  waiting_on_parts: 'Waiting on Parts',
  revision_pending: 'Revision Pending',
  completed: 'Completed',
  released: 'Released',
  cancelled: 'Cancelled',
}

function humanizeStatusChange(description: string): string {
  // Enum values are lowercase + underscores; matching only those keeps the
  // trailing period out of the captured value.
  return description.replace(
    /status changed from ([a-z_]+) to ([a-z_]+)\.?/,
    (_m, from: string, to: string) =>
      `moved from ${STATUS_LABEL[from] ?? from} to ${STATUS_LABEL[to] ?? to}.`,
  )
}

export interface DashboardPendingTicket {
  id: number
  ticket_status: string
  service_mode: string
  concern: string | null
  request_date: string
  vehicle_model: string
  vehicle_year: number
  plate_number: string
}

export interface DashboardShop {
  id: number
  name: string
  address: string
  contact_number: string
  email: string
  operating_hours: Record<string, string> | null
}

export interface DashboardData {
  user: DashboardUser | null
  vehicles: DashboardVehicle[]
  activeJobOrders: DashboardJobOrder[]
  pendingTickets: DashboardPendingTicket[]
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
 const base = await db.query(
    `SELECT * FROM get_dashboard_recent_activity($1)`,
    [userId],
  )

  // 2. "Booking accepted" events. When an admin approves a ticket,
  //    create_job_order_from_ticket() logs it as action_performed = 'created'
  //    on job_orders — which the function above doesn't surface, so the
  //    customer never hears their booking went through. Inline query, no new
  //    stored function.
  const accepted = await db.query(
    `SELECT
        sal.id,
        'booking_accepted'::text AS type,
        'Booking Accepted'::text AS title,
        ('Your booking has been accepted. Job Order #JO-' || sal.entity_id
            || ' is now scheduled for inspection.')::text AS description,
        sal.action_date AS job_time,
        sal.entity_id AS job_order_id
     FROM system_audit_logs sal
     WHERE sal.entity_type = 'job_orders'
       AND sal.action_performed = 'created'
       AND sal.entity_id IN (SELECT jo.id FROM job_orders jo WHERE jo.user_id = $1)
     ORDER BY sal.action_date DESC
     LIMIT 10`,
    [userId],
  )

  // 3. "Your report is ready" — fires when the mechanic sends a round for
  //    approval. Nothing else surfaces this to the customer, and it's the one
  //    event that actually needs them to do something.
  //    A second round on the same job order is a revision (the customer had a
  //    concern), so say so instead of repeating the first message verbatim.
  const reportReady = await db.query(
    `SELECT
        r.id,
        'report_ready'::text AS type,
        CASE WHEN r.round_no = 1 THEN 'Inspection Report Ready' ELSE 'Revised Report Ready' END::text AS title,
        CASE WHEN r.round_no = 1
             THEN 'Your inspection report for Job Order #JO-' || r.job_order_id
                  || ' is ready. Please review it and let us know if we can proceed.'
             ELSE 'We''ve revised the inspection report for Job Order #JO-' || r.job_order_id
                  || ' based on your concern. Please take another look.'
        END::text AS description,
        r.datetime_created AS job_time,
        r.job_order_id
     FROM (
        SELECT pd.id, pd.job_order_id, pd.datetime_created,
               ROW_NUMBER() OVER (PARTITION BY pd.job_order_id ORDER BY pd.datetime_created) AS round_no
        FROM pre_diagnostics pd
        WHERE pd.job_order_id IN (SELECT jo.id FROM job_orders jo WHERE jo.user_id = $1)
     ) r
     ORDER BY r.datetime_created DESC
     LIMIT 10`,
    [userId],
  )

  type RawActivityRow = {
    id: number
    type: DashboardActivity['type']
    title: string
    description: string
    time?: string
    job_time?: string
    job_order_id: number
  }

  return ([...base.rows, ...accepted.rows, ...reportReady.rows] as RawActivityRow[])
    .map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      description: r.type === 'status_change' ? humanizeStatusChange(r.description) : r.description,
      time: r.time ?? r.job_time ?? '',
      job_order_id: r.job_order_id,
    }))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 10)
}

// Bookings the customer submitted that the shop hasn't turned into a job order
// yet — invisible on the dashboard until an admin accepts the ticket. Inline
// query (no stored function) against existing tables.
export async function getDashboardPendingTickets(userId: number): Promise<DashboardPendingTicket[]> {
  const { rows } = await db.query(
    `SELECT
        st.id,
        st.ticket_status::text  AS ticket_status,
        st.service_mode::text   AS service_mode,
        st.customer_concern     AS concern,
        st.request_date::text   AS request_date,
        v.vehicle_model,
        v.vehicle_year,
        v.plate_number
     FROM service_tickets st
     JOIN vehicles v ON v.id = st.vehicle_id
     WHERE st.user_id = $1
       AND st.ticket_status IN ('pending', 'queued', 'inspection_scheduled')
       AND NOT EXISTS (SELECT 1 FROM job_orders jo WHERE jo.ticket_id = st.id)
     ORDER BY st.request_date DESC
     LIMIT 6`,
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
  const [user, vehicles, activeJobOrders, pendingTickets, recentActivity, shop] = await Promise.all([
    getDashboardUser(userId),
    getDashboardVehicles(userId),
    getDashboardActiveJobOrders(userId),
    getDashboardPendingTickets(userId),
    getDashboardRecentActivity(userId),
    getDashboardShop(),
  ])

  return { user, vehicles, activeJobOrders, pendingTickets, recentActivity, shop }
}
