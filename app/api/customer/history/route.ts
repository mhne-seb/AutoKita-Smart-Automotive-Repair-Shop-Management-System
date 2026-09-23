import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// The customer's Service History — every job order of theirs that has been
// closed out, released or cancelled. One row per job order, with the service
// lines and parts that make up what they paid, so the page can show the
// receipt without another round trip.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get('userId'))
  if (!userId) {
    return NextResponse.json({ success: false, message: 'userId is required' }, { status: 400 })
  }

  try {
    const jobs = await db.query(
      `SELECT jo.id,
              jo.status::text AS status,
              COALESCE(jo.released_at, jo.completed_at, jo.date_arrived)::text AS closed_at,
              v.vehicle_model, v.vehicle_year, v.plate_number
         FROM job_orders jo
         JOIN vehicles v ON v.id = jo.vehicle_id
        WHERE jo.user_id = $1 AND jo.status IN ('released', 'cancelled')
        ORDER BY COALESCE(jo.released_at, jo.completed_at, jo.date_arrived) DESC`,
      [userId],
    )
    if (jobs.rows.length === 0) return NextResponse.json({ success: true, records: [] })

    const ids = jobs.rows.map((r) => r.id)

    // Service lines and parts for every job order in one query each, then
    // grouped in memory — cheaper than a query per record.
    const services = await db.query(
      `SELECT jos.job_order_id, s.service_name, jos.actual_amount
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
        WHERE jos.job_order_id = ANY($1::int[])
        ORDER BY jos.id`,
      [ids],
    )
    const parts = await db.query(
      `SELECT job_order_id, description, quantity, total_retail_amount
         FROM job_order_parts
        WHERE job_order_id = ANY($1::int[])
        ORDER BY id`,
      [ids],
    )
    // Who worked on it, and what the customer actually paid.
    const mechanics = await db.query(
      `SELECT DISTINCT spt.job_order_id, e.full_name
         FROM service_progress_tasks spt JOIN employees e ON e.id = spt.mechanic_id
        WHERE spt.job_order_id = ANY($1::int[])`,
      [ids],
    )
    const paid = await db.query(
      `SELECT job_order_id, COALESCE(SUM(amount_paid), 0) AS paid
         FROM payments
        WHERE job_order_id = ANY($1::int[]) AND verification_status = 'verified'
        GROUP BY job_order_id`,
      [ids],
    )

    const by = <T extends { job_order_id: number }>(rows: T[]) => {
      const map = new Map<number, T[]>()
      for (const r of rows) map.set(r.job_order_id, [...(map.get(r.job_order_id) ?? []), r])
      return map
    }
    const svcBy = by(services.rows)
    const partBy = by(parts.rows)
    const mechBy = by(mechanics.rows)
    const paidBy = new Map(paid.rows.map((r) => [r.job_order_id, Number(r.paid)]))

    const records = jobs.rows.map((jo) => {
      const svc = svcBy.get(jo.id) ?? []
      const prt = partBy.get(jo.id) ?? []
      const labor = svc.reduce((sum, s) => sum + Number(s.actual_amount ?? 0), 0)
      const partsTotal = prt.reduce((sum, p) => sum + Number(p.total_retail_amount ?? 0), 0)
      const names = svc.map((s) => s.service_name)

      return {
        id: `JO-${jo.id}`,
        jobOrderId: jo.id,
        closedAt: jo.closed_at,
        vehicle: `${jo.vehicle_year} ${jo.vehicle_model} (${jo.plate_number})`,
        desc: names.length === 0 ? 'Service' : names.length === 1 ? names[0] : `${names[0]} and ${names.length - 1} more`,
        total: labor + partsTotal,
        paid: paidBy.get(jo.id) ?? 0,
        status: jo.status === 'released' ? 'Completed' : 'Cancelled',
        mechanics: (mechBy.get(jo.id) ?? []).map((m) => m.full_name),
        items: [
          ...svc.map((s) => ({ label: s.service_name, amount: Number(s.actual_amount ?? 0) })),
          ...prt.map((p) => ({ label: `${p.description} ×${p.quantity}`, amount: Number(p.total_retail_amount ?? 0) })),
        ],
      }
    })

    return NextResponse.json({ success: true, records })
  } catch (error) {
    console.error('Customer history error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
