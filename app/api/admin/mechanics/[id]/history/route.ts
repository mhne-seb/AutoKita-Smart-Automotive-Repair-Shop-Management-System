import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Recent tasks this mechanic worked on — straight from service_progress_tasks,
// which is where assignments actually live. Finished ones first.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await db.query(
      `SELECT spt.id, spt.task_title, spt.task_status, spt.price, spt.scheduled_date, spt.completed_at,
              jo.id AS job_order_id,
              v.vehicle_make, v.vehicle_model, v.vehicle_year, v.plate_number,
              u.first_name, u.last_name
       FROM service_progress_tasks spt
       JOIN job_orders jo ON jo.id = spt.job_order_id
       LEFT JOIN vehicles v ON v.id = jo.vehicle_id
       LEFT JOIN users u ON u.id = jo.user_id
       WHERE spt.mechanic_id = $1
       ORDER BY spt.completed_at DESC NULLS LAST, spt.scheduled_date DESC NULLS LAST, spt.id DESC
       LIMIT 25`,
      [id],
    )
    return NextResponse.json({ success: true, history: result.rows })
  } catch (error) {
    console.error('Mechanic history error:', error)
    return NextResponse.json({ success: false, message: 'Failed to load history' }, { status: 500 })
  }
}
