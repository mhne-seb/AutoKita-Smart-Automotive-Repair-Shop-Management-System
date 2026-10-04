
import { db } from '@/lib/db'

export async function afterTaskFinished(jobOrderId: number): Promise<{ allServicesDone: boolean }> {
  const { rows } = await db.query(
    `SELECT task_status FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status <> 'cancelled'`,
    [jobOrderId],
  )
  const allServicesDone = rows.length > 0 && rows.every((t) => t.task_status === 'completed')
  return { allServicesDone }
}
