import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const query = `
      SELECT 
        spt.id,
        spt.job_order_id,
        spt.task_title as title,
        spt.scheduled_date,
        spt.task_status as status,
        spt.mechanic_id,
        e.full_name as mechanic_name,
        jo.vehicle_id,
        v.vehicle_model,
        v.plate_number
      FROM service_progress_tasks spt
      LEFT JOIN employees e ON e.id = spt.mechanic_id
      JOIN job_orders jo ON jo.id = spt.job_order_id
      LEFT JOIN vehicles v ON v.id = jo.vehicle_id
      WHERE spt.scheduled_date IS NOT NULL 
        AND spt.task_status != 'completed'
      ORDER BY spt.scheduled_date ASC
    `
    const result = await db.query(query)

    const mechanicsQuery = `SELECT id, full_name, email FROM employees WHERE role = 'mechanic' AND status = 'active'`
    const mechanicsResult = await db.query(mechanicsQuery)

    return NextResponse.json({
      success: true,
      tasks: result.rows,
      mechanics: mechanicsResult.rows
    })
  } catch (err: any) {
    console.error('Schedule GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
