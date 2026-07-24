// serviceProgressController — now backed by the real "service_progress_tasks"
// table instead of src/data/serviceProgress.ts.

import type { ServiceProgressData, ServiceSection, ServiceTask, TaskStatus } from '@/data/types'

// UI section ids use a hyphen ('in-progress'), the database enum uses an
// underscore ('in_progress') — this bridges the two.
const SECTION_ID_MAP: Record<string, string> = {
  received: 'received',
  inspecting: 'inspecting',
  quotation: 'quotation',
  in_progress: 'in-progress',
  complete: 'complete',
}

const SECTION_TITLES: Record<string, string> = {
  received: 'Received',
  inspecting: 'Inspecting',
  quotation: 'Quotation',
  'in-progress': 'In Progress',
  complete: 'Complete',
}

// Keeps sections in a consistent left-to-right order regardless of what
// order rows come back from the database in.
const SECTION_ORDER = ['received', 'inspecting', 'quotation', 'in-progress', 'complete']

// The database only stores 'pending' | 'in_progress' | 'completed'.
// The UI expects 'pending' | 'active' | 'completed'.
function mapDbTaskStatus(dbStatus: string): TaskStatus {
  if (dbStatus === 'completed') return 'completed'
  if (dbStatus === 'in_progress') return 'active'
  return 'pending'
}

function formatTaskTime(completedAt: string | null): string {
  if (!completedAt) return '—'
  return new Date(completedAt).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/**
 * Fetches the service progress checklist for a job order from the real
 * database, grouped into the same section shape the UI expects.
 *
 * Note: dummy data assigns tasks to job orders randomly, so a given job
 * order may only have a few tasks total rather than a full checklist across
 * all 5 sections — that's expected with random seed data, not a bug.
 */
export async function getServiceProgressById(jobOrderId: string): Promise<ServiceProgressData | undefined> {
  const res = await fetch(`/api/job-orders/${jobOrderId}/progress`)
  const json = await res.json()

  if (!json.success) return undefined

  const rows: any[] = json.data

  // Group raw rows by section
  const sectionMap = new Map<string, ServiceTask[]>()
  for (const row of rows) {
    const sectionId = SECTION_ID_MAP[row.section_id] ?? row.section_id
    const task: ServiceTask = {
      id: String(row.id),
      title: row.task_title,
      note: row.note ?? '',
      time: formatTaskTime(row.completed_at),
      status: mapDbTaskStatus(row.task_status),
    }
    if (!sectionMap.has(sectionId)) sectionMap.set(sectionId, [])
    sectionMap.get(sectionId)!.push(task)
  }

  // Build sections in a fixed order, skipping ones with no tasks at all so
  // the UI doesn't show empty headers for sections this job order has no data for.
  const sections: ServiceSection[] = SECTION_ORDER.filter((id) => sectionMap.has(id)).map((id) => ({
    id,
    title: SECTION_TITLES[id],
    tasks: sectionMap.get(id)!,
  }))

  const quotationTasks = sectionMap.get('quotation') ?? []
  const quotationConfirmed = quotationTasks.length > 0 && quotationTasks.every((t) => t.status === 'completed')

  return {
    jobOrderId,
    sections,
    quotationConfirmed,
  }
}

export async function getServiceProgressForJobOrder(jobOrderId: string): Promise<ServiceProgressData | null> {
  return (await getServiceProgressById(jobOrderId)) ?? null
}