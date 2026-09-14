import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// No new DB objects. Reads only existing stored functions and builds the
// admin notification list in application code. Each row self-clears once the
// admin acts (advance stage / release / verify payment).
export async function GET() {
  try {
    const [tickets, jobOrders, payments, responses] = await Promise.all([
      db.query('SELECT * FROM get_service_tickets_queue()'),
      db.query('SELECT * FROM get_job_orders_list()'),
      db.query('SELECT * FROM get_payment_records()'),
      // The customer's latest answer on each job order's inspection report.
      // DISTINCT ON keeps only the newest round per job order, so a dispute
      // that was later revised and approved shows the approval, not both.
      // Inline query — no stored function covers pre_diagnostics + audit log.
      db.query(
        `SELECT DISTINCT ON (pd.job_order_id)
                pd.job_order_id,
                pd.customer_approval_status::text AS status,
                sal.new_values                     AS reason,
                sal.action_date                    AS responded_at,
                u.first_name, u.last_name
         FROM pre_diagnostics pd
         JOIN job_orders jo ON jo.id = pd.job_order_id
         JOIN users u       ON u.id = jo.user_id
         LEFT JOIN system_audit_logs sal
           ON sal.entity_type = 'pre_diagnostics'
          AND sal.entity_id = pd.id
          AND sal.action_performed IN ('approved', 'rejected')
         WHERE pd.customer_approval_status IN ('approved', 'disputed')
         ORDER BY pd.job_order_id, pd.datetime_created DESC`,
      ),
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
    const short = (s?: string | null, n = 80) =>
      !s ? '' : s.length > n ? s.slice(0, n) + '...' : s

    const notifs: Notif[] = []

    for(const t of tickets.rows) {
      notifs.push({
        notif_key: `ticket-${t.id}`,
        title: 'New service request',
        message: `${name(t.first_name, t.last_name)} booked ${t.vehicle_model ?? 'a vehicle'} (${t.plate_number ?? 'no plate'}). ${short(t.customer_concern)}`.trim(),
        notif_time:t.request_date,
        href:'/job-queue',
      })
    }

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

    // 3. Customer answered the inspection report.
    //    - Disputed: shows until the mechanic sends a revised round (the
    //      DISTINCT ON above then returns that newer 'pending' round, which
    //      isn't in this set — so it self-clears).
    //    - Approved: shows while the job order still sits at
    //      pending_customer_approval, i.e. until the admin builds the quotation.
    const joStatus = new Map(jobOrders.rows.map((jo: { id: number; status: string }) => [jo.id, jo.status]))
    for (const r of responses.rows) {
      if (r.status === 'disputed') {
        notifs.push({
          notif_key: `inspection-disputed-${r.job_order_id}`,
          title: 'Customer has a concern',
          message: `${name(r.first_name, r.last_name)} raised a concern on JO-${r.job_order_id}${
            r.reason ? `: "${short(r.reason, 100)}"` : ''
          }. Call them, revise the findings, and send the report again.`,
          notif_time: r.responded_at,
          href: `/job-orders/${r.job_order_id}/inspection`,
        })
      } else if (r.status === 'approved' && joStatus.get(r.job_order_id) === 'pending_customer_approval') {
        notifs.push({
          notif_key: `inspection-approved-${r.job_order_id}`,
          title: 'Inspection approved',
          message: `${name(r.first_name, r.last_name)} approved the inspection for JO-${r.job_order_id}. Prepare the quotation.`,
          notif_time: r.responded_at,
          href: `/job-orders/${r.job_order_id}/quotation`,
        })
      }
    }

    // 4. Payment proof waiting for manual verification (clears once verified)
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