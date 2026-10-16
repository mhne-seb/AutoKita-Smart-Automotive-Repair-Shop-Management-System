import { db } from '@/lib/db'

// The service mode of a job order as stored in the database ('walk_in' or 'home_service'),
// or null when the job order has no ticket.
export async function getServiceModeValue(jobOrderId: number): Promise<string | null> {
  const { rows } = await db.query(
    `SELECT st.service_mode::text AS service_mode
       FROM job_orders jo
       LEFT JOIN service_tickets st ON st.id = jo.ticket_id
      WHERE jo.id = $1`,
    [jobOrderId],
  )
  return rows[0]?.service_mode ?? null
}
