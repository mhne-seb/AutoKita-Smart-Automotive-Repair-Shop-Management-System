import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getJobOrderBill } from '@/lib/jobOrderBill'
import { notifyCustomer } from '@/lib/customerNotify'
import { signFileUrls } from '@/lib/storage'

// The Billing stage (after Testing): what the job costs, what's been paid,
// the admin's verification of each payment, and the hand-over. Reads go
// through lib/jobOrderBill so the numbers match the customer's screen.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  const { id } = await params
  const jobOrderId = Number(id)
  try {
    const [jo, bill, payments, services, parts, voucherRes] = await Promise.all([
      db.query(
        `SELECT jo.status::text, jo.completed_at::text, jo.released_at::text,
                u.first_name, u.last_name, u.contact_number
         FROM job_orders jo JOIN users u ON u.id = jo.user_id WHERE jo.id = $1`,
        [jobOrderId],
      ),
      getJobOrderBill(jobOrderId),
      db.query(
        `SELECT p.id, p.payment_method::text, p.payment_channel, p.reference_number, p.proof_of_payment_image,
                p.amount_paid, p.payment_date::text, p.verification_status::text,
                COALESCE(p.payment_date >= (
                  SELECT MAX(sal.action_date) AT TIME ZONE 'Asia/Manila'
                    FROM system_audit_logs sal
                    JOIN retention_offers ro ON ro.id = sal.entity_id
                   WHERE sal.entity_type = 'retention_offers'
                     AND sal.new_values LIKE '{"event":"voucher_applied"%'
                     AND ro.claimed_on_job_order_id = p.job_order_id
                     AND ro.is_claimed = true
                ), false) AS voucher_applied
           FROM payments p
          WHERE p.job_order_id = $1
          ORDER BY p.payment_date DESC, p.id DESC`,
        [jobOrderId],
      ),
      db.query(
        `SELECT s.service_name AS name, jos.actual_amount AS amount, jos.finding_id
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = $1 ORDER BY jos.id`,
        [jobOrderId],
      ),
      db.query(
        `SELECT id, description AS name, part_number, quantity, retail_unit_price, total_retail_amount, is_warranty_replacement, warranty_months
         FROM job_order_parts WHERE job_order_id = $1 ORDER BY id`,
        [jobOrderId],
      ),
      db.query(
        `SELECT promo_code, discount_applied::float AS discount_applied
           FROM retention_offers
          WHERE claimed_on_job_order_id = $1 AND is_claimed = true
          ORDER BY id DESC LIMIT 1`,
        [jobOrderId],
      ),
    ])
    const h = jo.rows[0]
    if (!h) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })

    const proofs = await signFileUrls(payments.rows.map((p) => p.proof_of_payment_image))
    payments.rows.forEach((p, i) => { p.proof_of_payment_image = proofs[i] })

    return NextResponse.json({
      success: true,
      status: h.status,
      completedAt: h.completed_at,
      releasedAt: h.released_at,
      customer: { name: [h.first_name, h.last_name].filter(Boolean).join(' '), phone: h.contact_number ?? '' },
      bill: { total: bill.total, paid: bill.paid, balance: bill.balance },
      payments: payments.rows.map((p) => ({ ...p, amount_paid: Number(p.amount_paid), voucher_applied: Boolean(p.voucher_applied) })),
      services: services.rows.map((s) => ({ name: s.name, amount: Number(s.amount ?? 0), addedMidService: s.finding_id != null })),
      parts: parts.rows.map((p) => ({
        id: p.id, name: p.name, partNo: p.part_number, qty: Number(p.quantity ?? 1),
        unitPrice: Number(p.retail_unit_price ?? 0), amount: Number(p.total_retail_amount ?? 0),
        warranty: Boolean(p.is_warranty_replacement), warranty_months: p.warranty_months,
      })),
      voucher: voucherRes.rows[0] ?? null,
    })
  } catch (error) {
    console.error('Billing GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}

// action: 'record_cash' { amount }  — customer paid at the counter; the admin
//                                     is the verifier, so it's verified at once.
//         'release'                — hand the vehicle back; only at ₱0 balance.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  const { id } = await params
  const jobOrderId = Number(id)
  const body = await request.json().catch(() => ({}))
  try {
    const jo = await db.query(`SELECT status::text FROM job_orders WHERE id = $1`, [jobOrderId])
    const status = jo.rows[0]?.status
    if (!status) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })

    if (body.action === 'record_cash') {
      const amount = Number(body.amount)
      if (!(amount > 0)) return NextResponse.json({ success: false, message: 'Enter the amount received' }, { status: 400 })
      const bill = await getJobOrderBill(jobOrderId)
      if (amount > bill.balance + 0.005) {
        return NextResponse.json({ success: false, message: `That's more than the balance (₱${bill.balance.toLocaleString('en-PH')})` }, { status: 400 })
      }
      const ins = await db.query(
        `INSERT INTO payments (job_order_id, payment_method, amount_paid, payment_date, verification_status, payment_channel)
         VALUES ($1, 'cash', $2, NOW(), 'verified', 'Cash at counter') RETURNING id`,
        [jobOrderId, amount],
      )
      await notifyCustomer({
        jobOrderId, entityType: 'payments', entityId: ins.rows[0].id, event: 'payment_recorded',
        title: 'Payment Received',
        message: `We received your cash payment of ₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })} for Job Order #JO-${jobOrderId}. Thank you!`,
      })
      return NextResponse.json({ success: true, paymentId: ins.rows[0].id })
    }

    if (body.action === 'release') {
      if (status !== 'completed') return NextResponse.json({ success: false, message: 'Only a completed job order can be released' }, { status: 409 })
      const bill = await getJobOrderBill(jobOrderId)
      if (bill.balance > 0) return NextResponse.json({ success: false, message: `Balance of ₱${bill.balance.toLocaleString('en-PH')} is still unpaid` }, { status: 409 })

      const warrantyByPart = (body.warrantyByPart ?? {}) as Record<string, any>

      const partsRes = await db.query(`SELECT id, warranty_months, is_warranty_replacement FROM job_order_parts WHERE job_order_id = $1`, [jobOrderId])
      const dbParts = partsRes.rows
      
      const finalWarrantyByPart: Record<number, number> = {}

      for (const dbPart of dbParts) {
        if (dbPart.is_warranty_replacement) continue

        const pIdStr = String(dbPart.id)
        let finalVal = dbPart.warranty_months
        if (pIdStr in warrantyByPart) {
          const clientVal = warrantyByPart[pIdStr]
          if (typeof clientVal !== 'number' || !Number.isInteger(clientVal) || clientVal < 0 || clientVal > 60) {
            return NextResponse.json({ success: false, message: 'Warranty must be a whole number between 0 and 60.' }, { status: 400 })
          }
          finalVal = clientVal
        }

        if (finalVal === null) {
          return NextResponse.json({ success: false, message: 'Every part must have an explicit warranty choice.' }, { status: 400 })
        }

        if (dbPart.warranty_months !== null && finalVal < dbPart.warranty_months) {
          return NextResponse.json({ success: false, message: `Cannot lower a quoted warranty term.` }, { status: 400 })
        }

        finalWarrantyByPart[dbPart.id] = finalVal
      }

      for (const pIdStr of Object.keys(warrantyByPart)) {
        const pId = Number(pIdStr)
        const dbPart = dbParts.find(p => p.id === pId)
        if (!dbPart || dbPart.is_warranty_replacement) {
          return NextResponse.json({ success: false, message: 'Invalid part ID provided.' }, { status: 400 })
        }
      }

      const client = await db.connect()
      try {
        await client.query('BEGIN')
        for (const [partIdStr, m] of Object.entries(finalWarrantyByPart)) {
          const partId = Number(partIdStr)
          await client.query(`UPDATE job_order_parts SET warranty_months = $1::int WHERE id = $2::int AND job_order_id = $3::int`, [m, partId, jobOrderId])
          
          if (!(m > 0)) continue
          const part = await client.query(
            `SELECT description, part_number FROM job_order_parts WHERE id = $1 AND job_order_id = $2`,
            [partId, jobOrderId],
          )
          const row = part.rows[0]
          if (!row) continue
          const coverage = [row.part_number, row.description].filter(Boolean).join(' — ')
          await client.query(
            `INSERT INTO warranties (job_order_id, job_order_part_id, coverage_description, start_date, expiration_date, status)
             VALUES ($1, $2, $3, CURRENT_DATE, CURRENT_DATE + ($4 || ' months')::interval, 'active'::warranty_status)`,
            [jobOrderId, partId, coverage, m],
          )
        }
        // advance_job_order_stage stamps released_at.
        await client.query(`SELECT advance_job_order_stage($1, 'released'::job_orders_status)`, [jobOrderId])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
      await notifyCustomer({
        jobOrderId, entityType: 'job_orders', entityId: jobOrderId, event: 'vehicle_released',
        title: 'Vehicle Released',
        message: `Your vehicle has been released (Job Order #JO-${jobOrderId}). Your service report and warranty details are on your Completed page. Thank you for choosing us!`,
      })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, message: 'action must be record_cash or release' }, { status: 400 })
  } catch (error) {
    console.error('Billing POST error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) }, { status: 500 })
  }
}
