import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLatestPullOut } from '@/lib/pullOut'

// Customer side of a pull-out (paper UC 15): ask to take the vehicle back
// mid-repair, or withdraw the request while the shop hasn't answered.
// The shop's approve/deny lives in /api/job-orders/[id]/pull-out.

async function ownedInProgress(userId: number, jobOrderId: number) {
  const { rows } = await db.query(`SELECT user_id, status::text FROM job_orders WHERE id = $1`, [jobOrderId])
  const jo = rows[0]
  if (!jo) return { error: 'Job order not found', status: 404 }
  if (jo.user_id !== userId) return { error: 'Forbidden', status: 403 }
  return { jo }
}

export async function POST(request: NextRequest) {
  const { userId, jobOrderId, reason } = await request.json().catch(() => ({}))
  if (!userId || !jobOrderId) return NextResponse.json({ success: false, message: 'userId and jobOrderId are required' }, { status: 400 })

  try {
    const own = await ownedInProgress(Number(userId), Number(jobOrderId))
    if ('error' in own) return NextResponse.json({ success: false, message: own.error }, { status: own.status })
    if (own.jo.status !== 'in_progress') {
      return NextResponse.json({ success: false, message: 'A pull-out can only be requested while the vehicle is being worked on' }, { status: 409 })
    }
    // Exception 1: all repairs done → there's nothing to pull out of; checkout instead.
    const svc = await db.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE task_status = 'completed')::int AS done
       FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status <> 'cancelled'`,
      [jobOrderId],
    )
    if (svc.rows[0].total > 0 && svc.rows[0].done === svc.rows[0].total) {
      return NextResponse.json({ success: false, message: 'All services are already finished — proceed to checkout instead' }, { status: 409 })
    }
    if ((await getLatestPullOut(Number(jobOrderId)))?.decision === 'pending') {
      return NextResponse.json({ success: false, message: 'A pull-out request is already waiting for the shop' }, { status: 409 })
    }

    const ins = await db.query(
      `INSERT INTO pull_out_requests (job_order_id, reason) VALUES ($1, $2) RETURNING id`,
      [jobOrderId, String(reason ?? '').trim() || null],
    )
    // Documented as the customer's own action, like their other decisions.
    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'created'::audit_action_enum, 'pull_out_requests', $2, $3, NOW())`,
      [userId, ins.rows[0].id, JSON.stringify({ event: 'pull_out_requested', job_order_id: Number(jobOrderId) })],
    )
    return NextResponse.json({ success: true, requestId: ins.rows[0].id })
  } catch (err) {
    console.error('[/api/tracking/in-progress/pull-out] POST error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}

// Withdraw a request the shop hasn't answered yet.
export async function DELETE(request: NextRequest) {
  const { userId, jobOrderId } = await request.json().catch(() => ({}))
  if (!userId || !jobOrderId) return NextResponse.json({ success: false, message: 'userId and jobOrderId are required' }, { status: 400 })
  try {
    const own = await ownedInProgress(Number(userId), Number(jobOrderId))
    if ('error' in own) return NextResponse.json({ success: false, message: own.error }, { status: own.status })
    const del = await db.query(`DELETE FROM pull_out_requests WHERE job_order_id = $1 AND decision = 'pending' RETURNING id`, [jobOrderId])
    if (del.rows.length === 0) return NextResponse.json({ success: false, message: 'No pending request to withdraw' }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/tracking/in-progress/pull-out] DELETE error:', err)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
