import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')

  if (!userIdParam) {
    return NextResponse.json({ error: 'Missing required query parameter: userId' }, { status: 400 })
  }
  const userId = parseInt(userIdParam, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
  }

  try {
    let jobOrder
    if (jobOrderIdParam) {
      const jobOrderId = parseInt(jobOrderIdParam, 10)
      if (isNaN(jobOrderId)) {
        return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })
      }
      const { rows } = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
      jobOrder = rows[0] ?? null
      if (jobOrder && jobOrder.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { rows } = await db.query(`SELECT * FROM get_customer_active_job_order($1)`, [userId])
      jobOrder = rows[0] ?? null
    }

    if (!jobOrder) {
      return NextResponse.json({ jobOrder: null, services: [], history: [], customerConcern: null })
    }

    const [servicesRes, ticketRes, vehicleRes, walkaroundRes] = await Promise.all([
      db.query(`SELECT * FROM get_job_order_quotation_services($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT * FROM get_job_order_ticket_notes($1)`, [jobOrder.job_order_id]),
      db.query(`SELECT vehicle_id FROM job_orders WHERE id = $1`, [jobOrder.job_order_id]),
      // The mechanic's walkaround shots are the proof of the vehicle's
      // condition on arrival — same rows the Inspecting page shows.
      db.query(
        `SELECT id, name AS label, notes AS note, photo, logged_date::text
         FROM vehicle_inspections
         WHERE job_order_id = $1 AND status = 'reference-photo' AND photo IS NOT NULL
         ORDER BY id`,
        [jobOrder.job_order_id],
      ),
    ])

    const vehicleId = vehicleRes.rows[0]?.vehicle_id ?? null
    const history = vehicleId
      ? (await db.query(`SELECT * FROM get_vehicle_service_history($1, $2)`, [vehicleId, jobOrder.job_order_id])).rows
      : []

    return NextResponse.json({
      jobOrder,
      services: servicesRes.rows,
      history,
      customerConcern: ticketRes.rows[0]?.customer_concern ?? null,
      walkaround: walkaroundRes.rows,
    })
  } catch (err) {
    console.error('[/api/tracking/received] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}