import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'

export async function GET(req: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all') === 'true'
    const mechanicId = searchParams.get('mechanicId')

    let query: string
    const queryParams: any[] = []

    if (all) {
      let whereMechanic = ''
      let josWhereMechanic = ''
      if (mechanicId && !isNaN(Number(mechanicId))) {
        queryParams.push(Number(mechanicId))
        const pIndex = `$${queryParams.length}`
        whereMechanic = `AND (spt.mechanic_id = ${pIndex} OR (spt.mechanic_id IS NULL AND jo.assigned_mechanic_id = ${pIndex}))`
        josWhereMechanic = `AND COALESCE(jos.assigned_mechanic_id, jo.assigned_mechanic_id) = ${pIndex}`
      }

      query = `
        SELECT 
          spt.id,
          spt.job_order_id,
          spt.task_title as title,
          spt.note,
          COALESCE(spt.price, 0)::numeric as price,
          COALESCE(
            spt.scheduled_date,
            spt.started_at,
            spt.completed_at
          )::text AS scheduled_date,
          COALESCE(
            spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'),
            spt.started_at + (jos.estimated_hours * INTERVAL '1 hour'),
            spt.completed_at,
            spt.scheduled_date + INTERVAL '1.5 hours',
            spt.started_at + INTERVAL '1.5 hours'
          )::text AS estimated_finish,
          COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours,
          spt.task_status as status,
          spt.started_at::text,
          spt.completed_at::text,
          COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) AS mechanic_id,
          COALESCE(e.full_name, jo_m.full_name, 'Unassigned') as mechanic_name,
          jo.vehicle_id,
          jo.status as job_order_status,
          v.vehicle_model,
          v.vehicle_year,
          v.plate_number,
          COALESCE(CONCAT_WS(' ', u.first_name, u.last_name), 'Customer') as customer_name,
          u.contact_number as customer_phone,
          u.email as customer_email
        FROM service_progress_tasks spt
        LEFT JOIN employees e ON e.id = spt.mechanic_id
        JOIN job_orders jo ON jo.id = spt.job_order_id
        LEFT JOIN employees jo_m ON jo_m.id = jo.assigned_mechanic_id
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        LEFT JOIN users u ON u.id = jo.user_id
        LEFT JOIN LATERAL (
          SELECT jos.estimated_hours
          FROM services s
          JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
          WHERE s.service_name = spt.task_title
          LIMIT 1
        ) jos ON true
        WHERE spt.task_status <> 'cancelled'
          AND (
            spt.scheduled_date IS NOT NULL 
            OR spt.started_at IS NOT NULL 
            OR spt.completed_at IS NOT NULL
          )
          ${whereMechanic}
        ORDER BY scheduled_date ASC
      `
    } else {
      query = `
        SELECT 
          spt.id,
          spt.job_order_id,
          spt.task_title as title,
          COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
          COALESCE(
            spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'),
            spt.started_at + (jos.estimated_hours * INTERVAL '1 hour'),
            spt.scheduled_date + INTERVAL '1.5 hours',
            spt.started_at + INTERVAL '1.5 hours'
          )::text AS estimated_finish,
          COALESCE(jos.estimated_hours, 1.5)::numeric AS estimated_hours,
          spt.task_status as status,
          COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) AS mechanic_id,
          COALESCE(e.full_name, jo_m.full_name, 'Unassigned') as mechanic_name,
          jo.vehicle_id,
          v.vehicle_model,
          v.plate_number
        FROM service_progress_tasks spt
        LEFT JOIN employees e ON e.id = spt.mechanic_id
        JOIN job_orders jo ON jo.id = spt.job_order_id
        LEFT JOIN employees jo_m ON jo_m.id = jo.assigned_mechanic_id
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        LEFT JOIN LATERAL (
          SELECT jos.estimated_hours
          FROM services s
          JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
          WHERE s.service_name = spt.task_title
          LIMIT 1
        ) jos ON true
        WHERE COALESCE(spt.scheduled_date, spt.started_at) IS NOT NULL 
          AND spt.task_status NOT IN ('completed', 'cancelled')
        ORDER BY COALESCE(spt.scheduled_date, spt.started_at) ASC
      `
    }

    const result = await db.query(query, queryParams)

    // Mechanics list
    const mechanicsQuery = `
      SELECT e.id, e.full_name, e.email, e.contact_number, e.status,
             COALESCE(ep.rank, 'Mechanic') AS rank,
             COALESCE(ep.branch, 'AutoKita Main Branch') AS branch,
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
      WHERE e.role = 'mechanic' AND ${all ? "e.status != 'terminated'" : "e.status = 'active'"}
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
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: err.message } : {}) },
      { status: 500 }
    )
  }
}
