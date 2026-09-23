// databaseController — Admin Database Administration page's audit logs.

export interface AuditDiff {
  field: string
  from: string
  to: string
}

export interface TicketAcceptanceInfo {
  ticketId: number
  acceptedBy: string
  acceptedByEmployeeId?: number | null
  assignedMechanic?: string
  assignedMechanicId?: number | null
  jobOrderId?: number | null
  summary?: string
}

export interface AuditLogEntry {
  id: string
  rawId: number
  user: string
  employee: string
  employeeRole: string
  employeeId: number | null
  userId: number | null
  action: string
  rawAction: string
  entityType: string
  rawEntityType: string
  entityId: string
  rawEntityId: number
  date: string
  time: string
  fullDate: string
  oldValues: string | null
  newValues: string | null
  diff: AuditDiff[]
  ticketAcceptance?: TicketAcceptanceInfo | null
}

export async function getAuditLogs(): Promise<AuditLogEntry[]> {
  try {
    const res = await fetch('/api/admin/database')
    const data = await res.json()
    if (data.success && Array.isArray(data.entries)) {
      return data.entries
    }
    return []
  } catch (err) {
    console.error('getAuditLogs error:', err)
    return []
  }
}
