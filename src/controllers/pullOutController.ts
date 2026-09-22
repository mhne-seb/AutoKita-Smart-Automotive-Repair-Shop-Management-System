// pullOutController.ts — browser-side calls for vehicle pull-out requests
// (paper UC 15). Customer asks / withdraws; admin approves / denies. Reading
// the request happens through the existing progress / tracking loaders.

type Result = { ok: boolean; message?: string }

async function call(url: string, method: string, body: Record<string, unknown>): Promise<Result & { cancelled?: string[]; committed?: string[] }> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json().catch(() => null)
  if (!res.ok || !json?.success) return { ok: false, message: json?.message ?? 'Something went wrong.' }
  return { ok: true, cancelled: json.cancelled, committed: json.committed }
}

/** Customer: ask to take the vehicle back. */
export function requestPullOut(userId: number, jobOrderId: number, reason: string) {
  return call('/api/tracking/in-progress/pull-out', 'POST', { userId, jobOrderId, reason })
}

/** Customer: withdraw a request the shop hasn't answered. */
export function withdrawPullOut(userId: number, jobOrderId: number) {
  return call('/api/tracking/in-progress/pull-out', 'DELETE', { userId, jobOrderId })
}

/** Admin: approve (unstarted tasks cancelled, job goes to Billing) or deny with a note. */
export function decidePullOut(jobOrderId: string, action: 'approve' | 'deny', note: string) {
  return call(`/api/job-orders/${jobOrderId}/pull-out`, 'POST', { action, note })
}
