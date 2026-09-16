// jobOrderBill.ts — the one place that says what a job order costs and what
// has been paid. Server-side only (uses db).
//
// job_orders.actual_grand_total and job_orders.balance exist in the schema but
// nothing ever writes them, so they read 0.00 on every job. Computing live
// from the line items and verified payments is the only number that's true.
// (Flagged to Jubert — either completion should write those columns, or they
// should go.)

import { db } from '@/lib/db'

export interface BillPayment {
  id: number
  payment_method: string
  payment_channel: string | null
  reference_number: string | null
  proof_of_payment_image: string | null
  amount_paid: number
  payment_date: string
  verification_status: 'pending' | 'verified' | 'rejected' | 'refunded'
}

export interface JobOrderBill {
  total: number      // services + parts
  paid: number       // sum of verified payments
  balance: number    // total - paid, never below 0
  // The most recent payment row of any status — what the customer sees as
  // "your last payment" and what the admin is asked to verify.
  latestPayment: BillPayment | null
}

export async function getJobOrderBill(jobOrderId: number): Promise<JobOrderBill> {
  const [totals, latest] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COALESCE(SUM(actual_amount), 0) FROM job_order_services WHERE job_order_id = $1)
       + (SELECT COALESCE(SUM(total_retail_amount), 0) FROM job_order_parts WHERE job_order_id = $1) AS total,
         (SELECT COALESCE(SUM(amount_paid), 0) FROM payments
           WHERE job_order_id = $1 AND verification_status = 'verified') AS paid`,
      [jobOrderId],
    ),
    db.query(
      `SELECT id, payment_method::text, payment_channel, reference_number, proof_of_payment_image,
              amount_paid, payment_date::text, verification_status::text
       FROM payments
       WHERE job_order_id = $1
       ORDER BY payment_date DESC, id DESC
       LIMIT 1`,
      [jobOrderId],
    ),
  ])

  const total = Number(totals.rows[0]?.total ?? 0)
  const paid = Number(totals.rows[0]?.paid ?? 0)
  const row = latest.rows[0]

  return {
    total,
    paid,
    balance: Math.max(0, Math.round((total - paid) * 100) / 100),
    latestPayment: row ? { ...row, amount_paid: Number(row.amount_paid) } : null,
  }
}
