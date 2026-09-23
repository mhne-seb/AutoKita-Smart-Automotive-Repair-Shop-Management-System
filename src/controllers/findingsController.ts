// findingsController.ts — browser-side calls for mid-service findings.
// Admin reports one from Service Progress; the customer answers it from the
// In Progress tracking page. Reading findings happens through the existing
// progress / tracking loaders, which include them.

import type { ProposedService, ProposedPart } from '@/data/types'

type Result = { ok: boolean; message?: string }

/** Uploads the finding's photo first; the URL goes with the finding on save. */
export async function uploadFindingPhoto(jobOrderId: string, file: File): Promise<{ ok: boolean; url?: string; message?: string }> {
  const form = new FormData()
  form.set('file', file)
  const res = await fetch(`/api/job-orders/${jobOrderId}/findings/photo`, { method: 'POST', body: form })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not upload the photo.' }
  return { ok: true, url: json.url }
}

/** Admin: report a finding and send it to the customer for approval. */
export async function reportFinding(
  jobOrderId: string,
  input: { taskId: number | null; findings: string; photoUrl: string | null; services: ProposedService[]; parts: ProposedPart[] },
): Promise<Result & { emailed?: boolean }> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/service-findings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not send the finding.' }
  return { ok: true, emailed: json.emailed }
}

/** Customer, step 1 of approving: email me a code. */
export async function requestFindingOtp(userId: number, findingId: number) {
  const res = await fetch('/api/tracking/in-progress/findings/otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, findingId }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false as const, message: json?.message ?? 'Could not send the code.' }
  return { ok: true as const, token: json.token as string, sentTo: json.sentTo as string, expiresMinutes: json.expiresMinutes as number, forWork: json.forWork as string | undefined }
}

/** Customer: approve (with the emailed code) or decline (no code needed). */
export async function respondToFinding(
  userId: number,
  findingId: number,
  approved: boolean,
  otp?: { token: string; code: string },
): Promise<Result> {
  const res = await fetch('/api/tracking/in-progress/findings/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, findingId, approved, otpToken: otp?.token, otpCode: otp?.code }),
  })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Could not save your answer.' }
  return { ok: true }
}
