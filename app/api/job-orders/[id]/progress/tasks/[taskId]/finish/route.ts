import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadTaskPhoto } from '@/lib/storage'
import { afterTaskFinished } from '@/lib/taskCompletion'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// The ONLY way a task becomes 'completed'. Multipart because the shop's rule
// is that finishing a task means showing the finished work — a photo is
// required, no exceptions (the road test included). After the task is
// marked done, the job-order-level consequences run (road test creation,
// job completion) — see lib/taskCompletion.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; taskId: string }> }) {
  const { id, taskId } = await params
  const jobOrderId = Number(id)
  const form = await request.formData()
  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'A photo of the finished work is required' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ success: false, message: 'Photo must be a JPEG, PNG or WebP image' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, message: 'Photo must be under 5MB' }, { status: 413 })
  }

  try {
    const task = await db.query(
      `SELECT task_status, mechanic_id, scheduled_date FROM service_progress_tasks WHERE id = $1::int AND job_order_id = $2::int`,
      [taskId, jobOrderId],
    )
    const row = task.rows[0]
    if (!row) return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 })
    if (row.task_status === 'completed') {
      return NextResponse.json({ success: false, message: 'This task is already finished' }, { status: 409 })
    }
    if (row.task_status !== 'in_progress') {
      return NextResponse.json({ success: false, message: 'Start the task before finishing it' }, { status: 409 })
    }

    const photoUrl = await uploadTaskPhoto(String(jobOrderId), String(taskId), file)

    // Direct update rather than schedule_service_task_with_status(): that
    // function re-sets schedule/mechanic/note, and none of those change here.
    await db.query(
      `UPDATE service_progress_tasks
       SET task_status = 'completed', completed_at = NOW(), completion_photo_url = $1
       WHERE id = $2::int`,
      [photoUrl, taskId],
    )

    const outcome = await afterTaskFinished(jobOrderId)
    return NextResponse.json({ success: true, photoUrl, ...outcome })
  } catch (error) {
    console.error('Task finish error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
