import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadPaymentProof } from '@/lib/storage'
import { readTransferDetails } from '@/lib/paymentForm'

// Submitted as multipart form-data, not JSON, because a bank/e-wallet
// transfer carries a proof-of-payment screenshot alongside the plain fields.
export async function POST(request: NextRequest) {
  const form = await request.formData()

  const jobOrderId = Number(form.get('jobOrderId'))
  const method = String(form.get('method') ?? '')
  const amount = Number(form.get('amount'))
  let acceptedServiceIds: number[] = []
  try {
    acceptedServiceIds = JSON.parse(String(form.get('acceptedServiceIds') ?? '[]'))
  } catch {
    return NextResponse.json({ error: 'acceptedServiceIds must be a JSON array' }, { status: 400 })
  }

  let declinedServiceIds: number[] = []
  try {
    const raw = form.get('declinedServiceIds')
    if (raw) declinedServiceIds = JSON.parse(String(raw))
  } catch {
    // ignore
  }

  if (!jobOrderId || !method || Number.isNaN(amount) || !Array.isArray(acceptedServiceIds)) {
    return NextResponse.json({ error: 'jobOrderId, method, amount, and acceptedServiceIds are required' }, { status: 400 })
  }

  // "Pay at Shop" is settled in cash at the counter — no proof needed.
  // Anything else is a manually-verified bank/e-wallet transfer: the customer
  // must say which channel they sent to, the reference number, and attach a
  // screenshot as evidence for the admin to check against their own account.
  let dbMethod: 'cash' | 'e_wallet' | 'bank_transfer' = 'cash'
  let channelLabel: string | null = null
  let referenceNumber: string | null = null
  let proofUrl: string | null = null

  if (method !== 'shop') {
    const transfer = readTransferDetails(form)
    if (!transfer.ok) return NextResponse.json({ error: transfer.error }, { status: transfer.status })
    dbMethod = transfer.channel.type
    channelLabel = transfer.channel.label
    referenceNumber = transfer.referenceNumber
    proofUrl = await uploadPaymentProof(String(jobOrderId), transfer.file)
  }

  try {
    const { rows: joRows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (joRows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    // 1. Fetch current services on the job order
    const curRes = await db.query(
      `SELECT jos.id, jos.service_id, s.service_name
       FROM job_order_services jos
       JOIN services s ON s.id = jos.service_id
       WHERE jos.job_order_id = $1`,
      [jobOrderId],
    )
    const currentServices = curRes.rows

    const feeServiceIds = new Set(
      currentServices
        .filter((s) => s.service_name === 'OBD-II Diagnostic Scan')
        .map((s) => Number(s.id)),
    )

    const acceptedSet = new Set<number>(acceptedServiceIds.map(Number))
    const declinedSet = new Set<number>(Array.isArray(declinedServiceIds) ? declinedServiceIds.map(Number) : [])

    const customerAcceptedAll =
      (Array.isArray(declinedServiceIds) && declinedServiceIds.length === 0) ||
      (declinedSet.size === 0 && acceptedSet.size >= currentServices.length)

    let idsToDelete: number[] = []

    if (!customerAcceptedAll && currentServices.length > 0) {
      const currentIds = currentServices.map((s) => Number(s.id))
      const hasDeclinedOverlap = currentIds.some((id) => declinedSet.has(id))
      const hasAcceptedOverlap = currentIds.some((id) => acceptedSet.has(id))

      if (hasDeclinedOverlap) {
        idsToDelete = currentIds.filter((id) => declinedSet.has(id) && !feeServiceIds.has(id))
      } else if (hasAcceptedOverlap) {
        idsToDelete = currentIds.filter((id) => !acceptedSet.has(id) && !feeServiceIds.has(id))
      } else {
        console.warn(
          `[/api/tracking/quotation/payment] Warning: ID desynchronization detected for JO-${jobOrderId}. Client IDs: [${acceptedServiceIds}], Current IDs: [${currentIds}]. Skipping deletion to prevent data loss.`,
        )
      }
    }

    if (idsToDelete.length > 0) {
      await db.query(
        `DELETE FROM job_order_parts
         WHERE job_order_id = $1 AND job_order_service_id IS NOT NULL AND job_order_service_id = ANY($2::int[])`,
        [jobOrderId, idsToDelete],
      )
      await db.query(
        `DELETE FROM job_order_services WHERE job_order_id = $1 AND id = ANY($2::int[])`,
        [jobOrderId, idsToDelete],
      )
    }

    const { rows } = await db.query(
      `INSERT INTO payments
        (job_order_id, payment_method, amount_paid, payment_date, verification_status, payment_channel, reference_number, proof_of_payment_image)
       VALUES ($1, $2::payment_method, $3, NOW(), 'pending', $4, $5, $6)
       RETURNING id`,
      [jobOrderId, dbMethod, amount, channelLabel, referenceNumber, proofUrl]
    )

    // Submitting payment counts as confirming the quotation selection —
    // lock it immediately so it can't be re-picked while payment is pending.
    await db.query(`SELECT set_quotation_approval($1, $2)`, [jobOrderId, true])

    // That also answers the quotation review round. The job order's stage
    // deliberately does NOT move yet — a downpayment has to be verified by
    // the shop before work starts (see the admin verify route).
    const roundRes = await db.query(`SELECT id, customer_approval_status FROM get_pre_diagnostic($1)`, [jobOrderId])
    const round = roundRes.rows[0]
    if (round?.customer_approval_status === 'pending') {
      await db.query(`SELECT update_pre_diagnostic_approval($1, 'approved'::approval_status)`, [round.id])
    }

    return NextResponse.json({ success: true, paymentId: rows[0].id })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
