import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const detailResult = await db.query(
      `SELECT * FROM get_job_order_detail($1)`,
      [id]
    )

    if (detailResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    // Service names aren't part of get_job_order_detail(), so we pull them
    // separately from get_job_order_services() and combine into one payload.
    const servicesResult = await db.query(
      `SELECT service_name FROM get_job_order_services($1)`,
      [id]
    )
    const serviceNames = servicesResult.rows.map((r) => r.service_name).join(', ')

    const row = detailResult.rows[0]
    const mechanicName = row.mechanic_name || 'Unassigned'

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        service_names: serviceNames,
        mechanic_name: mechanicName,
        mechanic: mechanicName,
      },
    })
  } catch (error) {
    console.error('Job order fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { mechanicId, mechanicName } = body

    let resolvedMechanicId = mechanicId
    if (!resolvedMechanicId && mechanicName) {
      const empRes = await db.query(
        `SELECT id FROM employees WHERE full_name ILIKE $1 AND role = 'mechanic' LIMIT 1`,
        [mechanicName.trim()]
      )
      if (empRes.rows.length > 0) {
        resolvedMechanicId = empRes.rows[0].id
      }
    }

    if (resolvedMechanicId) {
      await db.query(`SELECT assign_mechanic_to_job_order($1, $2)`, [id, resolvedMechanicId])
    }

    const detailResult = await db.query(
      `SELECT * FROM get_job_order_detail($1)`,
      [id]
    )

    if (detailResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    const servicesResult = await db.query(
      `SELECT service_name FROM get_job_order_services($1)`,
      [id]
    )
    const serviceNames = servicesResult.rows.map((r) => r.service_name).join(', ')
    const row = detailResult.rows[0]

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        service_names: serviceNames,
        mechanic_name: row.mechanic_name || 'Unassigned',
        mechanic: row.mechanic_name || 'Unassigned',
      },
    })
  } catch (error) {
    console.error('Job order PATCH error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}