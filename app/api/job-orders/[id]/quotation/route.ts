import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const headerResult = await db.query(
      `
      SELECT jo.id, jo.quotation_notes, jo.actual_grand_total,
             (pd.job_order_id IS NOT NULL) AS sent_to_customer
      FROM job_orders jo
      LEFT JOIN pre_diagnostics pd ON pd.job_order_id = jo.id
      WHERE jo.id = $1
      `,
      [id]
    )

    if (headerResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    const servicesResult = await db.query(
      `SELECT * FROM get_job_order_services($1::int)`,
      [id]
    )
    const partsResult = await db.query(
      `SELECT * FROM get_job_order_parts($1)`,
      [id]
    )

    return NextResponse.json({
      success: true,
      data: {
        ...headerResult.rows[0],
        services: servicesResult.rows,
        parts: partsResult.rows,
      },
    })
  } catch (error) {
    console.error('Quotation fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { notes, services, estimated_grand_total, actual_grand_total } = body

    // 1. Update quotation notes and totals
    await db.query(
      `UPDATE job_orders SET quotation_notes = $1, estimated_grand_total = $2, actual_grand_total = $3 WHERE id = $4::int`, 
      [notes || '', estimated_grand_total || 0, actual_grand_total || 0, id]
    )

    // 2. Clear existing services and parts
    await db.query(`DELETE FROM job_order_services WHERE job_order_id = $1::int`, [id])
    await db.query(`DELETE FROM job_order_parts WHERE job_order_id = $1::int`, [id])

    // 3. Insert newly added services and parts
    if (Array.isArray(services)) {
      for (const s of services) {
        let serviceId = s.dbServiceId

        // If it's a custom service without an ID, insert into services table first
        if (!serviceId) {
          const newSrvRes = await db.query(
            `INSERT INTO services (service_name, base_price, base_duration_hours, is_price_fixed, is_active) 
             VALUES ($1, $2, $3, false, true) RETURNING id`,
            [s.name, s.laborCost, s.laborHours]
          )
          serviceId = newSrvRes.rows[0].id
        }

        const josRes = await db.query(
          `INSERT INTO job_order_services 
           (job_order_id, service_id, description_of_work, estimated_hours, actual_hours, actual_amount, estimated_amount)
           VALUES ($1::int, $2::int, $3, $4::numeric, $5::numeric, $6::numeric, $7::numeric) RETURNING id`,
          [id, serviceId, s.description || '', s.laborHours || 1, s.laborHours || 1, s.laborCost || 0, s.estimated_amount || 0]
        )
        const jobOrderServiceId = josRes.rows[0].id

        // Insert parts for this service
        if (Array.isArray(s.parts)) {
          for (const p of s.parts) {
            const dbStatus = p.status === 'in-stock' ? 'in_stock' : 'to_order'
            const totalRetail = (p.qty || 1) * (p.unitPrice || 0)
            await db.query(
              `INSERT INTO job_order_parts
               (job_order_id, job_order_service_id, status, part_number, description, quantity, retail_unit_price, total_retail_amount)
               VALUES ($1::int, $2::int, $3, $4, $5, $6::int, $7::numeric, $8::numeric)`,
              [id, jobOrderServiceId, dbStatus, p.partNo || '', p.name || '', p.qty || 1, p.unitPrice || 0, totalRetail]
            )
          }
        }
      }
    }

    // 4. If the quotation was already approved, dynamically sync changes to the "In Progress" tasks.
    const joStatusRes = await db.query(`SELECT quotation_approved FROM job_orders WHERE id = $1::int`, [id])
    if (joStatusRes.rows[0]?.quotation_approved) {
      await db.query(`SELECT set_quotation_approval($1::int, true)`, [id])
    }

    return NextResponse.json({ success: true, message: 'Quotation saved and synced successfully' })
  } catch (error) {
    console.error('Quotation save error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}