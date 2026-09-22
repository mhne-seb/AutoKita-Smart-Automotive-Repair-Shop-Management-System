import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { findingTotal } from '@/lib/findings'
import { sendReviewReadyEmail } from '@/lib/mail'
import { notifyCustomer } from '@/lib/customerNotify'
import type { ProposedService, ProposedPart } from '@/data/types'

// NOTE: this is the MID-SERVICE finding (job already in progress).
// The inspection report's Mechanical Findings are a different thing and
// live at /api/job-orders/[id]/findings — don't merge the two.
// Admin reports something found mid-service that the approved quotation
// didn't cover. This only records the finding and tells the customer — the
// proposed services/parts stay on the finding row as JSON until the customer
// approves (see /api/tracking/in-progress/findings/respond), so nothing on
// the job order changes yet.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ success: false, message: 'Invalid JSON body' }, { status: 400 })

  const taskId = body.taskId ? Number(body.taskId) : null
  const findings = String(body.findings ?? '').trim()
  const photoUrl = body.photoUrl ? String(body.photoUrl) : null
  const services: ProposedService[] = Array.isArray(body.services) ? body.services : []
  const parts: ProposedPart[] = Array.isArray(body.parts) ? body.parts : []

  if (!findings) {
    return NextResponse.json({ success: false, message: 'Describe what you found' }, { status: 400 })
  }
  if (services.length === 0 && parts.length === 0) {
    return NextResponse.json({ success: false, message: 'Add at least one service or part' }, { status: 400 })
  }
  // Every part must belong to one of the proposed services, because on
  // approval parts are inserted under a job_order_services row.
  const serviceNames = new Set(services.map((s) => s.name))
  if (parts.some((p) => !serviceNames.has(p.serviceName))) {
    return NextResponse.json({ success: false, message: 'Each part must be under one of the added services' }, { status: 400 })
  }

  try {
    // The job must be on the floor, and the task (if given) must be its own.
    const jo = await db.query(`SELECT status::text FROM job_orders WHERE id = $1`, [jobOrderId])
    if (jo.rows.length === 0) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    if (jo.rows[0].status !== 'in_progress') {
      return NextResponse.json({ success: false, message: 'Findings can only be reported while the job is in progress' }, { status: 409 })
    }
    let reportedBy: number | null = null
    if (taskId) {
      const task = await db.query(`SELECT mechanic_id FROM service_progress_tasks WHERE id = $1 AND job_order_id = $2`, [taskId, jobOrderId])
      if (task.rows.length === 0) return NextResponse.json({ success: false, message: 'Task not found on this job order' }, { status: 404 })
      reportedBy = task.rows[0].mechanic_id ?? null
    }

    const extraCost = findingTotal(services, parts)
    const inserted = await db.query(
      `INSERT INTO service_findings
         (job_order_id, task_id, reported_by, findings, photo_url, proposed_services, proposed_parts, extra_cost)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
       RETURNING id`,
      [jobOrderId, taskId, reportedBy, findings, photoUrl, JSON.stringify(services), JSON.stringify(parts), extraCost],
    )
    const findingId = inserted.rows[0].id

    // The in-app notification. The email is the richer "review this" one
    // below, so notifyCustomer doesn't send its own.
    await notifyCustomer({
      jobOrderId,
      entityType: 'service_findings',
      entityId: findingId,
      event: 'finding_reported',
      title: 'Your Mechanic Found Something',
      message: `While working on your vehicle (Job Order #JO-${jobOrderId}) the mechanic found something that needs your approval — ₱${extraCost.toLocaleString('en-PH')} of additional work. Please review it on your service tracker.`,
      employeeId: reportedBy,
      sendEmail: false,
    })

    // Same best-effort email as the inspection/quotation review rounds.
    let emailed = false
    try {
      const c = await db.query(
        `SELECT u.email, u.first_name, u.nickname, v.vehicle_model, v.plate_number
         FROM job_orders jo JOIN users u ON u.id = jo.user_id JOIN vehicles v ON v.id = jo.vehicle_id
         WHERE jo.id = $1`,
        [jobOrderId],
      )
      const cust = c.rows[0]
      if (cust?.email) {
        await sendReviewReadyEmail({
          to: cust.email,
          name: cust.first_name || cust.nickname || 'there',
          jobOrderId: String(jobOrderId),
          vehicle: cust.vehicle_model,
          plate: cust.plate_number,
          context: 'finding',
        })
        emailed = true
      }
    } catch (mailErr) {
      console.error('[findings] email failed:', mailErr)
    }

    return NextResponse.json({ success: true, findingId, extraCost, emailed })
  } catch (error) {
    console.error('Report finding error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
