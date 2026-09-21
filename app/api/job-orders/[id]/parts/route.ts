import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
      return NextResponse.json({ success: false, message: 'partId and a status of received|to_order are required' }, { status: 400 })
    }

    const result = await db.query(
      `UPDATE job_order_parts SET status = $1::job_order_parts_status
       WHERE id = $2::int AND job_order_id = $3::int
       RETURNING id, purchase_order_id`,
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

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Part status update error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
