import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Everything the printable Job Order form needs, in one call: the customer,
// the vehicle, the quoted parts and services, and what's been paid. Mirrors
// the shop's paper form (name / address / phone / date / date promised /
// plate / year & model, then parts left, work right, totals, partial
// payment, balance).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  try {
    const [head, parts, services, payments, promised, warranties] = await Promise.all([
      db.query(
        `SELECT jo.id, jo.jo_date::text, jo.date_promised::text, jo.status::text, jo.released_at::text,
                u.first_name, u.last_name, u.contact_number, u.address,
                v.vehicle_make, v.vehicle_model, v.vehicle_year, v.plate_number, v.vin
         FROM job_orders jo
         JOIN users u ON u.id = jo.user_id
         JOIN vehicles v ON v.id = jo.vehicle_id
         WHERE jo.id = $1`,
        [jobOrderId],
      ),
      db.query(
        `SELECT p.quantity, p.part_number, p.description, p.retail_unit_price, p.is_warranty_replacement
         FROM job_order_parts p WHERE p.job_order_id = $1 ORDER BY p.job_order_service_id, p.id`,
        [jobOrderId],
      ),
      db.query(
        `SELECT s.service_name, jos.description_of_work, jos.actual_amount
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = $1 ORDER BY jos.id`,
        [jobOrderId],
      ),
      db.query(
        `SELECT amount_paid, payment_method::text, payment_channel, payment_date::text
         FROM payments WHERE job_order_id = $1 AND verification_status = 'verified' ORDER BY payment_date`,
        [jobOrderId],
      ),
      // date_promised is never written by the app; the latest scheduled
      // finish across the tasks is the honest "date promised".
      db.query(
        `SELECT MAX(spt.scheduled_date + (jos.estimated_hours * INTERVAL '1 hour'))::text AS promised
         FROM service_progress_tasks spt
         JOIN services s ON s.service_name = spt.task_title
         JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
         WHERE spt.job_order_id = $1 AND spt.scheduled_date IS NOT NULL`,
        [jobOrderId],
      ),
      db.query(
        `SELECT coverage_description, expiration_date::text FROM warranties WHERE job_order_id = $1 ORDER BY id`,
        [jobOrderId],
      ),
    ])
    const h = head.rows[0]
    if (!h) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })

    return NextResponse.json({
      success: true,
      jobOrderId,
      date: h.jo_date,
      datePromised: h.date_promised ?? promised.rows[0]?.promised ?? null,
      status: h.status,
      releasedAt: h.released_at,
      customer: { name: [h.first_name, h.last_name].filter(Boolean).join(' '), phone: h.contact_number ?? '', address: h.address ?? '' },
      vehicle: { yearModel: [h.vehicle_year, h.vehicle_make, h.vehicle_model].filter(Boolean).join(' '), plate: h.plate_number ?? '', vin: h.vin ?? '' },
      parts: parts.rows.map((p) => ({
        qty: Number(p.quantity ?? 1),
        description: [p.part_number, p.description].filter(Boolean).join(' — ') + (p.is_warranty_replacement ? ' (warranty)' : ''),
        unitPrice: Number(p.retail_unit_price ?? 0),
      })),
      warranties: warranties.rows.map((w) => ({ description: w.coverage_description, expiresAt: w.expiration_date })),
      services: services.rows.map((s) => ({ description: s.service_name, amount: Number(s.actual_amount ?? 0) })),
      payments: payments.rows.map((p) => ({
        amount: Number(p.amount_paid ?? 0),
        label: p.payment_channel || (p.payment_method === 'cash' ? 'CASH' : p.payment_method?.toUpperCase() ?? ''),
        date: p.payment_date,
      })),
    })
  } catch (error) {
    console.error('Job order document error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
