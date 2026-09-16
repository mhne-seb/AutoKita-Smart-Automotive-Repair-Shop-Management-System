import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'

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

    // Each mechanic's current load (open tasks) next to their own cap
    // (employee_profiles.jobs_capacity, set on the Mechanics page). Only
    // 'active' mechanics — on_leave and terminated never appear here.
    const mechanicsQuery = `
      SELECT e.id, e.full_name, e.email,
             COALESCE(ep.jobs_capacity, $1)::int AS capacity,
             COUNT(spt.id) FILTER (WHERE spt.task_status <> 'completed')::int AS open_tasks
      FROM employees e
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
      LEFT JOIN service_progress_tasks spt ON spt.mechanic_id = e.id
      WHERE e.role = 'mechanic' AND e.status = 'active'
      GROUP BY e.id, e.full_name, e.email, ep.jobs_capacity
      ORDER BY e.full_name`
    const mechanicsResult = await db.query(mechanicsQuery, [DEFAULT_MECHANIC_CAPACITY])

    return NextResponse.json({
      success: true,
      tasks: result.rows,
      mechanics: mechanicsResult.rows,
    })
  } catch (err: any) {
    console.error('Schedule GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
