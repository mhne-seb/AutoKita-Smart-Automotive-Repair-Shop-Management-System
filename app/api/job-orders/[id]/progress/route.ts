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
          spt.completed_at,
          spt.price,
          spt.billable,
          spt.scheduled_date,
          spt.mechanic_id,
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

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Service progress fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}