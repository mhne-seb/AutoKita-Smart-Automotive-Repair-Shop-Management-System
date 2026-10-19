import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { id } = await params
    const jobOrderId = parseInt(id, 10)

    if (isNaN(jobOrderId)) {
      return NextResponse.json(
        { success: false, message: 'Invalid job order ID' },
        { status: 400 }
      )
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body is optional
    }

    const employeeId = auth.session.userId

    // 1. Verify job order exists
    const existing = await db.query(
      `SELECT id, ticket_id, user_id, vehicle_id, date_arrived, status
       FROM job_orders WHERE id = $1 LIMIT 1`,
      [jobOrderId]
    )

    if (existing.rows.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Job order not found' },
        { status: 404 }
      )
    }

    const jo = existing.rows[0]

    // Home service: the mechanic goes to the customer, so nothing is "stored in the shop".
    const modeRes = await db.query(
      `SELECT st.service_mode::text AS service_mode
       FROM job_orders jo LEFT JOIN service_tickets st ON st.id = jo.ticket_id
       WHERE jo.id = $1`,
      [jobOrderId],
    )
    const isHome = modeRes.rows[0]?.service_mode === 'home_service'

    // 2. If already checked in, return current info
    if (jo.date_arrived) {
      return NextResponse.json({
        success: true,
        alreadyCheckedIn: true,
        date_arrived: jo.date_arrived,
        message: isHome ? 'The home visit has already started.' : 'Vehicle is already checked in.',
      })
    }

    // 3. Mark vehicle as arrived (stored in shop)
    const updateResult = await db.query(
      `UPDATE job_orders
       SET date_arrived = NOW(),
           status = CASE WHEN status = 'inspecting' THEN status ELSE 'inspecting'::job_orders_status END
       WHERE id = $1
       RETURNING id, date_arrived, status`,
      [jobOrderId]
    )

    const updated = updateResult.rows[0]

    // 4. Ensure inspection session is ready for this job order
    try {
      await db.query(`SELECT * FROM get_or_create_inspection($1)`, [jobOrderId])
    } catch (inspErr) {
      console.warn('Could not initialize inspection record:', inspErr)
    }

    // 5. Resolve employee name for audit trail
    let employeeName = 'Shop Admin'
    if (employeeId) {
      try {
        const empRes = await db.query(
          `SELECT full_name FROM employees WHERE id = $1 LIMIT 1`,
          [employeeId]
        )
        if (empRes.rows.length > 0) {
          employeeName = empRes.rows[0].full_name
        }
      } catch {}
    }

    // 6. Record audit log
    try {
      await db.query(
        `INSERT INTO system_audit_logs (
          employees_id,
          action_performed,
          entity_type,
          entity_id,
          old_values,
          new_values,
          action_date
        ) VALUES ($1, 'vehicle_checked_in', 'job_orders', $2, $3, $4, NOW())`,
        [
          employeeId || null,
          jobOrderId,
          JSON.stringify({ date_arrived: null }),
          JSON.stringify({
            date_arrived: updated.date_arrived,
            checked_in_by: employeeName,
            description: isHome
              ? `Home visit started by ${employeeName}. The mechanic arrived at the customer's address. Inspection unlocked.`
              : `Vehicle arrived and physically stored in the shop by ${employeeName}. Inspection unlocked.`
          })
        ]
      )
    } catch (auditErr) {
      console.error('Failed to log check-in audit event:', auditErr)
    }

    return NextResponse.json({
      success: true,
      message: isHome ? 'Home visit started.' : 'Vehicle marked as arrived and stored in the shop.',
      jobOrder: updated,
    })
  } catch (error) {
    console.error('Check-in error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {})
      },
      { status: 500 }
    )
  }
}
