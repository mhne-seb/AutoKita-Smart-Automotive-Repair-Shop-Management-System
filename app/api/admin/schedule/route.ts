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
        COALESCE(
          spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'),
          spt.scheduled_date + INTERVAL '1.5 hours'
        ) AS estimated_finish,
        COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours,
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
      LEFT JOIN LATERAL (
        SELECT jos.estimated_hours
        FROM services s
        JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
        WHERE s.service_name = spt.task_title
        LIMIT 1
      ) jos ON true
      WHERE spt.scheduled_date IS NOT NULL 
        AND spt.task_status NOT IN ('completed', 'cancelled')
      ORDER BY spt.scheduled_date ASC
    `
    const result = await db.query(query)

    // Each mechanic's current load (open tasks) next to their own cap
    // (employee_profiles.jobs_capacity, set on the Mechanics page). Only
    // 'active' mechanics — on_leave and terminated never appear here.
    const mechanicsQuery = `
      SELECT e.id, e.full_name, e.email,
             COALESCE(ep.jobs_capacity, $1)::int AS capacity,
             COALESCE((
               SELECT COUNT(DISTINCT jo.id)::int
               FROM job_orders jo
               LEFT JOIN service_progress_tasks spt ON spt.job_order_id = jo.id
               WHERE (jo.assigned_mechanic_id = e.id OR spt.mechanic_id = e.id)
                 AND jo.status IN ('in_progress', 'waiting_on_parts', 'testing')
                 AND (spt.task_status IS NULL OR spt.task_status <> 'completed')
             ), 0) AS open_tasks
      FROM employees e
      LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
      WHERE e.role = 'mechanic' AND e.status = 'active'
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
