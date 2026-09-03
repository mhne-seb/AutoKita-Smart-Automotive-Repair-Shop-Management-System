// src/controllers/diagnosticAssistantController.ts
// ---------------------------------------------------------------------------
// Fetches live job order session data from /api/chat/admin/job-session.
// All static mock data has been removed — every value comes from the DB.
// ---------------------------------------------------------------------------

export type { JobOrderSummary, JobOrderSession, JobOrderService, JobOrderPart, InspectionNote }
  from '@/types/jobOrder';

export type DiagnosticMsg =
  | { id: string; role: 'bot';  kind: 'text'; text: string; time: string }
  | { id: string; role: 'user'; kind: 'text'; text: string; time: string }

export type FaultSeverity = 'critical' | 'warning' | 'info'

export const severityChip: Record<FaultSeverity, string> = {
  critical: 'bg-rose-600 text-white',
  warning:  'bg-amber-500 text-white',
  info:     'border border-slate-200 bg-slate-100 text-slate-600',
}

export const severityDot: Record<FaultSeverity, string> = {
  critical: 'bg-rose-500',
  warning:  'bg-amber-500',
  info:     'bg-slate-400',
}

export const peso = (n: number | null | undefined): string => {
  if (n == null) return '—';
  return `₱${Number(n).toLocaleString('en-PH')}`;
}

/**
 * Search or browse job orders for the picker dropdown.
 * Returns the 20 most recent JOs when query is empty.
 */
export async function searchJobOrders(query: string): Promise<import('@/types/jobOrder').JobOrderSummary[]> {
  const params = new URLSearchParams({ limit: '20' });
  if (query.trim()) params.set('search', query.trim());
  const res = await fetch(`/api/chat/admin/job-session?${params}`);
  if (!res.ok) throw new Error('Failed to load job orders');
  const data = await res.json();
  return data.results ?? [];
}

/**
 * Load the full session payload for a specific job order.
 */
export async function getDiagnosticSession(
  jobOrderId: number,
): Promise<import('@/types/jobOrder').JobOrderSession> {
  const res = await fetch(`/api/chat/admin/job-session?job_order_id=${jobOrderId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? 'Failed to load job order session');
  }
  return res.json();
}

/**
 * Returns context-aware suggested prompts based on job order status.
 */
export function getSuggestedPrompts(status: string): string[] {
  const base = ['Summarize this job order', 'Check part compatibility for this vehicle'];
  const byStatus: Record<string, string[]> = {
    inspecting:               ['What issues were found in inspection?', 'Suggest services for these findings'],
    pending_customer_approval:['What services are awaiting approval?', 'Explain the quotation to the customer'],
    in_progress:              ['What services are still pending?', 'Parts status for this JO?'],
    waiting_on_parts:         ['Which parts are we waiting for?', 'Alternative parts for this vehicle?'],
    completed:                ['What was done in this job order?', 'Any follow-up services recommended?'],
    released:                 ['Final summary of work done', 'Warranty coverage for services performed?'],
  };
  return [...(byStatus[status] ?? ['What is the current status?', 'What needs to be done next?']), ...base];
}
