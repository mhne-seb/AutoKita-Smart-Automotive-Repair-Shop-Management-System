import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyCustomer } from '@/lib/customerNotify'

// The shop has no inventory system — parts are ordered as needed and the
// only fact worth recording is "has it arrived yet". So this flips a part
// to received (or back, if it was tapped by mistake). "Back" is to_order
// for a part bought elsewhere, or ordered for one on a recorded purchase.
// The job_order_parts_status enum has more states; the app uses only these.
const ALLOWED = new Set(['received', 'to_order', 'ordered'])

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: jobOrderId } = await params
    const { partId, status } = await request.json()

    if (!partId || !ALLOWED.has(status)) {
      return NextResponse.json({ success: false, message: 'partId and a status of received|to_order|ordered are required' }, { status: 400 })
    }

    // Parts can be marked received from ordered, in_transit, or directly from to_order.
    if (status === 'received') {
      const cur = await db.query(
        `SELECT status::text FROM job_order_parts WHERE id = $1::int AND job_order_id = $2::int`,
        [partId, jobOrderId],
      )
      const from = cur.rows[0]?.status
      if (!from) return NextResponse.json({ success: false, message: 'Part not found' }, { status: 404 })
    }

    const result = await db.query(
      `UPDATE job_order_parts SET status = $1::job_order_parts_status
       WHERE id = $2::int AND job_order_id = $3::int
       RETURNING id, purchase_order_id, job_order_service_id`,
      [status, partId, jobOrderId],
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Part not found' }, { status: 404 })
    }

    // If the part came from a recorded purchase, roll the PO's status up from
    // its parts: none received → sent, some → partially_received, all →
    // fulfilled (and that's the delivery date).
    const purchaseOrderId = result.rows[0].purchase_order_id
    if (purchaseOrderId) {
      await db.query(
        `UPDATE purchase_orders po SET
           status = CASE
             WHEN c.received = 0 THEN 'sent'
             WHEN c.received < c.total THEN 'partially_received'
             ELSE 'fulfilled'
           END::purchase_order_status,
           actual_delivery_date = CASE WHEN c.received = c.total THEN CURRENT_DATE ELSE NULL END
         FROM (
           SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status IN ('received', 'installed')) AS received
           FROM job_order_parts WHERE purchase_order_id = $1
         ) c
         WHERE po.id = $1`,
        [purchaseOrderId],
      )
    }

    // Once the last part for a service is in, the customer hears that the
    // wait is over. (Only on receiving — Undo doesn't un-announce.)
    const serviceRowId = result.rows[0].job_order_service_id
    if (status === 'received' && serviceRowId) {
      const check = await db.query(
        `SELECT s.service_name,
                COUNT(*) FILTER (WHERE p.status IN ('to_order', 'ordered', 'in_transit'))::int AS still_waiting
         FROM job_order_parts p
         JOIN job_order_services jos ON jos.id = p.job_order_service_id
         JOIN services s ON s.id = jos.service_id
         WHERE p.job_order_service_id = $1
         GROUP BY s.service_name`,
        [serviceRowId],
      )
      const svc = check.rows[0]
      if (svc && svc.still_waiting === 0) {
        await notifyCustomer({
          jobOrderId: Number(jobOrderId),
          entityType: 'job_order_parts',
          entityId: Number(partId),
          event: 'parts_received',
          title: 'Parts Received',
          message: `All parts for ${svc.service_name} have arrived at the shop (Job Order #JO-${jobOrderId}). Work can begin as scheduled.`,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Part status update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
