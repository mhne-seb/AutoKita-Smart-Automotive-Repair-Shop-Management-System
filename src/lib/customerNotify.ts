// customerNotify.ts — one call to tell the customer something happened on
// their job order. Server-side only.
//
// Customer notifications aren't a table of their own: the dashboard bell
// and alerts are built from system_audit_logs (see dashboardController).
// So "notify" means writing an audit row whose new_values carries the text
// to show, tagged with "notify": true so the feed query can pick it out,
// and emailing the same text. Used for: service started, all parts received,
// service finished, finding reported.

import { db } from '@/lib/db'
import { sendJobUpdateEmail } from '@/lib/mail'

export async function notifyCustomer(opts: {
  jobOrderId: number
  entityType: 'service_progress_tasks' | 'service_findings' | 'job_order_parts' | 'road_tests'
  entityId: number
  event: string // short machine name, e.g. 'task_started'
  title: string
  message: string
  employeeId?: number | null // who did it, if known
  sendEmail?: boolean // default true; false when the caller sends a richer email itself
}) {
  // "notify" is written first on purpose — the feed query matches on the
  // literal prefix {"notify":true so it never has to cast every old
  // audit row (many of which aren't JSON) just to filter.
  const payload = JSON.stringify({
    notify: true,
    event: opts.event,
    title: opts.title,
    message: opts.message,
    job_order_id: opts.jobOrderId,
  })
  await db.query(
    `INSERT INTO system_audit_logs (employees_id, action_performed, entity_type, entity_id, new_values, action_date)
     VALUES ($1, 'status_changed'::audit_action_enum, $2, $3, $4, NOW())`,
    [opts.employeeId ?? null, opts.entityType, opts.entityId, payload],
  )

  if (opts.sendEmail === false) return

  // Email is best-effort and NOT awaited — Gmail can take several seconds to
  // accept a message, and the mechanic's Start/Finish click shouldn't wait.
  void (async () => {
    try {
      const c = await db.query(
        `SELECT u.email, u.first_name, u.nickname, v.vehicle_model, v.plate_number
         FROM job_orders jo JOIN users u ON u.id = jo.user_id JOIN vehicles v ON v.id = jo.vehicle_id
         WHERE jo.id = $1`,
        [opts.jobOrderId],
      )
      const cust = c.rows[0]
      if (!cust?.email) return
      await sendJobUpdateEmail({
        to: cust.email,
        name: cust.first_name || cust.nickname || 'there',
        jobOrderId: opts.jobOrderId,
        vehicle: cust.vehicle_model,
        plate: cust.plate_number,
        title: opts.title,
        message: opts.message,
      })
    } catch (err) {
      console.error(`[notifyCustomer] email for JO-${opts.jobOrderId} failed:`, err)
    }
  })()
}
