import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLatestPullOut } from '@/lib/pullOut'
import { notifyCustomer } from '@/lib/customerNotify'

// The shop answers a pull-out request (paper UC 15, steps 4–7 and 4a–4c).
//
//   approve → the job is trimmed down to what the shop has committed to:
//             - finished and started services stay (billed)
//             - an unstarted service whose parts have ALREADY BEEN ORDERED is
//               committed: it stays, the shop completes it, it's billed
//               (shop policy — ordered parts make a service non-cancellable)
//             - an unstarted service with nothing ordered is cancelled: its
//               labor and its to-order parts come off the bill
//             If work remains, the job stays in_progress and finishes the
//             normal way (Testing → Billing). If only finished work is left,
//             it goes straight to 'completed' (Billing) for release.
//   deny    → the request is closed with the shop's note and work resumes.
async function stillOpen(jobOrderId: number): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM service_progress_tasks
     WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status NOT IN ('completed', 'cancelled')`,
    [jobOrderId],
  )
  return rows[0].n > 0
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const body = await request.json().catch(() => ({}))
  const action = body.action as string
  const note = String(body.note ?? '').trim()

  if (action !== 'approve' && action !== 'deny') {
    return NextResponse.json({ success: false, message: 'action must be approve or deny' }, { status: 400 })
  }
  if (action === 'deny' && !note) {
    return NextResponse.json({ success: false, message: 'Tell the customer why the request was denied' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const req = await getLatestPullOut(jobOrderId)
    if (!req || req.decision !== 'pending') {
      await client.query('ROLLBACK')
      return NextResponse.json({ success: false, message: 'No pending pull-out request on this job order' }, { status: 409 })
    }

    let cancelled: string[] = []
    let committed: string[] = []
    if (action === 'approve') {
      // 1. Unstarted tasks with NO ordered part → cancelled. A task is
      //    committed if any part on its service is past 'to_order'. Parts
      //    match tasks by service name AND finding (two same-named services
      //    from different findings must not share parts) — the same rule
      //    the progress page uses.
      const c = await client.query(
        `UPDATE service_progress_tasks spt SET task_status = 'cancelled'
         WHERE spt.job_order_id = $1 AND spt.section_id = 'in_progress' AND spt.task_status = 'pending'
           AND NOT EXISTS (
             SELECT 1 FROM job_order_parts p
             JOIN job_order_services jos ON jos.id = p.job_order_service_id
             JOIN services s ON s.id = jos.service_id
             WHERE jos.job_order_id = $1 AND s.service_name = spt.task_title
               AND jos.finding_id IS NOT DISTINCT FROM spt.finding_id
               AND p.status <> 'to_order'
           )
         RETURNING task_title`,
        [jobOrderId],
      )
      cancelled = c.rows.map((r) => r.task_title)
      const k = await client.query(
        `SELECT task_title FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status = 'pending'`,
        [jobOrderId],
      )
      committed = k.rows.map((r) => r.task_title)

      if (cancelled.length > 0) {
        // 2. Cancelled labor and its never-bought parts come off the bill.
        const jos = await client.query(
          `UPDATE job_order_services jos SET actual_amount = 0
           FROM services s
           WHERE jos.job_order_id = $1 AND s.id = jos.service_id AND s.service_name = ANY($2::text[])
           RETURNING jos.id`,
          [jobOrderId, cancelled],
        )
        const ids = jos.rows.map((r) => r.id)
        if (ids.length > 0) {
          await client.query(
            `UPDATE job_order_parts SET total_retail_amount = 0
             WHERE job_order_id = $1 AND job_order_service_id = ANY($2::int[]) AND status = 'to_order'`,
            [jobOrderId, ids],
          )
        }
      }

      // 3. Anything still open (started, or committed)? Then the job keeps
      //    going the normal way. Otherwise it's done — straight to Billing.
      const open = await client.query(
        `SELECT COUNT(*)::int AS n FROM service_progress_tasks
         WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status NOT IN ('completed', 'cancelled')`,
        [jobOrderId],
      )
      if (open.rows[0].n === 0) {
        await client.query(`SELECT advance_job_order_stage($1, 'completed'::job_orders_status)`, [jobOrderId])
      }
    }

    await client.query(
      `UPDATE pull_out_requests SET decision = $2::approval_status, admin_note = $3, decided_at = NOW() WHERE id = $1`,
      [req.id, action === 'approve' ? 'approved' : 'disputed', note || null],
    )
    await client.query(
      `INSERT INTO system_audit_logs (action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1::audit_action_enum, 'pull_out_requests', $2, $3, NOW())`,
      [action === 'approve' ? 'approved' : 'rejected', req.id,
       JSON.stringify({ event: action === 'approve' ? 'pull_out_approved' : 'pull_out_denied', job_order_id: jobOrderId, cancelled_tasks: cancelled, committed_tasks: committed, note: note || null })],
    )
    await client.query('COMMIT')

    await notifyCustomer({
      jobOrderId, entityType: 'pull_out_requests', entityId: req.id,
      event: action === 'approve' ? 'pull_out_approved' : 'pull_out_denied',
      title: action === 'approve' ? 'Pull-Out Approved' : 'Pull-Out Request Denied',
      message: action === 'approve'
        ? `Your pull-out request for Job Order #JO-${jobOrderId} is approved. ${cancelled.length ? `${cancelled.length} unstarted service${cancelled.length === 1 ? ' was' : 's were'} cancelled at no charge. ` : ''}${committed.length ? `${committed.length} service${committed.length === 1 ? '' : 's'} with parts already ordered will still be completed. ` : ''}${committed.length || (await stillOpen(jobOrderId)) ? "We'll let you know when the vehicle is ready for release." : 'Please settle the balance on your Billing page, then pick up your vehicle.'}${note ? ` Note from the shop: ${note}` : ''}`
        : `The shop could not approve your pull-out request for Job Order #JO-${jobOrderId}: ${note} Work on your vehicle continues.`,
    })

    return NextResponse.json({ success: true, cancelled, committed })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Pull-out decision error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  } finally {
    client.release()
  }
}
