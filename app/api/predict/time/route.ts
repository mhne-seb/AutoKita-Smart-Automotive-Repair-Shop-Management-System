import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ML_SERVER = 'http://localhost:5001'

export async function GET(req: NextRequest) {
  const jobOrderId = req.nextUrl.searchParams.get('jobOrderId')
  if (!jobOrderId) {
    return NextResponse.json({ error: 'jobOrderId is required' }, { status: 400 })
  }

  try {
    // Get the service features for this job order from the database
    const result = await db.query(`
      SELECT
        jos.service_id,
        jos.amount::float,
        EXTRACT(EPOCH FROM jos.estimated_duration) / 60.0 AS estimated_duration_mins,
        s.base_price::float,
        s.base_duration_hours::float,
        s.is_price_fixed::int AS is_price_fixed,
        EXTRACT(YEAR FROM CURRENT_DATE) - v.vehicle_year AS vehicle_age,
        v.vehicle_type
      FROM job_order_services jos
      JOIN services s ON s.id = jos.service_id
      JOIN job_orders jo ON jo.id = jos.job_order_id
      JOIN vehicles v ON v.id = jo.vehicle_id
      WHERE jos.job_order_id = $1
    `, [jobOrderId])

    if (result.rows.length === 0) {
      return NextResponse.json({ predicted_duration_mins: null, message: 'No services found' })
    }

    // Send each service to the ML server for time prediction
    const predictions = await Promise.all(
      result.rows.map(async (row: any) => {
        const res = await fetch(`${ML_SERVER}/predict/time`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estimated_duration_mins: row.estimated_duration_mins || 60,
            amount: row.amount || 0,
            service_id: row.service_id,
            base_price: row.base_price || 0,
            base_duration_hours: row.base_duration_hours || 1,
            is_price_fixed: row.is_price_fixed || 0,
            vehicle_age: row.vehicle_age || 5,
            vehicle_type: row.vehicle_type || 'Sedan',
          }),
        })
        return res.json()
      })
    )

    // Sum up all service duration predictions
    const totalPredictedMins = predictions.reduce(
      (sum: number, p: any) => sum + (p.predicted_duration_mins || 0), 0
    )

    return NextResponse.json({
      predicted_duration_mins: Math.round(totalPredictedMins * 100) / 100,
      predicted_hours: Math.round((totalPredictedMins / 60) * 100) / 100,
      services: predictions,
    })
  } catch (error) {
    console.error('Time prediction error:', error)
    return NextResponse.json(
      { error: 'Prediction failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
