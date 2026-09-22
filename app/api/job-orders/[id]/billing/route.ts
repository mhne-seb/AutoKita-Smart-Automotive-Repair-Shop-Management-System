import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getJobOrderBill } from '@/lib/jobOrderBill'
import { notifyCustomer } from '@/lib/customerNotify'

// The Billing stage (after Testing): what the job costs, what's been paid,
// the admin's verification of each payment, and the hand-over. Reads go
// through lib/jobOrderBill so the numbers match the customer's screen.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const jobOrderId = Number(id)
  try {
    const [jo, bill, payments, services, parts] = await Promise.all([
      db.query(
        `SELECT jo.status::text, jo.completed_at::text, jo.released_at::text,
                u.first_name, u.last_name, u.contact_number
         FROM job_orders jo JOIN users u ON u.id = jo.user_id WHERE jo.id = $1`,
        [jobOrderId],
      ),
      getJobOrderBill(jobOrderId),
      db.query(
        `SELECT id, payment_method::text, payment_channel, reference_number, proof_of_payment_image,
                amount_paid, payment_date::text, verification_status::text
         FROM payments WHERE job_order_id = $1 ORDER BY payment_date DESC, id DESC`,
        [jobOrderId],
      ),
      db.query(
        `SELECT s.service_name AS name, jos.actual_amount AS amount, jos.finding_id
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = $1 ORDER BY jos.id`,
        [jobOrderId],
      ),
      db.query(
        `SELECT description AS name, part_number, quantity, retail_unit_price, total_retail_amount, is_warranty_replacement
         FROM job_order_parts WHERE job_order_id = $1 ORDER BY id`,
        [jobOrderId],
      ),
    ])
    const h = jo.rows[0]
    if (!h) return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })

    return NextResponse.json({
      success: true,
      status: h.status,
      completedAt: h.completed_at,
      releasedAt: h.released_at,
      customer: { name: [h.first_name, h.last_name].filter(Boolean).join(' '), phone: h.contact_number ?? '' },
      bill: { total: bill.total, paid: bill.paid, balance: bill.balance },
      payments: payments.rows.map((p) => ({ ...p, amount_paid: Number(p.amount_paid) })),
      services: services.rows.map((s) => ({ name: s.name, amount: Number(s.amount ?? 0), addedMidService: s.finding_id != null })),
      parts: parts.rows.map((p) => ({
        name: p.name, partNo: p.part_number, qty: Number(p.quantity ?? 1),
        unitPrice: Number(p.retail_unit_price ?? 0), amount: Number(p.total_retail_amount ?? 0),
        warranty: Boolean(p.is_warranty_replacement),
      })),
    })
  } catch (error) {
    console.error('Billing GET error:', error)
    return NextResponse.json({ success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}

// action: 'record_cash' { amount }  — customer paid at the counter; the admin
//                                     is the verifier, so it's verified at once.
//         'release'                — hand the vehicle back; only at ₱0 balance.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      // advance_job_order_stage stamps released_at.
      await db.query(`SELECT advance_job_order_stage($1, 'released'::job_orders_status)`, [jobOrderId])
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
    return NextResponse.json({ success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
