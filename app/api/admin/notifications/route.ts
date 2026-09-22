import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sweepPendingFindings } from '@/lib/findingsSweep'
import { FINDING_TIMEOUT_HOURS } from '@/data/findingPolicy'

// No new DB objects. Reads only existing stored functions and builds the
// admin notification list in application code. Each row self-clears once the
// admin acts (advance stage / release / verify payment).
export async function GET() {
  try {
    // The bell polls every 45 s while the shop has the app open — that's
    // the app's clock for finding reminders (see lib/findingsSweep).
    sweepPendingFindings().catch((e) => console.error('[notifications] sweep failed:', e))

    const [tickets, jobOrders, payments, responses, jobOrderCreatedAt, overdueFindings] = await Promise.all([
      db.query('SELECT * FROM get_service_tickets_queue()'),
      db.query('SELECT * FROM get_job_orders_list()'),
      db.query('SELECT * FROM get_payment_records()'),
      // Every yes/no the customer has given, newest first — inspection report
      // (pre_diagnostics round), quotation (2FA confirm on job_orders), and
      // mid-service findings. These are history, not to-dos: they stay in
      // the list so the shop can always see what the customer decided.
      // A customer's audit row always has user_id set; staff rows don't.
      db.query(
        `SELECT sal.id, sal.entity_type, sal.action_performed::text AS action,
                sal.new_values, sal.action_date,
                jo.id AS job_order_id, u.first_name, u.last_name,
                pd.mechanic_notes, sf.extra_cost
         FROM system_audit_logs sal
         LEFT JOIN pre_diagnostics pd     ON sal.entity_type = 'pre_diagnostics'  AND pd.id = sal.entity_id
         LEFT JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
         LEFT JOIN service_findings sf    ON sal.entity_type = 'service_findings' AND sf.id = sal.entity_id
         JOIN job_orders jo ON jo.id = COALESCE(vi.job_order_id, sf.job_order_id,
                                                CASE WHEN sal.entity_type = 'job_orders' THEN sal.entity_id END)
         JOIN users u ON u.id = jo.user_id
         WHERE sal.user_id IS NOT NULL
           AND sal.action_performed IN ('approved', 'rejected')
           AND sal.entity_type IN ('pre_diagnostics', 'job_orders', 'service_findings')
         ORDER BY sal.action_date DESC
         LIMIT 30`,
      ),
      // get_job_orders_list() only has jo_date (a plain DATE, no time — the
      // job order was 'created' by create_job_order_from_ticket() at some
      // exact moment, and that's logged here). Without this, "New job
      // order" always shows midnight of that day instead of when the
      // ticket was actually approved.
      db.query(
        `SELECT entity_id AS job_order_id, action_date
         FROM system_audit_logs
         WHERE entity_type = 'job_orders' AND action_performed = 'created'`,
      ),
      // Findings the customer hasn't answered inside the policy window
      // (paper: UC 14, Exception 1). Shows until they answer.
      db.query(
        `SELECT f.id, f.job_order_id, f.extra_cost, f.created_at, u.first_name, u.last_name, u.contact_number
         FROM service_findings f
         JOIN job_orders jo ON jo.id = f.job_order_id
         JOIN users u ON u.id = jo.user_id
         WHERE f.decision = 'pending' AND f.created_at < NOW() - ($1 * INTERVAL '1 hour')
         ORDER BY f.created_at ASC`,
        [FINDING_TIMEOUT_HOURS],
      ),
    ])

    const createdAt = new Map<number, string>(
      jobOrderCreatedAt.rows.map((r: { job_order_id: number; action_date: string }) => [r.job_order_id, r.action_date]),
    )

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
          notif_time: createdAt.get(jo.id) ?? jo.jo_date,
          href: `/job-orders/${jo.id}/inspection`,
        })
      }
      // 2. Service finished — check the value (clears once released)
      if (jo.status === 'completed') {
        notifs.push({
          notif_key: `jo-done-${jo.id}`,
          title: 'Service completed',
          message: `JO-${jo.id} is complete. Collect the balance and release the vehicle.`,
          notif_time: jo.jo_date,
          href: `/job-orders/${jo.id}/billing`,
        })
      }
    }

    const joStatusMap = new Map(jobOrders.rows.map((jo: { id: number; status: string }) => [jo.id, jo.status]))
    const joStatusFor = (id: number) => joStatusMap.get(id)

    // 3. What the customer decided — one entry per answer, kept as history.
    for (const r of responses.rows) {
      const who = name(r.first_name, r.last_name)
      const jo = `JO-${r.job_order_id}`
      const approved = r.action === 'approved'
      let title = ''
      let message = ''
      let href = `/job-orders/${r.job_order_id}/progress`

      if (r.entity_type === 'pre_diagnostics') {
        // Both stages share pre_diagnostics; quotation rounds are the ones
        // whose notes start with "Quotation total:" (see tracking/quotation).
        const isQuotation = String(r.mechanic_notes ?? '').startsWith('Quotation total:')
        const stage = isQuotation ? 'quotation' : 'inspection'
        href = `/job-orders/${r.job_order_id}/${stage}`
        if (approved) {
          title = isQuotation ? 'Quotation approved' : 'Inspection approved'
          message = `${who} approved the ${stage} for ${jo}.${isQuotation ? '' : ' Prepare the quotation.'}`
        } else {
          title = 'Customer has a concern'
          message = `${who} raised a concern on the ${stage} for ${jo}${r.new_values ? `: "${short(r.new_values, 100)}"` : ''}. Revise it and send it again.`
        }
      } else if (r.entity_type === 'job_orders') {
        // The 2FA confirm on the quotation (see tracking/quotation/confirm).
        let accepted = 0
        try { accepted = (JSON.parse(r.new_values ?? '{}').accepted_service_ids ?? []).length } catch { /* not JSON */ }
        title = 'Quotation confirmed'
        message = `${who} confirmed the quotation for ${jo}${accepted ? ` (${accepted} service${accepted === 1 ? '' : 's'})` : ''}. Schedule the work.`
      } else if (r.entity_type === 'service_findings') {
        const cost = peso(r.extra_cost)
        title = approved ? 'Additional work approved' : 'Additional work declined'
        message = approved
          ? `${who} approved ${cost} of additional work on ${jo}. Schedule the new service and order its parts.`
          : `${who} declined ${cost} of additional work on ${jo}. It stays on the job as a recommendation.`
      } else {
        continue
      }

      notifs.push({ notif_key: `decision-${r.id}`, title, message, notif_time: r.action_date, href })
    }

    // 4. No answer on a finding within the policy window — someone has to
    //    call. Clears the moment the customer approves or declines.
    for (const f of overdueFindings.rows) {
      notifs.push({
        notif_key: `finding-overdue-${f.id}`,
        title: 'Customer has not answered',
        message: `${name(f.first_name, f.last_name)} hasn't responded to ${peso(f.extra_cost)} of additional work on JO-${f.job_order_id} for over ${FINDING_TIMEOUT_HOURS} hours. Call them${f.contact_number ? ` (${f.contact_number})` : ''}; per policy the vehicle moves to staging until they decide.`,
        notif_time: f.created_at,
        href: `/job-orders/${f.job_order_id}/progress`,
      })
    }

    // 5. Payment proof waiting for manual verification (clears once verified)
    for (const p of payments.rows) {
      if (p.verification_status === 'pending') {
        // A pending CASH row is the customer saying "I'll pay at the counter" —
        // no money has moved yet. A pending transfer is money they say they
        // sent, waiting for the shop to match it against the account.
        const cash = p.payment_method === 'cash'
        notifs.push({
          notif_key: `payment-${p.payment_id}`,
          title: cash ? 'Customer will pay at the counter' : 'Payment needs verification',
          message: cash
            ? `${name(p.first_name, p.last_name)} chose to pay ${peso(p.amount_paid)} in cash at the shop for JO-${p.job_order_id}. Confirm it once the money is in hand.`
            : `${name(p.first_name, p.last_name)} submitted a ${peso(p.amount_paid)} transfer for JO-${p.job_order_id}. Check it against the shop's account.`,
          notif_time: p.payment_date,
          // Downpayments are verified on the quotation page; final-balance
          // payments on the Billing page.
          href: joStatusFor(p.job_order_id) === 'pending_customer_approval' ? `/job-orders/${p.job_order_id}/quotation` : `/job-orders/${p.job_order_id}/billing`,
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