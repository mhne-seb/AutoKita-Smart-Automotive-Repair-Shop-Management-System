import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Extra facts the detail panel needs and get_job_order_detail() does not return.
async function loadExtras(jobOrderId: string) {
  const res = await db.query(
    `SELECT
       st.service_mode::text AS service_mode,
       st.home_service_address,
       st.customer_concern,
       (st.preferred_datetime AT TIME ZONE 'Asia/Manila')::text AS preferred_datetime,
       COALESCE(
         (jo.date_promised AT TIME ZONE 'Asia/Manila')::text,
         (SELECT MAX(spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'))::text
            FROM service_progress_tasks spt
            JOIN services s ON s.service_name = spt.task_title
            JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
           WHERE spt.job_order_id = jo.id AND spt.scheduled_date IS NOT NULL)
       ) AS ready_by
     FROM job_orders jo
     LEFT JOIN service_tickets st ON st.id = jo.ticket_id
     WHERE jo.id = $1`,
    [jobOrderId],
  )
  return res.rows[0] ?? {}
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

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
    const extras = await loadExtras(id)
    const mechanicName = row.mechanic_name || 'Unassigned'

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        ...extras,
        service_names: serviceNames,
        mechanic_name: mechanicName,
        mechanic: mechanicName,
      },
    })
  } catch (error) {
    console.error('Job order fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

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
      const mechCheck = await db.query(
        `SELECT full_name, status FROM employees WHERE id = $1 AND role = 'mechanic'`,
        [resolvedMechanicId]
      )
      if (mechCheck.rows.length === 0 || mechCheck.rows[0].status !== 'active') {
        return NextResponse.json({
          success: false,
          code: 'MECHANIC_UNAVAILABLE',
          message: `${mechCheck.rows[0]?.full_name || 'This mechanic'} is currently on leave and cannot be assigned.`
        }, { status: 400 })
      }
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
    const extras = await loadExtras(id)

    return NextResponse.json({
      success: true,
      data: {
        ...row,
        ...extras,
        service_names: serviceNames,
        mechanic_name: row.mechanic_name || 'Unassigned',
        mechanic: row.mechanic_name || 'Unassigned',
      },
    })
  } catch (error) {
    console.error('Job order PATCH error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}