import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// The shop has no inventory system — parts are ordered as needed and the
// only fact worth recording is "has it arrived yet". So this flips a part
// from to_order to received (or back, if it was tapped by mistake). The
// job_order_parts_status enum has more states; the app deliberately uses
// only these two.
const ALLOWED = new Set(['received', 'to_order'])

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
       RETURNING id`,
      [status, partId, jobOrderId],
    )
    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Part not found' }, { status: 404 })
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
