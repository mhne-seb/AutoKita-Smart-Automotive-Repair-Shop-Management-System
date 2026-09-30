import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signFileUrls } from '@/lib/storage'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

export async function GET(req: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {

    const query = `
      SELECT 
          st.id as ticket_id,
          st.service_mode,
          st.customer_concern,
          st.ticket_status,
          st.request_date,
          st.preferred_datetime,
          u.id as user_id,
          u.avatar_url,
          u.first_name,
          u.last_name,
          u.contact_number,
          u.email,
          v.vehicle_model,
          v.plate_number,
          v.vehicle_year,
          EXISTS (
              SELECT 1 FROM system_audit_logs c
              WHERE c.entity_type = 'service_tickets'
                AND c.entity_id = st.id
                AND c.action_performed = 'approved'
                -- The customer's own row. Accepting the ticket also writes an
                -- 'approved' row on it, but by an employee — that isn't consent.
                AND c.user_id IS NOT NULL
          ) AS diagnostic_scan_authorized,
          la.last_activity,
          COALESCE(st.assigned_mechanic_id, jo.assigned_mechanic_id) as mechanic_id,
          wc.id IS NOT NULL AS is_warranty_claim,
          jo.id as job_order_id,
          jo.date_arrived,
          jo.status as job_order_status
      FROM service_tickets st
      LEFT JOIN warranty_claims wc ON wc.ticket_id = st.id
      JOIN users u ON u.id = st.user_id
      JOIN vehicles v ON v.id = st.vehicle_id
      LEFT JOIN job_orders jo ON jo.ticket_id = st.id
      LEFT JOIN LATERAL (
        SELECT MAX(c.action_date) AS last_activity
        FROM system_audit_logs c
        WHERE c.entity_type = 'service_tickets'
          AND c.entity_id = st.id
          AND NOT (c.action_performed = 'approved' AND c.user_id IS NOT NULL)
      ) la ON true
      ORDER BY GREATEST(CASE WHEN st.request_date <= NOW() THEN st.request_date END, la.last_activity) DESC NULLS LAST, st.id DESC
    `
    const result = await db.query(query)

    const avatars = result.rows.map((r: any) => r.avatar_url)
    const signedAvatars = await signFileUrls(avatars)
    for (let i = 0; i < result.rows.length; i++) {
      result.rows[i].avatar_url = signedAvatars[i]
    }

    const mechanicsQuery = `SELECT id, full_name, email FROM employees WHERE role = 'mechanic'`
    const mechanicsResult = await db.query(mechanicsQuery)
    const mechanics = mechanicsResult.rows

    return NextResponse.json({
      success: true,
      tickets: result.rows,
      mechanics
    })
  } catch (err: any) {
    console.error('Job queue GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const body = await req.json()
    const { action, ticketId, mechanicId, holdReason } = body

    if (!action) {
      return NextResponse.json({ success: false, message: 'Missing action parameter' }, { status: 400 })
    }

    // 2. If the action is NOT 'create', then we absolutely need a ticketId
    if (action !== 'create' && !ticketId) {
      return NextResponse.json({ success: false, message: 'Missing ticketId' }, { status: 400 })
    }

    // Resolve employee who performed this action
    let actingEmpId = auth.session.userId
    let employeeName = 'Shop Administrator'
    try {
      if (actingEmpId) {
        const empLookup = await db.query(`SELECT full_name FROM employees WHERE id = $1`, [actingEmpId])
        if (empLookup.rows.length > 0) {
          employeeName = empLookup.rows[0].full_name
        }
      } else {
        const fallbackEmp = await db.query(`SELECT id, full_name FROM employees WHERE role = 'owner' LIMIT 1`)
        if (fallbackEmp.rows.length > 0) {
          actingEmpId = fallbackEmp.rows[0].id
          employeeName = fallbackEmp.rows[0].full_name
        }
      }
    } catch (empErr) {
      console.warn('Could not resolve employee details for audit:', empErr)
    }

    if (['approve', 'reject', 'hold'].includes(action)) {
      const existing = await db.query(`SELECT id FROM job_orders WHERE ticket_id = $1 LIMIT 1`, [ticketId])
      if (existing.rows.length > 0) {
        if (action === 'approve') {
          return NextResponse.json({
            success: true,
            alreadyApproved: true,
            jobOrder: existing.rows[0],
            message: 'This ticket already has a job order.',
          })
        } else {
          return NextResponse.json({ success: false, message: 'This ticket already has a job order.' }, { status: 409 })
        }
      }

      const ticketCheck = await db.query(`SELECT ticket_status FROM service_tickets WHERE id = $1`, [ticketId])
      if (ticketCheck.rows.length === 0) {
        return NextResponse.json({ success: false, message: 'Ticket not found.' }, { status: 404 })
      }
      const status = ticketCheck.rows[0].ticket_status
      if (!['pending', 'queued', 'inspection_scheduled'].includes(status)) {
        return NextResponse.json({ success: false, message: 'This ticket can no longer be changed.' }, { status: 409 })
      }
    }

    if (action === 'approve') {


      const joQuery = `SELECT * FROM create_job_order_from_ticket($1, $2)`
      const joResult = await db.query(joQuery, [ticketId, mechanicId || null])

      const newJo = joResult.rows[0]

      let mechanicName = 'Unassigned'
      if (mechanicId && newJo) {
        const assignQuery = `SELECT assign_mechanic_to_job_order($1, $2)`
        await db.query(assignQuery, [newJo.id, mechanicId])
        try {
          const mRes = await db.query(`SELECT full_name FROM employees WHERE id = $1`, [mechanicId])
          if (mRes.rows.length > 0) mechanicName = mRes.rows[0].full_name
        } catch {}
      }

      // Record ticket acceptance in system_audit_logs
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
          ) VALUES ($1, 'approved', 'service_tickets', $2, $3, $4, NOW())`,
          [
            actingEmpId,
            ticketId,
            JSON.stringify({ ticket_status: 'pending' }),
            JSON.stringify({
              ticket_status: 'approved',
              accepted_by_employee_id: actingEmpId,
              accepted_by: employeeName,
              assigned_mechanic_id: mechanicId || null,
              assigned_mechanic: mechanicName,
              job_order_id: newJo?.id || null,
              description: `Ticket #${ticketId} accepted by ${employeeName} and assigned to ${mechanicName}`
            })
          ]
        )
      } catch (auditErr) {
        console.error('Failed to write ticket acceptance audit log:', auditErr)
      }

      // If the customer authorized the OBD-II scan at booking, attach the fee
      // to the job order NOW — not at quotation time. That way declining the
      // quotation later can't erase a charge they already agreed to.
      if (newJo) {
        const consent = await db.query(
          `SELECT 1 FROM system_audit_logs
           WHERE entity_type = 'service_tickets' AND entity_id = $1 AND action_performed = 'approved'
             -- Only the customer's consent row — the acceptance row written a
             -- few lines above is also 'approved' on this ticket, by the admin.
             AND user_id IS NOT NULL
           LIMIT 1`,
          [ticketId],
        )
        if (consent.rows.length > 0) {
          await db.query(
            `INSERT INTO job_order_services
               (job_order_id, service_id, assigned_mechanic_id, description_of_work, estimated_hours, estimated_amount, actual_amount)
             SELECT $1, s.id, $2, $3, s.base_duration_hours, s.base_price, s.base_price
             FROM services s
             WHERE s.service_name = $4 AND s.is_active
             LIMIT 1`,
            [newJo.id, mechanicId || null, 'OBD-II diagnostic scan — authorized by customer at booking. Payable even if repairs are declined.', DIAGNOSTIC_SCAN_SERVICE_NAME],
          )

          // The scan itself is done during inspection, not the repair stage —
          // pre-insert its repair-stage task as already completed so it never
          // shows up asking to be scheduled/started later. set_quotation_approval's
          // "INSERT new tasks ... WHERE NOT EXISTS" skips a task_title that's
          // already there, so this row is what it finds and leaves alone.
          await db.query(
            `INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable)
             VALUES ($1, 'in_progress', $2, $3, 'completed', 0, true)`,
            [newJo.id, DIAGNOSTIC_SCAN_SERVICE_NAME, 'Performed during inspection.'],
          )
        }
      }

      const checkInNow = Boolean(body.checkInNow)
      if (checkInNow && newJo) {
        const updateRes = await db.query(`UPDATE job_orders SET date_arrived = NOW() WHERE id = $1 RETURNING date_arrived`, [newJo.id])
        newJo.date_arrived = updateRes.rows[0]?.date_arrived ?? new Date().toISOString()
        try {
          await db.query(`SELECT * FROM get_or_create_inspection($1)`, [newJo.id])
        } catch {}
        try {
          await db.query(
            `INSERT INTO system_audit_logs (
              employees_id, action_performed, entity_type, entity_id, new_values, action_date
            ) VALUES ($1, 'vehicle_checked_in', 'job_orders', $2, $3, NOW())`,
            [
              actingEmpId,
              newJo.id,
              JSON.stringify({
                date_arrived: newJo.date_arrived,
                checked_in_by: employeeName,
                description: `Vehicle arrived and physically stored in the shop upon approval by ${employeeName}`
              })
            ]
          )
        } catch {}
      }

      return NextResponse.json({ success: true, jobOrder: newJo })
    }
    else if (action === 'check_in') {
      const { ticketId, jobOrderId } = body
      let resolvedJoId = jobOrderId
      if (!resolvedJoId && ticketId) {
        const findJo = await db.query(`SELECT id FROM job_orders WHERE ticket_id = $1 LIMIT 1`, [ticketId])
        if (findJo.rows.length > 0) {
          resolvedJoId = findJo.rows[0].id
        }
      }

      if (!resolvedJoId) {
        return NextResponse.json({ success: false, message: 'Job order not found for this ticket' }, { status: 404 })
      }

      const updateRes = await db.query(
        `UPDATE job_orders SET date_arrived = NOW() WHERE id = $1 RETURNING id, date_arrived, status`,
        [resolvedJoId]
      )

      try {
        await db.query(`SELECT * FROM get_or_create_inspection($1)`, [resolvedJoId])
      } catch {}

      try {
        await db.query(
          `INSERT INTO system_audit_logs (
            employees_id, action_performed, entity_type, entity_id, new_values, action_date
          ) VALUES ($1, 'vehicle_checked_in', 'job_orders', $2, $3, NOW())`,
          [
            actingEmpId,
            resolvedJoId,
            JSON.stringify({
              date_arrived: updateRes.rows[0].date_arrived,
              checked_in_by: employeeName,
              description: `Vehicle arrived and physically stored in the shop by ${employeeName}. Inspection unlocked.`
            })
          ]
        )
      } catch {}

      return NextResponse.json({ success: true, jobOrder: updateRes.rows[0] })
    }
    else if (action === 'reject') {
      const rejectQuery = `SELECT update_ticket_status($1, 'declined')`
      await db.query(rejectQuery, [ticketId])

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
          ) VALUES ($1, 'rejected', 'service_tickets', $2, $3, $4, NOW())`,
          [
            actingEmpId,
            ticketId,
            JSON.stringify({ ticket_status: 'pending' }),
            JSON.stringify({
              ticket_status: 'declined',
              rejected_by_employee_id: actingEmpId,
              rejected_by: employeeName
            })
          ]
        )
      } catch (auditErr) {
        console.error('Failed to log ticket rejection audit:', auditErr)
      }

      return NextResponse.json({ success: true })
    }
    else if (action === 'hold') {
      const holdQuery = `SELECT update_ticket_status($1, 'queued')`
      await db.query(holdQuery, [ticketId])

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
          ) VALUES ($1, 'status_changed', 'service_tickets', $2, $3, $4, NOW())`,
          [
            actingEmpId,
            ticketId,
            JSON.stringify({ ticket_status: 'pending' }),
            JSON.stringify({
              ticket_status: 'queued',
              hold_reason: holdReason || 'Pending parts / technician schedule',
              placed_on_hold_by_employee_id: actingEmpId,
              placed_on_hold_by: employeeName
            })
          ]
        )
      } catch (auditErr) {
        console.error('Failed to log ticket hold audit:', auditErr)
      }

      return NextResponse.json({ success: true, reason: holdReason })
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err: any) {
    console.error('Job queue POST error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
