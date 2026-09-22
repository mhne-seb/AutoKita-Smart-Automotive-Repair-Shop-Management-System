import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRoadTestHistory, currentAttempt } from '@/lib/roadTest'

// Customer view of the Testing stage: the job order plus every road-test
// attempt (get_road_test_history), read-only. Same userId / jobOrderId
// contract as the other tracking routes.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')
  if (!userIdParam) return NextResponse.json({ error: 'Missing required query parameter: userId' }, { status: 400 })
  const userId = parseInt(userIdParam, 10)
  if (isNaN(userId)) return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })

  try {
    let jobOrder
    if (jobOrderIdParam) {
      const jobOrderId = parseInt(jobOrderIdParam, 10)
      if (isNaN(jobOrderId)) return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })
      const { rows } = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
      jobOrder = rows[0] ?? null
      if (jobOrder && jobOrder.user_id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    } else {
      const { rows } = await db.query(`SELECT * FROM get_customer_active_job_order($1)`, [userId])
      jobOrder = rows[0] ?? null
    }

    const history = jobOrder ? await getRoadTestHistory(jobOrder.job_order_id) : []
    // Whether every service is done — tells the customer "waiting for the
    // test to start" vs "still being worked on" when no attempt is open.
    const svc = jobOrder
      ? await db.query(
          `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE task_status = 'completed')::int AS done
           FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status <> 'cancelled'`,
          [jobOrder.job_order_id],
        )
      : null
    const allServicesDone = Boolean(svc && svc.rows[0].total > 0 && svc.rows[0].done === svc.rows[0].total)

    return NextResponse.json({ jobOrder, history, current: currentAttempt(history), allServicesDone })
  } catch (err) {
    console.error('[/api/tracking/testing] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
