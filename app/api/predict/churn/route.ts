import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const ML_SERVER = 'http://localhost:5001'

export async function GET() {
  try {
    // 1. Get all customers with their service history and vehicle info
    const result = await db.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.contact_number,
        u.email,
        COUNT(DISTINCT jo.id) AS service_count,
        MAX(jo.completed_at) AS last_checkup,
        AVG(EXTRACT(EPOCH FROM jos.estimated_duration) / 60.0) AS avg_duration_mins,
        AVG(jos.actual_amount::float) AS avg_amount,
        AVG(s.base_price::float) AS avg_base_price,
        AVG(s.base_duration_hours::float) AS avg_base_duration_hours,
        MIN(v.vehicle_year) AS vehicle_year,
        MIN(v.vehicle_type) AS vehicle_type,
        MIN(v.vehicle_model) AS vehicle_model,
        MIN(v.mileage::float) AS mileage
      FROM users u
      LEFT JOIN job_orders jo ON jo.user_id = u.id
      LEFT JOIN job_order_services jos ON jos.job_order_id = jo.id
      LEFT JOIN services s ON s.id = jos.service_id
      LEFT JOIN vehicles v ON v.user_id = u.id
      WHERE u.role = 'customer'
      GROUP BY u.id, u.first_name, u.last_name, u.contact_number, u.email
      ORDER BY u.id
    `)

    const customers = result.rows

    // 2. For customers with service history, predict churn via ML
    const customersWithData = customers.filter(
      (c: any) => c.avg_duration_mins != null && c.avg_amount != null
    )

    let churnResults: any[] = []
    if (customersWithData.length > 0) {
      // Build feature payloads for the churn model
      const featurePayloads = customersWithData.map((c: any) => ({
        predicted_duration_mins: c.avg_duration_mins || 60,
        predicted_amount: c.avg_amount || 0,
        base_price: c.avg_base_price || 0,
        base_duration_hours: c.avg_base_duration_hours || 1,
        vehicle_age: c.vehicle_year ? new Date().getFullYear() - c.vehicle_year : 5,
        vehicle_type: c.vehicle_type || 'Sedan',
      }))

      const mlRes = await fetch(`${ML_SERVER}/predict/churn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featurePayloads),
      })
      churnResults = await mlRes.json()
    }

    // 3. Map ML results to churn status labels
    const output = customers.map((c: any, idx: number) => {
      const serviceCount = parseInt(c.service_count) || 0
      const dataIdx = customersWithData.indexOf(c)

      let churnStatus = 'New Customer'
      let churnProbability = 0

      if (serviceCount < 2) {
        churnStatus = 'New Customer'
      } else if (dataIdx >= 0 && churnResults[dataIdx]) {
        churnProbability = churnResults[dataIdx].churn_probability
        if (churnProbability >= 0.7) churnStatus = 'High Churn Risk'
        else if (churnProbability >= 0.4) churnStatus = 'Medium Churn Risk'
        else churnStatus = 'Loyal Customer'
      }

      return {
        customerId: `CUST-${c.id}`,
        name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Unknown',
        contact: c.contact_number || c.email || '—',
        churnStatus,
        churnProbability,
        vehicle: c.vehicle_model
          ? `${c.vehicle_year || ''} ${c.vehicle_model}`.trim()
          : '—',
        mileage: c.mileage ? `${Math.round(c.mileage).toLocaleString()} mi` : '—',
        lastCheckup: c.last_checkup
          ? new Date(c.last_checkup).toISOString().slice(0, 10)
          : null,
        serviceCount,
        offer: churnProbability >= 0.7
          ? 'Free Oil Change Reminder'
          : churnProbability >= 0.4
          ? '15% Discount Maintenance Promo'
          : serviceCount < 2
          ? 'Welcome New Customer Promo'
          : 'Quick-Service Special Offer',
      }
    })

    return NextResponse.json({ success: true, data: output })
  } catch (error) {
    console.error('Churn prediction error:', error)
    return NextResponse.json(
      { success: false, error: 'Churn prediction failed', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
