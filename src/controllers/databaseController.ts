// databaseController — Admin Database Administration page's audit log.

export { auditLog, type AuditLogEntry } from '@/data/mockData'
import { auditLog as _auditLog } from '@/data/mockData'

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getAuditLog() {
  return simulateDelay(_auditLog)
}
