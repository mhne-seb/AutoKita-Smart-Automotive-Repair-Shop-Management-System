import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getVoucherRule, voucherDiscount, VOUCHER_CODE_PATTERN } from '@/data/voucherRules'
import { requireCustomer } from '@/lib/authGuard'
import { getJobOrderBill } from '@/lib/jobOrderBill'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const jobOrderId = parseInt(body.jobOrderId, 10)
    if (!jobOrderId || jobOrderId <= 0) {
      return NextResponse.json({ error: 'jobOrderId is required' }, { status: 400 })
    }

    const code = String(body.code ?? '').trim()
    if (!VOUCHER_CODE_PATTERN.test(code)) {
      return NextResponse.json({ error: 'Enter the code exactly as shown in your offer.' }, { status: 400 })
    }

    const guard = await (body.userId ? requireCustomer(Number(body.userId)) : requireCustomer())
    if (!guard.ok) return guard.response
    const userId = guard.session.userId

    const client = await db.connect()
    let applied: { discount: number; service: string } | null = null
    try {
      await client.query('BEGIN')
      const refuse = async (status: number, error: string) => {
        await client.query('ROLLBACK')
        return NextResponse.json({ error }, { status })
      }

      // 4. Lock the job order so two requests cannot run at once:
      const jobOrderRes = await client.query(
        `SELECT user_id, status FROM job_orders WHERE id = $1 FOR UPDATE`,
        [jobOrderId]
      )
      if (jobOrderRes.rows.length === 0) return await refuse(404, 'Job order not found')
      const jobOrder = jobOrderRes.rows[0]
      if (jobOrder.user_id !== userId) return await refuse(403, 'Forbidden')
      if (jobOrder.status !== 'completed') return await refuse(409, 'Vouchers can be applied on the Billing page, before the vehicle is released.')

      // 5. Find the voucher, for THIS customer only:
      const voucherRes = await client.query(
        `SELECT id, rule_key, is_claimed, (expiration_date IS NOT NULL AND expiration_date < CURRENT_DATE) AS expired FROM retention_offers WHERE UPPER(promo_code) = UPPER($1) AND user_id = $2 FOR UPDATE`,
        [code, userId]
      )
      if (voucherRes.rows.length === 0) return await refuse(404, "That code isn't valid for your account. Check the code and try again.")
      const offer = voucherRes.rows[0]
      if (offer.is_claimed) return await refuse(409, 'This voucher was already used.')
      if (offer.expired) return await refuse(409, 'This voucher has expired.')
      const rule = getVoucherRule(offer.rule_key)
      if (!rule) return await refuse(409, "This voucher can't be applied here. Please show it at the shop.")

      // 6. One voucher per job order:
      const existingVoucherRes = await client.query(
        `SELECT 1 FROM retention_offers WHERE claimed_on_job_order_id = $1 AND is_claimed = true LIMIT 1`,
        [jobOrderId]
      )
      if (existingVoucherRes.rows.length > 0) return await refuse(409, 'A voucher was already applied to this job order.')

      // 7. No payment may be waiting:
      const paymentRes = await client.query(
        `SELECT 1 FROM payments WHERE job_order_id = $1 AND verification_status = 'pending' LIMIT 1`,
        [jobOrderId]
      )
      if (paymentRes.rows.length > 0) return await refuse(409, 'You already submitted a payment for this bill. Apply a voucher before paying.')

      // 8. The balance, read on this same connection (same sums as src/lib/jobOrderBill.ts).
      const sums = await client.query(
        `SELECT
           (SELECT COALESCE(SUM(actual_amount), 0) FROM job_order_services WHERE job_order_id = $1)
         + (SELECT COALESCE(SUM(total_retail_amount), 0) FROM job_order_parts WHERE job_order_id = $1) AS total,
           (SELECT COALESCE(SUM(amount_paid), 0) FROM payments
             WHERE job_order_id = $1 AND verification_status = 'verified') AS paid`,
        [jobOrderId],
      )
      const balance = Math.max(0, Math.round((Number(sums.rows[0].total) - Number(sums.rows[0].paid)) * 100) / 100)
      if (balance <= 0) return await refuse(409, 'This bill is already fully paid.')

      // 9. Find the service the voucher is for, the most expensive match first:
      const serviceRes = await client.query(
        `SELECT jos.id, jos.actual_amount, s.service_name
           FROM job_order_services jos
           JOIN services s ON s.id = jos.service_id
          WHERE jos.job_order_id = $1 AND s.service_name = ANY($2::text[]) AND jos.actual_amount > 0
          ORDER BY jos.actual_amount DESC, jos.id ASC
          LIMIT 1
          FOR UPDATE OF jos`,
        [jobOrderId, rule.services]
      )
      if (serviceRes.rows.length === 0) return await refuse(409, `This voucher is for: ${rule.label}. That service is not on this job order.`)
      const row = serviceRes.rows[0]

      // 10. Discount calculation
      const labor = Number(row.actual_amount)
      const discount = Math.min(voucherDiscount(rule, labor), balance)
      if (discount <= 0) return await refuse(409, "This voucher can't be applied to this bill.")

      // 11. Apply it:
      await client.query(
        `UPDATE job_order_services SET actual_amount = actual_amount - $2 WHERE id = $1`,
        [row.id, discount]
      )
      await client.query(
        `UPDATE service_progress_tasks SET price = price - $3 WHERE id = (SELECT id FROM service_progress_tasks WHERE job_order_id = $1 AND task_title = $2 AND price >= $3 ORDER BY price DESC, id ASC LIMIT 1)`,
        [jobOrderId, row.service_name, discount]
      )
      await client.query(
        `UPDATE retention_offers SET is_claimed = true, claimed_on_job_order_id = $2, discount_applied = $3 WHERE id = $1`,
        [offer.id, jobOrderId, discount]
      )
      await client.query(
        `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, old_values, new_values, action_date)
         VALUES ($1, 'status_changed'::audit_action_enum, 'retention_offers', $2, $3, $4, NOW())`,
        [
          userId,
          offer.id,
          JSON.stringify({ service: row.service_name, labor }),
          JSON.stringify({ event: 'voucher_applied', job_order_id: jobOrderId, service: row.service_name, labor: labor - discount, discount })
        ]
      )

      await client.query('COMMIT')
      applied = { discount, service: row.service_name }
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      console.error('[/api/tracking/completed/voucher] error:', err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    } finally {
      client.release()
    }

    // The connection is released. Now it is safe to read the bill for the reply.
    return NextResponse.json({ success: true, ...applied, bill: await getJobOrderBill(jobOrderId) })

  } catch (err) {
    console.error('[/api/tracking/completed/voucher] outer error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
