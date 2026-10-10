import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireCustomer()
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  const { id } = await params
  const vehicleId = parseInt(id, 10)
  if (isNaN(vehicleId) || vehicleId <= 0) {
    return NextResponse.json({ success: false, message: 'Vehicle not found.' }, { status: 404 })
  }

  try {
    const vRes = await db.query(
      `SELECT v.id, v.vehicle_make as make, v.vehicle_model as model, v.vehicle_year as year, v.plate_number as plate, v.vehicle_type as transmission, v.mileage,
              (SELECT jo.id FROM job_orders jo WHERE jo.vehicle_id = v.id AND jo.status NOT IN ('released', 'cancelled') ORDER BY jo.id DESC LIMIT 1) as active_job_order_id
       FROM vehicles v
       WHERE v.id = $1 AND v.user_id = $2
       LIMIT 1`,
      [vehicleId, userId]
    )

    if (vRes.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Vehicle not found.' }, { status: 404 })
    }

    const vRow = vRes.rows[0]
    const vehicle = {
      id: vRow.id,
      make: vRow.make,
      model: vRow.model,
      year: vRow.year,
      plate: vRow.plate,
      transmission: vRow.transmission,
      mileage: Number(vRow.mileage),
      inService: vRow.active_job_order_id !== null,
      activeJobOrderId: vRow.active_job_order_id
    }

    const historyRes = await db.query(
      `SELECT jo.id, jo.status::text as status,
              COALESCE(jo.released_at, jo.completed_at, jo.date_arrived, jo.jo_date) as date,
              jo.actual_grand_total, jo.estimated_grand_total
       FROM job_orders jo
       WHERE jo.vehicle_id = $1 AND jo.user_id = $2
       ORDER BY COALESCE(jo.released_at, jo.completed_at, jo.date_arrived, jo.jo_date) DESC
       LIMIT 50`,
      [vehicleId, userId]
    )

    const history = []

    if (historyRes.rows.length > 0) {
      const ids = historyRes.rows.map(r => r.id)
      const services = await db.query(
        `SELECT jos.job_order_id, s.service_name
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = ANY($1::int[])
         ORDER BY jos.id`,
        [ids]
      )
      
      const by = (rows: any[]) => {
        const map = new Map<number, string[]>()
        for (const r of rows) map.set(r.job_order_id, [...(map.get(r.job_order_id) ?? []), r.service_name])
        return map
      }
      
      const svcBy = by(services.rows)
      
      for (const jo of historyRes.rows) {
        history.push({
          id: jo.id,
          status: jo.status,
          date: jo.date,
          services: svcBy.get(jo.id) ?? [],
          total: jo.actual_grand_total !== null ? Number(jo.actual_grand_total) : (jo.estimated_grand_total !== null ? Number(jo.estimated_grand_total) : null)
        })
      }
    }

    return NextResponse.json({ success: true, vehicle, history })
  } catch (error) {
    console.error('Customer vehicle details GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 })
  }
}
