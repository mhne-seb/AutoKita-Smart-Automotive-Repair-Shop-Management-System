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

    // get_job_orders_list() is treated like a table here (Postgres allows
    // functions that RETURN TABLE to be queried, joined, and paginated just
    // like a real table). We join back to job_orders/vehicles/services only
    // for the few fields her function doesn't return yet (date_arrived,
    // balance, user_id, service names).
    const result = await db.query(
      `
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
        gol.assigned_mechanic_id
      FROM get_job_orders_list() gol
      JOIN job_orders jo ON jo.id = gol.id
      LEFT JOIN users u ON u.id = jo.user_id
      LEFT JOIN vehicles v ON v.id = jo.vehicle_id
      LEFT JOIN job_order_services jos ON jos.job_order_id = gol.id
      LEFT JOIN services s ON s.id = jos.service_id
      GROUP BY gol.id, jo.date_arrived, gol.status, gol.actual_grand_total, jo.balance,
               jo.user_id, u.avatar_url, gol.first_name, gol.last_name, gol.vehicle_model,
               v.vehicle_year, gol.plate_number, gol.mechanic_name, gol.assigned_mechanic_id
      ORDER BY gol.id DESC
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