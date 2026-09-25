import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyOtp, FINDING_OTP_PURPOSE } from '@/lib/otp'
import type { ProposedService, ProposedPart } from '@/data/types'
import { isVerificationBypassed } from '@/lib/testMode'

// The customer answers a mid-service finding.
//   approve -> needs the emailed code; the proposed services/parts become real
//              rows (job_order_services, job_order_parts, service_progress_tasks)
//              tagged with finding_id, so the bill and the timeline pick them up
//              like any other work.
//   decline -> nothing is added; the finding stays on the job order as a
//              "recommended, not done" record.
export async function POST(request: NextRequest) {
  const { userId, findingId, approved, otpToken, otpCode } = await request.json().catch(() => ({}))
  if (!userId || !findingId || typeof approved !== 'boolean') {
    return NextResponse.json({ success: false, message: 'userId, findingId and approved are required' }, { status: 400 })
  }
  const bypass = isVerificationBypassed()
  if (approved && !bypass) {
    if (!otpToken || !otpCode) {
      return NextResponse.json({ success: false, message: 'Verification code is required' }, { status: 400 })
    }
    const otp = verifyOtp(String(otpToken), String(otpCode), FINDING_OTP_PURPOSE, `${userId}:${findingId}`)
    if (!otp.ok) {
      return NextResponse.json(
        { success: false, code: otp.reason, message: otp.reason === 'expired' ? 'That code has expired. Request a new one.' : 'Incorrect code. Please try again.' },
        { status: 401 },
      )
    }
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const f = await client.query(
      `SELECT f.job_order_id, f.task_id, f.findings, f.proposed_services, f.proposed_parts, f.extra_cost, f.decision::text, jo.user_id
       FROM service_findings f JOIN job_orders jo ON jo.id = f.job_order_id
       WHERE f.id = $1 FOR UPDATE`,
      [findingId],
    )
    const finding = f.rows[0]
    if (!finding) { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'Finding not found' }, { status: 404 }) }
    if (finding.user_id !== userId) { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 }) }
    if (finding.decision !== 'pending') { await client.query('ROLLBACK'); return NextResponse.json({ success: false, message: 'This finding has already been answered.' }, { status: 409 }) }

    const jobOrderId: number = finding.job_order_id

    if (approved) {
      const services = (finding.proposed_services ?? []) as ProposedService[]
      const parts = (finding.proposed_parts ?? []) as ProposedPart[]

      // One job_order_services row + one progress task per proposed service.
      // Parts go under the service they were listed for.
      const serviceRowIdByName = new Map<string, number>()
      for (const s of services) {
        // A custom service (not in the catalog) gets a services row first,
        // same as the quotation page does for "Custom Service (Not Listed)".
        let serviceId = s.serviceId
        if (!serviceId) {
          // Reuse the catalog row if this name already exists (case-insensitive)
          // so custom services don't pile up as duplicates in the catalog.
          const existing = await client.query(
            `SELECT id FROM services WHERE LOWER(service_name) = LOWER($1) ORDER BY id LIMIT 1`,
            [s.name],
          )
          if (existing.rows[0]) {
            serviceId = existing.rows[0].id
          } else {
            const created = await client.query(
              `INSERT INTO services (service_name, base_price, base_duration_hours, is_price_fixed, is_active)
               VALUES ($1, $2, $3, false, true) RETURNING id`,
              [s.name, Number(s.price || 0), Number(s.hours || 1)],
            )
            serviceId = created.rows[0].id
          }
        }
        const jos = await client.query(
          `INSERT INTO job_order_services
             (job_order_id, service_id, description_of_work, estimated_hours, actual_hours, estimated_amount, actual_amount, finding_id)
           VALUES ($1, $2, $3, $4, $4, $5, $5, $6) RETURNING id`,
          [jobOrderId, serviceId, finding.findings, Number(s.hours || 1), Number(s.price || 0), findingId],
        )
        serviceRowIdByName.set(s.name, jos.rows[0].id)

        await client.query(
          `INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable, finding_id)
           VALUES ($1, 'in_progress', $2, $3, 'pending', $4, TRUE, $5)`,
          [jobOrderId, s.name, `Added mid-service: ${finding.findings}`, Number(s.price || 0), findingId],
        )
      }
      for (const p of parts) {
        const qty = Number(p.qty || 1)
        const unit = Number(p.unitPrice || 0)
        await client.query(
          `INSERT INTO job_order_parts
             (job_order_id, job_order_service_id, status, part_number, description, quantity, retail_unit_price, total_retail_amount, finding_id)
           VALUES ($1, $2, $3::job_order_parts_status, $4, $5, $6, $7, $8, $9)`,
          [jobOrderId, serviceRowIdByName.get(p.serviceName) ?? null, p.inStock ? 'in_stock' : 'to_order',
           p.partNo || '', p.name, qty, unit, qty * unit, findingId],
        )
      }
    }

    await client.query(
      `UPDATE service_findings SET decision = $2::approval_status, decided_at = NOW() WHERE id = $1`,
      [findingId, approved ? 'approved' : 'disputed'],
    )

    // The customer's answer is their documented go/no-go, same as the quotation.
    await client.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, $2::audit_action_enum, 'service_findings', $3, $4, NOW())`,
      [userId, approved ? 'approved' : 'rejected', findingId,
       JSON.stringify({ event: approved ? 'finding_approved' : 'finding_declined', job_order_id: jobOrderId, extra_cost: Number(finding.extra_cost) })],
    )

    await client.query('COMMIT')
    return NextResponse.json({ success: true, approved })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[/api/tracking/in-progress/findings/respond] error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
