import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const result = await db.query(
      `
        SELECT 
          spt.id,
          spt.section_id,
          spt.task_title,
          spt.note,
          spt.task_status,
          spt.started_at,
          spt.completed_at,
          spt.price,
          spt.billable,
          spt.scheduled_date,
          spt.mechanic_id,
          spt.completion_photo_url,
          spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour') as estimated_finish,
          e.full_name as mechanic_name
        FROM service_progress_tasks spt
        LEFT JOIN employees e ON e.id = spt.mechanic_id
        LEFT JOIN services s ON s.service_name = spt.task_title
        LEFT JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
        WHERE spt.job_order_id = $1
        ORDER BY spt.section_id ASC, spt.id ASC
      `,
      [id]
    )

    // Job-order-level clock: started_at is stamped by advance_job_order_stage
    // when the job enters in_progress; date_promised / estimated_duration are
    // the pickup window. Returned alongside the tasks (not inside data[]) so
    // the existing consumer is untouched.
    const timingResult = await db.query(
      `SELECT started_at::text, completed_at::text, date_promised::text, estimated_duration::text
       FROM job_orders WHERE id = $1`,
      [id],
    )

    // Parts per service, so a task can show what it's waiting on. Matched to
    // tasks by service name (service_progress_tasks has no FK to the service).
    const partsResult = await db.query(
      `SELECT p.id, p.job_order_service_id, p.description, p.part_number, p.quantity, p.status::text, s.service_name,
              p.purchase_order_id, p.supplier_unit_cost, sup.supplier_name, po.order_date::text AS purchased_on
       FROM job_order_parts p
       JOIN job_order_services jos ON jos.id = p.job_order_service_id
       JOIN services s ON s.id = jos.service_id
       LEFT JOIN purchase_orders po ON po.id = p.purchase_order_id
       LEFT JOIN suppliers sup ON sup.id = po.supplier_id
       WHERE p.job_order_id = $1
       ORDER BY p.id`,
      [id],
    )

    // Every purchase recorded for this job order — the sidebar's ledger.
    const purchasesResult = await db.query(
      `SELECT po.id, sup.supplier_name, po.order_date::text AS purchased_on, po.total_supplier_cost, po.status::text,
              COUNT(p.id)::int AS part_count
       FROM purchase_orders po
       JOIN suppliers sup ON sup.id = po.supplier_id
       JOIN job_order_parts p ON p.purchase_order_id = po.id
       WHERE p.job_order_id = $1
       GROUP BY po.id, sup.supplier_name, po.order_date, po.total_supplier_cost, po.status
       ORDER BY po.order_date DESC, po.id DESC`,
      [id],
    )

    return NextResponse.json({
      success: true,
      data: result.rows,
      timing: timingResult.rows[0] ?? null,
      parts: partsResult.rows,
      purchases: purchasesResult.rows,
    })
  } catch (error) {
    console.error('Service progress fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}