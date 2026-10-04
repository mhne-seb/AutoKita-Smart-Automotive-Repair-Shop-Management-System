
export const DIAGNOSTIC_SCAN_FEE = 1500

// Matches services.service_name — the row is seeded by
// sql/Other/migration_add_obd2_scan_service.sql.
export const DIAGNOSTIC_SCAN_SERVICE_NAME = 'OBD-II Diagnostic Scan'

// Must match the labels in the booking form's CATEGORIES list exactly.
export const DIAGNOSTIC_SCAN_CATEGORIES: ReadonlySet<string> = new Set([
  'Engine Diagnostics',
  'General Maintenance',
])

export function requiresDiagnosticScan(category: string | null | undefined): boolean {
  return Boolean(category) && DIAGNOSTIC_SCAN_CATEGORIES.has(category as string)
}

// The scan itself happens during inspection, before the repair stage even
// starts — so unlike a real repair task, it has nothing to "schedule" a
// mechanic and date for. Same idea as roadTest.ts's isRoadTest().
export function isDiagnosticScanTask(task: { title: string } | { task_title: string }): boolean {
  const title = 'title' in task ? task.title : task.task_title
  return title === DIAGNOSTIC_SCAN_SERVICE_NAME
}

export const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
