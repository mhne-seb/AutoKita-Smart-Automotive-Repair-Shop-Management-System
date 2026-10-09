import { db } from '@/lib/db'

// The one rule for who may use the admin site. Keep it in this single place.
export const STAFF_ACCESS_SQL = "can_sign_in = true AND status::text = 'active'"

// Small cache so the admin pages that poll every 30 seconds do not hit the database each time.
// Only "yes" answers are cached, for 30 seconds; a "no" is always re-checked.
const yes = new Map<number, number>()
const TTL_MS = 30_000

export async function staffMayUseAdminSite(employeeId: number): Promise<boolean> {
  const hit = yes.get(employeeId)
  if (hit && hit > Date.now()) return true
  try {
    const { rowCount } = await db.query(`SELECT 1 FROM employees WHERE id = $1 AND ${STAFF_ACCESS_SQL}`, [employeeId])
    if (rowCount && rowCount > 0) {
      if (yes.size > 500) yes.clear()
      yes.set(employeeId, Date.now() + TTL_MS)
      return true
    }
    yes.delete(employeeId)
    return false
  } catch (err) {
    console.error('[staffAccess] check failed, denying access:', err)   // fail closed
    return false
  }
}
