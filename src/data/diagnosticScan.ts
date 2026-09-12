// diagnosticScan.ts — the shop's OBD-II scanner policy, in one place.
//
// Using the scanner costs the customer a fixed fee whether or not they go
// ahead with repairs, so the customer has to be told and has to agree BEFORE
// the ticket is submitted. Which booking categories trigger it is business
// policy, not something to infer — edit the set below when the shop changes
// its mind. Categories not listed never prompt for the fee at booking; if a
// mechanic later decides a scan is needed anyway, that becomes a separate
// additional-service approval.

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

export const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
