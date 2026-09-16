import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userIdParam = searchParams.get('userId')
  const jobOrderIdParam = searchParams.get('jobOrderId')

  if (!userIdParam) {
    return NextResponse.json({ error: 'Missing required query parameter: userId' }, { status: 400 })
  }
  const userId = parseInt(userIdParam, 10)
  if (isNaN(userId)) {
    return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
  }

  try {
    let jobOrder
    if (jobOrderIdParam) {
      const jobOrderId = parseInt(jobOrderIdParam, 10)
      if (isNaN(jobOrderId)) {
        return NextResponse.json({ error: 'jobOrderId must be a number' }, { status: 400 })
      }
      const { rows } = await db.query(`SELECT * FROM get_job_order_by_id($1)`, [jobOrderId])
      jobOrder = rows[0] ?? null
      if (jobOrder && jobOrder.user_id !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else {
      const { rows } = await db.query(`SELECT * FROM get_customer_active_job_order($1)`, [userId])
      jobOrder = rows[0] ?? null
    }

    const tasks = jobOrder
      ? await (async () => {
          const rows = (await db.query(`SELECT * FROM get_job_order_tasks($1)`, [jobOrder.job_order_id])).rows
          // Photo of the finished work per task — newer than get_job_order_tasks(),
          // so it's picked up separately rather than editing that function.
          const photos = await db.query(
            `SELECT id, completion_photo_url FROM service_progress_tasks WHERE job_order_id = $1 AND completion_photo_url IS NOT NULL`,
            [jobOrder.job_order_id],
          )
          const byId = new Map(photos.rows.map((p) => [p.id, p.completion_photo_url as string]))
          return rows.map((t) => ({ ...t, completion_photo_url: byId.get(t.id) ?? null }))
        })()
      : []

    // Parts per service so the tracker can say "waiting for parts" instead
    // of a task just sitting at Not Yet with no explanation.
    const parts = jobOrder
      ? (await db.query(
          `SELECT p.id, p.job_order_service_id, p.description, p.part_number, p.quantity, p.status::text, s.service_name
       FROM job_order_parts p
       JOIN job_order_services jos ON jos.id = p.job_order_service_id
       JOIN services s ON s.id = jos.service_id
       WHERE p.job_order_id = $1
       ORDER BY p.id`,
          [jobOrder.job_order_id],
        )).rows
      : []

    return NextResponse.json({ jobOrder, tasks, parts })
  } catch (err) {
    console.error('[/api/tracking/in-progress] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}