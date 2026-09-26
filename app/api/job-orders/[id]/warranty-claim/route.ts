import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyCustomer } from '@/lib/customerNotify'

// The claim panel on the inspection page of a job order that started from a
// customer's warranty claim (see warranty_claims / customer/warranties/claim).
//
//   GET  -> the claim, the original warranty and part, if this job order has one.
//   POST -> the admin's decision, after the mechanic has inspected the part.
//           approve: part + labor go on THIS job order at ₱0, tagged the same
//             way Jubert's fail_road_test() tags a warranty replacement, and
//             the replacement gets its own warranty (remaining time only —
//             see migration_add_warranty_claims.sql).
//           deny: the original warranty is voided only for misuse/accident;
//             the job order continues as a normal paid repair either way.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  try {
    const res = await db.query(
      `SELECT wc.id AS claim_id, wc.customer_description, wc.decision::text, wc.mechanic_finding,
              wc.deny_reason, wc.voids_warranty, wc.decided_at::text,
              w.id AS warranty_id, w.coverage_description, w.expiration_date::text,
              w.job_order_id AS original_job_order_id,
              jop.id AS part_id, jop.job_order_service_id
       FROM warranty_claims wc
       JOIN warranties w ON w.id = wc.warranty_id
       LEFT JOIN job_order_parts jop ON jop.id = w.job_order_part_id
       JOIN job_orders jo ON jo.ticket_id = wc.ticket_id
       WHERE jo.id = $1`,
      [jobOrderId],
    )
    const claim = res.rows[0] ?? null
    return NextResponse.json({ success: true, claim })
  } catch (error) {
    console.error('[/api/job-orders/[id]/warranty-claim] GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const body = await request.json().catch(() => ({}))
  const { action, mechanicFinding, denyReason, voidsWarranty, employeeId } = body

  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ success: false, message: 'action must be approve or deny' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const claimRes = await client.query(
      `SELECT wc.id AS claim_id, wc.warranty_id, wc.decision::text,
              w.coverage_description, w.expiration_date::text, w.job_order_part_id,
              jop.description, jop.part_number, jop.quantity, jop.is_oem, jop.tier, jop.job_order_service_id,
              jos.service_id, jos.estimated_hours
       FROM warranty_claims wc
       JOIN warranties w ON w.id = wc.warranty_id
       JOIN job_orders jo ON jo.ticket_id = wc.ticket_id
       LEFT JOIN job_order_parts jop ON jop.id = w.job_order_part_id
       LEFT JOIN job_order_services jos ON jos.id = jop.job_order_service_id
       WHERE jo.id = $1 FOR UPDATE`,
      [jobOrderId],
    )
    const claim = claimRes.rows[0]
    if (!claim) {
      await client.query('ROLLBACK')
      return NextResponse.json({ success: false, message: 'No warranty claim on this job order' }, { status: 404 })
    }
    if (claim.decision !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({ success: false, message: 'This claim has already been decided' }, { status: 409 })
    }

    if (action === 'approve') {
      // Labor first (part+labor both free — see the shop's warranty policy),
      // so the new part row can point at it.
      const newService = await client.query(
        `INSERT INTO job_order_services (job_order_id, service_id, description_of_work, estimated_hours, actual_hours, estimated_amount, actual_amount)
         VALUES ($1, $2, $3, $4, $4, 0, 0) RETURNING id`,
        [jobOrderId, claim.service_id, `Warranty replacement — ${claim.description}`, claim.estimated_hours || 1],
      )
      const newServiceId = newService.rows[0].id

      const newPart = await client.query(
        `INSERT INTO job_order_parts
           (job_order_id, job_order_service_id, part_number, description, quantity, retail_unit_price, total_retail_amount, status, is_oem, tier, replaces_part_id, is_warranty_replacement)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 'to_order'::job_order_parts_status, $6, $7, $8, TRUE)
         RETURNING id`,
        [jobOrderId, newServiceId, claim.part_number, `${claim.description} (Warranty Replacement)`, claim.quantity || 1, claim.is_oem, claim.tier, claim.job_order_part_id],
      )
      const newPartId = newPart.rows[0].id

      // Remaining-time policy: the replacement keeps the original's expiration
      // date rather than starting a fresh full term, so repeat claims can't
      // keep a part covered forever.
      await client.query(
        `INSERT INTO warranties (job_order_id, job_order_part_id, coverage_description, start_date, expiration_date, status)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, 'active'::warranty_status)`,
        [jobOrderId, newPartId, claim.coverage_description, claim.expiration_date],
      )

      await client.query(
        `UPDATE warranties SET status = 'claimed'::warranty_status WHERE id = $1`,
        [claim.warranty_id],
      )
      await client.query(
        `UPDATE warranty_claims SET decision = 'approved'::approval_status, mechanic_finding = $2, decided_at = NOW(), decided_by = $3 WHERE id = $1`,
        [claim.claim_id, mechanicFinding ?? null, employeeId ?? null],
      )

      await client.query('COMMIT')

      await notifyCustomer({
        jobOrderId, entityType: 'warranty_claims', entityId: claim.claim_id, event: 'warranty_claim_approved',
        title: 'Warranty Claim Approved',
        message: `Your warranty claim for ${claim.coverage_description} was approved — the part and labor are free. Job Order #JO-${jobOrderId}.`,
      })
      return NextResponse.json({ success: true })
    }

    // deny
    await client.query(
      `UPDATE warranty_claims SET decision = 'disputed'::approval_status, mechanic_finding = $2, deny_reason = $3, voids_warranty = $4, decided_at = NOW(), decided_by = $5 WHERE id = $1`,
      [claim.claim_id, mechanicFinding ?? null, denyReason ?? null, Boolean(voidsWarranty), employeeId ?? null],
    )
    if (voidsWarranty) {
      await client.query(`UPDATE warranties SET status = 'voided'::warranty_status WHERE id = $1`, [claim.warranty_id])
    }
    await client.query('COMMIT')

    await notifyCustomer({
      jobOrderId, entityType: 'warranty_claims', entityId: claim.claim_id, event: 'warranty_claim_denied',
      title: 'Warranty Claim Not Covered',
      message: `Your warranty claim for ${claim.coverage_description} wasn't covered${denyReason ? `: ${denyReason}` : '.'} Job Order #JO-${jobOrderId} continues as a regular repair.`,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('[/api/job-orders/[id]/warranty-claim] POST error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
