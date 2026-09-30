export const WARRANTY_NEARING_DAYS = 30

export function effectiveWarrantyStatus(status: string, expirationDate: string | Date | null): string {
  if (status !== 'active' && status !== 'nearing_expiration') {
    return status
  }
  
  if (!expirationDate) return status

  // DATE columns from Postgres reach the code as JS Date objects (pg driver),
  // so string comparison fails if not properly converted.
  let expStr = ''
  if (expirationDate instanceof Date) {
    if (isNaN(expirationDate.getTime())) return status
    expStr = `${expirationDate.getFullYear()}-${String(expirationDate.getMonth() + 1).padStart(2, '0')}-${String(expirationDate.getDate()).padStart(2, '0')}`
  } else if (typeof expirationDate === 'string') {
    expStr = expirationDate.slice(0, 10)
  } else {
    return status
  }
  
  const tzOffset = 8 * 60 * 60 * 1000 // UTC+8
  const todayManila = new Date(Date.now() + tzOffset).toISOString().split('T')[0]

  // Both are plain calendar dates, so whole days apart = difference / one day.
  const daysLeft = Math.round((Date.parse(`${expStr}T00:00:00Z`) - Date.parse(`${todayManila}T00:00:00Z`)) / 86_400_000)
  if (Number.isNaN(daysLeft)) return status

  if (daysLeft < 0) {
    return 'expired'
  }
  // The data dictionary defines 'nearing_expiration' as the signal for retention
  // offers; nothing in the database sets it, so it is worked out here on read.
  if (daysLeft <= WARRANTY_NEARING_DAYS) {
    return 'nearing_expiration'
  }
  return status
}
