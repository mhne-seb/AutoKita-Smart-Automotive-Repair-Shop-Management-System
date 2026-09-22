// taskCompletion.ts — what happens to the JOB ORDER after one of its tasks is
// finished. Server-side only, called by the task-finish route.
//
// Finishing the last service task does NOT complete the job. Every car is
// road-tested first (the Testing stage — see lib/roadTest.ts and the
// road_tests table): the job goes 'in_progress' -> 'testing' when the shop
// starts the test, and only pass_road_test() makes it 'completed'. All this
// function does is report whether the services are done so the UI can offer
// "Proceed to Testing".

import { db } from '@/lib/db'

export async function afterTaskFinished(jobOrderId: number): Promise<{ allServicesDone: boolean }> {
  const { rows } = await db.query(
    `SELECT task_status FROM service_progress_tasks WHERE job_order_id = $1 AND section_id = 'in_progress' AND task_status <> 'cancelled'`,
    [jobOrderId],
  )
  const allServicesDone = rows.length > 0 && rows.every((t) => t.task_status === 'completed')
  return { allServicesDone }
}
