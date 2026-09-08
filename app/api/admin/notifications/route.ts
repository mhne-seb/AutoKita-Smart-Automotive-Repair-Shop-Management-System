import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// No new DB objects. Reads only existing stored functions and builds the
// admin notification list in application code. Each row self-clears once the
// admin acts (advance stage / release / verify payment).
export async function GET() {
  try {
    const [jobOrders, payments] = await Promise.all([
      db.query('SELECT * FROM get_job_orders_list()'),
      db.query('SELECT * FROM get_payment_records()'),
    ])

    type Notif = {
      notif_key: string
      title: string
      message: string
      notif_time: string | null
      href: string | null
    }

    const peso = (v: unknown) =>
      'PHP ' +
      Number(v ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const name = (f?: string | null, l?: string | null) =>
      [f, l].filter(Boolean).join(' ') || 'a customer'

    const notifs: Notif[] = []

    for (const jo of jobOrders.rows) {
      // 1. Job order just created from a ticket (stays 'inspecting' until advanced)
      if (jo.status === 'inspecting') {
        notifs.push({
          notif_key: `jo-created-${jo.id}`,
          title: 'New job order',
          message: `JO-${jo.id} created for ${name(jo.first_name, jo.last_name)} — ${jo.vehicle_model ?? 'vehicle'} (${jo.plate_number ?? 'no plate'}). Start the inspection.`,
          notif_time: jo.jo_date,
          href: `/job-orders/${jo.id}`,
        })
      }
      // 2. Service finished — check the value (clears once released)
      if (jo.status === 'completed') {
        notifs.push({
          notif_key: `jo-done-${jo.id}`,
          title: 'Service completed',
          message: `JO-${jo.id} is complete. Total ${peso(jo.actual_grand_total)}. Review final billing and release.`,
          notif_time: jo.jo_date,
          href: `/job-orders/${jo.id}`,
        })
      }
    }

    // 3. Payment proof waiting for manual verification (clears once verified)
    for (const p of payments.rows) {
      if (p.verification_status === 'pending') {
        notifs.push({
          notif_key: `payment-${p.payment_id}`,
          title: 'Payment needs verification',
          message: `${name(p.first_name, p.last_name)} submitted a payment of ${peso(p.amount_paid)} for JO-${p.job_order_id}.`,
          notif_time: p.payment_date,
          href: `/job-orders/${p.job_order_id}/quotation`,
        })
      }
    }

    notifs.sort((a, b) => {
      const ta = a.notif_time ? new Date(a.notif_time).getTime() : 0
      const tb = b.notif_time ? new Date(b.notif_time).getTime() : 0
      return tb - ta
    })

    return NextResponse.json({ success: true, notifications: notifs.slice(0, 20) })
  } catch (err: unknown) {
    console.error('Admin notifications GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}