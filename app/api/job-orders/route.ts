import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signFileUrls } from '@/lib/storage'

export async function GET(request: Request) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '12', 10)
    const offset = (page - 1) * pageSize

    const countResult = await db.query(
      `SELECT COUNT(*) FROM get_job_orders_list()`
    )
    const total = parseInt(countResult.rows[0].count, 10)

    const result = await db.query(
      `
      WITH queue AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY date_arrived ASC, id ASC) AS queue_no
        FROM job_orders
        WHERE date_arrived IS NOT NULL
          AND status::text IN (
          'inspecting', 'pending_customer_approval', 'revision_pending',
          'in_progress', 'waiting_on_parts', 'testing'
        )
      )
      SELECT
        gol.id,
        jo.date_arrived,
        gol.status,
        gol.actual_grand_total,
        jo.balance,
        jo.user_id,
        u.avatar_url,
        gol.first_name,
        gol.last_name,
        gol.vehicle_model,
        v.vehicle_year,
        gol.plate_number,
        STRING_AGG(DISTINCT s.service_name, ', ') AS service_names,
        gol.mechanic_name,
        gol.assigned_mechanic_id,
        st.service_mode::text AS service_mode,
        st.customer_concern,
        q.queue_no
      FROM get_job_orders_list() gol
      JOIN job_orders jo ON jo.id = gol.id
      LEFT JOIN queue q ON q.id = gol.id
      LEFT JOIN service_tickets st ON st.id = jo.ticket_id
      LEFT JOIN users u ON u.id = jo.user_id
      LEFT JOIN vehicles v ON v.id = jo.vehicle_id
      LEFT JOIN job_order_services jos ON jos.job_order_id = gol.id
      LEFT JOIN services s ON s.id = jos.service_id
      GROUP BY gol.id, jo.date_arrived, gol.status, gol.actual_grand_total, jo.balance,
               jo.user_id, u.avatar_url, gol.first_name, gol.last_name, gol.vehicle_model,
               v.vehicle_year, gol.plate_number, gol.mechanic_name, gol.assigned_mechanic_id, st.service_mode, st.customer_concern,
               q.queue_no
      ORDER BY (q.queue_no IS NULL), q.queue_no ASC, gol.id DESC
      LIMIT $1 OFFSET $2
      `,
      [pageSize, offset]
    )

    const avatars = result.rows.map((r: any) => r.avatar_url)
    const signedAvatars = await signFileUrls(avatars)
    for (let i = 0; i < result.rows.length; i++) {
      result.rows[i].avatar_url = signedAvatars[i]
    }

    return NextResponse.json({
      success: true,
      data: result.rows,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('Job orders fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}