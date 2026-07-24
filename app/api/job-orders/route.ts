import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const pageSize = parseInt(searchParams.get('pageSize') || '12', 10)
    const offset = (page - 1) * pageSize

    const countResult = await db.query(
      `SELECT COUNT(*) FROM "Capstone-Testing".get_job_orders_list()`
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
        gol.grand_total,
        jo.balance,
        jo.user_id,
        gol.first_name,
        gol.last_name,
        gol.vehicle_model,
        v.vehicle_year,
        gol.plate_number,
        STRING_AGG(DISTINCT s.service_name, ', ') AS service_names
      FROM "Capstone-Testing".get_job_orders_list() gol
      JOIN "Capstone-Testing".job_orders jo ON jo.id = gol.id
      LEFT JOIN "Capstone-Testing".vehicles v ON v.id = jo.vehicle_id
      LEFT JOIN "Capstone-Testing".job_order_services jos ON jos.job_order_id = gol.id
      LEFT JOIN "Capstone-Testing".services s ON s.id = jos.service_id
      GROUP BY gol.id, jo.date_arrived, gol.status, gol.grand_total, jo.balance,
               jo.user_id, gol.first_name, gol.last_name, gol.vehicle_model,
               v.vehicle_year, gol.plate_number
      ORDER BY gol.id
      LIMIT $1 OFFSET $2
      `,
      [pageSize, offset]
    )

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
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}