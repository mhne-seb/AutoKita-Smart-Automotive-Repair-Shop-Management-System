// findingsSweep.ts — the clock on pending findings. Server-side only.
//
// The app has no background scheduler, so this runs whenever the admin bell
// polls (every 45 s while anyone from the shop has the app open) and from
// /api/cron/findings-sweep for a real cron in production. It's cheap: one
// query for pending findings past a threshold, one row written per step.
//
// Each step is recorded as a notifyCustomer() audit row with a distinct
// event name, and a step is only sent if that row doesn't exist yet — so
// the sweep can run as often as you like and never double-sends.

import { db } from '@/lib/db'
import { notifyCustomer } from '@/lib/customerNotify'
import { FINDING_REMINDER_HOURS, FINDING_TIMEOUT_HOURS } from '@/data/findingPolicy'

let lastRunAt = 0
const MIN_GAP_MS = 60_000 // the bell polls faster than this; once a minute is plenty

export async function sweepPendingFindings(force = false): Promise<{ reminded: number; overdue: number }> {
  if (!force && Date.now() - lastRunAt < MIN_GAP_MS) return { reminded: 0, overdue: 0 }
  lastRunAt = Date.now()

  // Pending findings with their age, and which steps have already been sent.
  const { rows } = await db.query(
    `SELECT f.id, f.job_order_id, f.extra_cost,
            EXTRACT(EPOCH FROM (NOW() - f.created_at)) / 3600 AS age_hours,
            EXISTS (SELECT 1 FROM system_audit_logs s WHERE s.entity_type = 'service_findings' AND s.entity_id = f.id
                      AND s.new_values LIKE '{"notify":true,"event":"finding_reminder"%') AS reminded,
            EXISTS (SELECT 1 FROM system_audit_logs s WHERE s.entity_type = 'service_findings' AND s.entity_id = f.id
                      AND s.new_values LIKE '{"notify":true,"event":"finding_overdue"%') AS escalated
     FROM service_findings f
     WHERE f.decision = 'pending'
       AND f.created_at < NOW() - ($1 * INTERVAL '1 hour')`,
    [FINDING_REMINDER_HOURS],
  )

  let reminded = 0
  let overdue = 0
  for (const f of rows) {
    const cost = `₱${Number(f.extra_cost).toLocaleString('en-PH')}`
    const age = Number(f.age_hours)

    if (age >= FINDING_TIMEOUT_HOURS && !f.escalated) {
      await notifyCustomer({
        jobOrderId: f.job_order_id,
        entityType: 'service_findings',
        entityId: f.id,
        event: 'finding_overdue',
        title: 'Final Notice: Approval Needed',
        message: `We still haven't heard back on the ${cost} of additional work found on your vehicle (Job Order #JO-${f.job_order_id}). The shop will call you; your vehicle may be moved to staging until you decide.`,
      })
      overdue++
    } else if (age >= FINDING_REMINDER_HOURS && !f.reminded) {
      await notifyCustomer({
        jobOrderId: f.job_order_id,
        entityType: 'service_findings',
        entityId: f.id,
        event: 'finding_reminder',
        title: 'Reminder: Approval Needed',
        message: `Your mechanic is waiting on your answer about ${cost} of additional work on Job Order #JO-${f.job_order_id}. Please approve or decline within ${FINDING_TIMEOUT_HOURS} hours of the request so work isn't held up.`,
      })
      reminded++
    }
  }
  return { reminded, overdue }
}
