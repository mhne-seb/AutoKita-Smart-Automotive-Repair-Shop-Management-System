import { db } from '@/lib/db'
import { PoolClient } from 'pg'

// Records a customer changing their own account (name, address, password,
// photo) so staff can see it on the Database Administration page. Only the
// fields that actually changed are saved, as "from → to".
//
// A failed log is reported but doesn't undo the customer's save — the change
// itself already went through.
export async function logCustomerAccountChange(
  userId: number,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Promise<void> {
  const changed = Object.keys(newValues).filter((k) => (oldValues[k] ?? null) !== (newValues[k] ?? null))
  if (changed.length === 0) return

  const pickChanged = (values: Record<string, unknown>) =>
    Object.fromEntries(changed.map((k) => [k, values[k] ?? null]))

  try {
    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, old_values, new_values, action_date)
       VALUES ($1, 'updated'::audit_action_enum, 'users', $1, $2, $3, NOW())`,
      [userId, JSON.stringify(pickChanged(oldValues)), JSON.stringify(pickChanged(newValues))],
    )
  } catch (err) {
    console.error('Audit log for customer account change failed:', err)
  }
}

// Records staff changing a customer's details (users or vehicles table).
// This runs on the transaction client and does NOT swallow errors; if the log
// fails, the whole save must roll back.
export async function logStaffCustomerEdit(
  client: PoolClient,
  employeesId: number,
  userId: number,
  entityType: 'users' | 'vehicles',
  entityId: number,
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>,
): Promise<void> {
  const changed = Object.keys(newValues).filter((k) => (oldValues[k] ?? null) !== (newValues[k] ?? null))
  if (changed.length === 0) return

  const pickChanged = (values: Record<string, unknown>) =>
    Object.fromEntries(changed.map((k) => [k, values[k] ?? null]))

  await client.query(
    `INSERT INTO system_audit_logs (employees_id, user_id, action_performed, entity_type, entity_id, old_values, new_values, action_date)
     VALUES ($1, $2, 'updated'::audit_action_enum, $3, $4, $5, $6, NOW())`,
    [employeesId, userId, entityType, entityId, JSON.stringify(pickChanged(oldValues)), JSON.stringify(pickChanged(newValues))],
  )
}
