import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getJobOrderBill } from '@/lib/jobOrderBill'
import { effectiveWarrantyStatus } from '@/lib/warranty'

// Everything the admin needs to read one service record: the ticket, the
// customer and vehicle, the job order (when there is one) with its services,
// parts, payments and warranties, and a short timeline from the audit log.

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response

  const { ticketId: raw } = await params
  const ticketId = Number(raw)
  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return NextResponse.json({ success: false, message: 'Invalid ticket number.' }, { status: 400 })
  }

  try {
    const head = await db.query(
      `SELECT st.id AS ticket_id, st.request_date, st.preferred_datetime, st.service_mode::text AS service_mode,
              st.customer_concern, st.ticket_status::text AS ticket_status,
              u.first_name, u.last_name, u.email, u.contact_number, u.address,
              v.vehicle_make, v.vehicle_model, v.vehicle_year, v.plate_number, v.vehicle_type, v.mileage,
              jo.id AS job_order_id, jo.status::text AS job_status, jo.date_arrived, jo.started_at,
              jo.completed_at, jo.released_at, jo.quotation_approved, e.full_name AS mechanic_name,
              (wc.id IS NOT NULL) AS is_warranty_claim
       FROM service_tickets st
       JOIN users u ON u.id = st.user_id
       JOIN vehicles v ON v.id = st.vehicle_id
       LEFT JOIN job_orders jo ON jo.ticket_id = st.id
       LEFT JOIN employees e ON e.id = COALESCE(jo.assigned_mechanic_id, st.assigned_mechanic_id)
       LEFT JOIN warranty_claims wc ON wc.ticket_id = st.id
       WHERE st.id = $1`,
      [ticketId],
    )
    const h = head.rows[0]
    if (!h) return NextResponse.json({ success: false, message: 'Record not found.' }, { status: 404 })

    const joId: number | null = h.job_order_id ?? null

    const [services, parts, payments, warranties, bill, audit] = joId
      ? await Promise.all([
          db.query(
            `SELECT s.service_name AS name, COALESCE(jos.actual_amount, 0) AS amount, jos.finding_id
             FROM job_order_services jos JOIN services s ON s.id = jos.service_id
             WHERE jos.job_order_id = $1 ORDER BY jos.id`, [joId]),
          db.query(
            `SELECT description AS name, part_number, quantity, total_retail_amount AS amount, warranty_months, is_warranty_replacement
             FROM job_order_parts WHERE job_order_id = $1 ORDER BY id`, [joId]),
          db.query(
            `SELECT payment_method::text AS method, payment_channel, reference_number, amount_paid,
                    payment_date, verification_status::text AS status
             FROM payments WHERE job_order_id = $1 ORDER BY payment_date DESC, id DESC`, [joId]),
          db.query(
            `SELECT coverage_description, start_date::text AS start_date, expiration_date::text AS expiration_date, status::text AS status
             FROM warranties WHERE job_order_id = $1 ORDER BY id`, [joId]),
          getJobOrderBill(joId),
          db.query(
            `SELECT action_performed::text AS action, entity_type, action_date, new_values, old_values
             FROM system_audit_logs
             WHERE (entity_type = 'service_tickets' AND entity_id = $1) OR (entity_type = 'job_orders' AND entity_id = $2)
             ORDER BY action_date DESC, id DESC LIMIT 30`, [ticketId, joId]),
        ])
      : [null, null, null, null, null, await db.query(
          `SELECT action_performed::text AS action, entity_type, action_date, new_values, old_values
           FROM system_audit_logs WHERE entity_type = 'service_tickets' AND entity_id = $1
           ORDER BY action_date DESC, id DESC LIMIT 30`, [ticketId])]

    // The audit text is JSON for newer rows and plain text for older ones; show one short readable line.
    const eventText = (newRaw: string | null, oldRaw: string | null): string => {
      const parse = (raw: string | null) => { try { return raw ? JSON.parse(raw) : null } catch { return null } }
      const n = parse(newRaw), o = parse(oldRaw)
      if (!n || typeof n !== 'object') return ''
      if (n.title || n.event) return String(n.title ?? n.event).replace(/_/g, ' ')
      const key = ['status', 'ticket_status', 'verification_status', 'decision'].find((k) => n[k] != null)
      if (key) {
        const from = o && typeof o === 'object' && o[key] != null ? `${String(o[key]).replace(/_/g, ' ')} → ` : ''
        return `${from}${String(n[key]).replace(/_/g, ' ')}`
      }
      return ''
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: h.ticket_id, requestDate: h.request_date, preferred: h.preferred_datetime, mode: h.service_mode,
        concern: h.customer_concern, status: h.ticket_status, isWarrantyClaim: h.is_warranty_claim,
      },
      customer: { name: [h.first_name, h.last_name].filter(Boolean).join(' '), email: h.email, contact: h.contact_number, address: h.address },
      vehicle: {
        label: [h.vehicle_year, h.vehicle_make, h.vehicle_model].filter(Boolean).join(' '),
        plate: h.plate_number, type: h.vehicle_type, mileage: h.mileage != null ? Number(h.mileage) : null,
      },
      jobOrder: joId ? {
        id: joId, status: h.job_status, arrived: h.date_arrived, started: h.started_at, completed: h.completed_at,
        released: h.released_at, quotationApproved: h.quotation_approved, mechanic: h.mechanic_name,
      } : null,
      services: services?.rows.map((s) => ({ name: s.name, amount: Number(s.amount), addedMidService: s.finding_id != null })) ?? [],
      parts: parts?.rows.map((p) => ({
        name: p.name, partNo: p.part_number, qty: Number(p.quantity ?? 1), amount: Number(p.amount ?? 0),
        warrantyMonths: p.warranty_months, replacement: Boolean(p.is_warranty_replacement),
      })) ?? [],
      payments: payments?.rows.map((p) => ({
        method: p.method, channel: p.payment_channel, reference: p.reference_number,
        amount: Number(p.amount_paid), date: p.payment_date, status: p.status,
      })) ?? [],
      warranties: warranties?.rows.map((w) => ({
        coverage: w.coverage_description, start: w.start_date, expires: w.expiration_date,
        status: effectiveWarrantyStatus(w.status, w.expiration_date),
      })) ?? [],
      bill: bill ? { total: bill.total, paid: bill.paid, balance: bill.balance } : null,
      timeline: (audit as { rows: any[] }).rows.map((a) => ({ action: a.action, entity: a.entity_type, date: a.action_date, text: eventText(a.new_values, a.old_values) })),
    })
  } catch (err) {
    console.error('Service history detail error:', err)
    return NextResponse.json(
      { success: false, message: 'Could not load this record.', ...(process.env.NODE_ENV !== 'production' ? { debug: err instanceof Error ? err.message : String(err) } : {}) },
      { status: 500 },
    )
  }
}
