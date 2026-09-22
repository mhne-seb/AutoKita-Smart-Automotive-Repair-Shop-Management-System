import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRoadTestHistory, currentAttempt } from '@/lib/roadTest'
import { uploadRoadTestPhoto } from '@/lib/storage'
import { notifyCustomer } from '@/lib/customerNotify'

// The Testing stage. Reads through get_road_test_history(); writes through
// Jubert's start_road_test / pass_road_test / fail_road_test, which own the
// status changes (in_progress -> testing -> completed, or back to
// in_progress on a fail) and the audit rows.
//
// Extra chargeable work found on the road is NOT sent through
// fail_road_test's extra_* parameters — the shop reports a finding after
// the fail instead, so unapproved work never lands in the bill.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  try {
    const [jo, history, tasks, parts, mechanics] = await Promise.all([
      db.query(`SELECT status::text FROM job_orders WHERE id = $1`, [jobOrderId]),
      getRoadTestHistory(jobOrderId),
      // Service tasks — what a failed test can send back to the floor.
      db.query(
        `SELECT id, task_title, task_status::text, completion_photo_url, rework_count
         FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status <> 'cancelled' ORDER BY id`,
        [jobOrderId],
      ),
      // Installed parts — what a failed test can flag for warranty replacement.
      db.query(
        `SELECT p.id, p.description, p.part_number, p.quantity, s.service_name
         FROM job_order_parts p
         JOIN job_order_services jos ON jos.id = p.job_order_service_id
         JOIN services s ON s.id = jos.service_id
         WHERE p.job_order_id = $1 AND p.status IN ('received', 'installed', 'in_stock') AND p.is_warranty_replacement IS NOT TRUE
         ORDER BY p.id`,
        [jobOrderId],
      ),
      db.query(`SELECT id, full_name FROM employees WHERE role = 'mechanic' AND status = 'active' ORDER BY full_name`),
    ])
    if (jo.rows.length === 0) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })

    const serviceTasks = tasks.rows
    const allServicesDone = serviceTasks.length > 0 && serviceTasks.every((t) => t.task_status === 'completed')

    return NextResponse.json({
      success: true,
      status: jo.rows[0].status,
      allServicesDone,
      current: currentAttempt(history),
      history,
      tasks: serviceTasks,
      parts: parts.rows,
      mechanics: mechanics.rows,
    })
  } catch (error) {
    console.error('Road test GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// Multipart so pass/fail can carry a photo. Fields:
//   action: 'start' | 'pass' | 'fail'
//   start: testerId
//   pass : notes?, photo?
//   fail : notes (required), reworkTaskIds (JSON array, at least one), failedPartIds? (JSON array), photo?
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  const form = await request.formData()
  const action = String(form.get('action') ?? '')

  try {
    const history = await getRoadTestHistory(jobOrderId)
    const open = currentAttempt(history)

    if (action === 'start') {
      const testerId = Number(form.get('testerId'))
      if (!testerId) return NextResponse.json({ success: false, message: 'Pick who is driving the test' }, { status: 400 })
      if (open) return NextResponse.json({ success: false, message: 'A road test is already in progress' }, { status: 409 })

      // start_road_test raises if any task is unfinished or a test is open.
      const r = await db.query(`SELECT * FROM start_road_test($1, $2)`, [jobOrderId, testerId])
      const attemptNo = r.rows[0]?.attempt_no ?? history.length + 1
      await notifyCustomer({
        jobOrderId, entityType: 'road_tests', entityId: r.rows[0]?.road_test_id ?? 0, event: 'road_test_started',
        title: 'Road Test Started',
        message: `All services on your vehicle are done (Job Order #JO-${jobOrderId}). It's now out on a road test${attemptNo > 1 ? ` (attempt ${attemptNo})` : ''} to confirm the repairs hold up before release.`,
        employeeId: testerId,
      })
      return NextResponse.json({ success: true, roadTestId: r.rows[0]?.road_test_id, attemptNo })
    }

    if (!open) return NextResponse.json({ success: false, message: 'No road test is in progress' }, { status: 409 })

    const notes = String(form.get('notes') ?? '').trim()
    const photo = form.get('photo')
    let photoUrl: string | null = null
    if (photo instanceof File && photo.size > 0) {
      if (!photo.type.startsWith('image/')) return NextResponse.json({ success: false, message: 'Only image files are allowed' }, { status: 415 })
      if (photo.size > 5 * 1024 * 1024) return NextResponse.json({ success: false, message: 'Photo must be under 5MB' }, { status: 413 })
      photoUrl = await uploadRoadTestPhoto(String(jobOrderId), open.id, photo)
    }

    if (action === 'pass') {
      await db.query(`SELECT pass_road_test($1, $2, $3)`, [open.id, notes || null, photoUrl])
      await notifyCustomer({
        jobOrderId, entityType: 'road_tests', entityId: open.id, event: 'road_test_passed',
        title: 'Road Test Passed — Ready for Release',
        message: `Your vehicle passed its road test (Job Order #JO-${jobOrderId}). The service is complete; your final bill is ready on the tracker.`,
      })
      return NextResponse.json({ success: true, result: 'pass' })
    }

    if (action === 'fail') {
      if (!notes) return NextResponse.json({ success: false, message: 'Describe what failed' }, { status: 400 })
      const reworkTaskIds = JSON.parse(String(form.get('reworkTaskIds') ?? '[]')).map(Number).filter(Boolean)
      const failedPartIds = JSON.parse(String(form.get('failedPartIds') ?? '[]')).map(Number).filter(Boolean)
      if (reworkTaskIds.length === 0) return NextResponse.json({ success: false, message: 'Tick at least one service to redo' }, { status: 400 })

      await db.query(`SELECT fail_road_test($1, $2, $3::int[], $4::int[], $5)`, [open.id, notes, reworkTaskIds, failedPartIds, photoUrl])
      await notifyCustomer({
        jobOrderId, entityType: 'road_tests', entityId: open.id, event: 'road_test_failed',
        title: 'Road Test: More Work Needed',
        message: `The road test on your vehicle (Job Order #JO-${jobOrderId}) showed ${reworkTaskIds.length} service${reworkTaskIds.length === 1 ? '' : 's'} need${reworkTaskIds.length === 1 ? 's' : ''} redoing${failedPartIds.length ? `, and ${failedPartIds.length} part${failedPartIds.length === 1 ? '' : 's'} will be replaced under warranty at no charge` : ''}. Work continues — no extra cost to you.`,
      })
      return NextResponse.json({ success: true, result: 'fail' })
    }

    return NextResponse.json({ success: false, message: 'action must be start, pass or fail' }, { status: 400 })
  } catch (error) {
    // Jubert's functions RAISE with a readable message (unfinished tasks, no
    // test open, …) — pass it through instead of a generic 500.
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Road test POST error:', error)
    const known = /Cannot start road test|already in progress|not in progress|requires at least one/i.test(msg)
    return NextResponse.json({ success: false, message: known ? msg : 'Internal server error', debug: msg }, { status: known ? 409 : 500 })
  }
}
