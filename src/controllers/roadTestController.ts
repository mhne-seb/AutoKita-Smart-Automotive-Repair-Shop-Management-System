// roadTestController.ts — browser-side calls for the Testing stage.
// One GET for everything the page shows; start/pass/fail post to the same
// route with an action field (multipart, because pass/fail can carry a photo).

import type { RoadTestAttempt } from '@/data/roadTest'

export interface RoadTestData {
  status: string // job_orders.status
  allServicesDone: boolean
  current: RoadTestAttempt | null // the attempt out on the road, if any
  history: RoadTestAttempt[]
  tasks: { id: number; task_title: string; task_status: string; completion_photo_url: string | null; rework_count: number }[]
  parts: { id: number; description: string; part_number: string | null; quantity: number; service_name: string }[]
  mechanics: { id: number; full_name: string }[]
}

type Result = { ok: boolean; message?: string }

export async function getRoadTestData(jobOrderId: string): Promise<RoadTestData | null> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/road-test`, { cache: 'no-store' })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return null
  return json as RoadTestData
}

async function post(jobOrderId: string, form: FormData): Promise<Result> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/road-test`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Something went wrong.' }
  return { ok: true }
}

export function startRoadTest(jobOrderId: string, testerId: number): Promise<Result> {
  const form = new FormData()
  form.set('action', 'start')
  form.set('testerId', String(testerId))
  return post(jobOrderId, form)
}

export function passRoadTest(jobOrderId: string, notes: string, photo: File | null): Promise<Result> {
  const form = new FormData()
  form.set('action', 'pass')
  form.set('notes', notes)
  if (photo) form.set('photo', photo)
  return post(jobOrderId, form)
}

export function failRoadTest(
  jobOrderId: string,
  notes: string,
  reworkTaskIds: number[],
  failedPartIds: number[],
  photo: File | null,
): Promise<Result> {
  const form = new FormData()
  form.set('action', 'fail')
  form.set('notes', notes)
  form.set('reworkTaskIds', JSON.stringify(reworkTaskIds))
  form.set('failedPartIds', JSON.stringify(failedPartIds))
  if (photo) form.set('photo', photo)
  return post(jobOrderId, form)
}
