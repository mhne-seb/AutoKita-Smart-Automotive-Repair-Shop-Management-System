import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { uploadPaymentProof } from '@/lib/storage'
import { readTransferDetails, hasImageSignature, referenceAlreadyUsed, PROOF_NOT_IMAGE_MESSAGE, REFERENCE_USED_MESSAGE } from '@/lib/paymentForm'

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

  if (!Array.isArray(acceptedServiceIds) || !acceptedServiceIds.every(id => Number.isInteger(id))) {
    return NextResponse.json({ error: 'acceptedServiceIds must be an array of integers' }, { status: 400 })
  }
  if (!Array.isArray(declinedServiceIds) || !declinedServiceIds.every(id => Number.isInteger(id))) {
    return NextResponse.json({ error: 'declinedServiceIds must be an array of integers' }, { status: 400 })
  }

  if (!jobOrderId || !method || Number.isNaN(amount) || !Array.isArray(acceptedServiceIds)) {
    return NextResponse.json({ error: 'jobOrderId, method, amount, and acceptedServiceIds are required' }, { status: 400 })
  }

  const guard = await requireCustomer()
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  const ownerCheck = await db.query(
    `SELECT user_id, status, quotation_approved FROM job_orders WHERE id = $1`,
    [jobOrderId]
  )
  if (ownerCheck.rows.length === 0) return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
  const jo = ownerCheck.rows[0]
  if (jo.user_id !== userId) return NextResponse.json({ error: 'Not your account.' }, { status: 403 })
  if (jo.status !== 'pending_customer_approval' || jo.quotation_approved) {
    return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
  }

  const pendingPaymentCheck = await db.query(
    `SELECT 1 FROM payments WHERE job_order_id = $1 AND verification_status = 'pending'`,
    [jobOrderId]
  )
  if (pendingPaymentCheck.rows.length > 0) {
    return NextResponse.json({ error: 'You already sent a payment. Please wait for the shop to confirm it.' }, { status: 409 })
  }

  let dbMethod: 'cash' | 'e_wallet' | 'bank_transfer' = 'cash'
  let channelLabel: string | null = null
  let referenceNumber: string | null = null
  let proofFile: File | null = null

  if (method !== 'shop') {
    const transfer = readTransferDetails(form)
    if (!transfer.ok) return NextResponse.json({ error: transfer.error }, { status: transfer.status })
    if (!(await hasImageSignature(transfer.file))) return NextResponse.json({ error: PROOF_NOT_IMAGE_MESSAGE }, { status: 415 })
    if (await referenceAlreadyUsed(transfer.referenceNumber)) return NextResponse.json({ error: REFERENCE_USED_MESSAGE }, { status: 409 })
    dbMethod = transfer.channel.type
    channelLabel = transfer.channel.label
    referenceNumber = transfer.referenceNumber
    proofFile = transfer.file
  }

  try {
    // 1. Fetch current services on the job order to compute total
    const curRes = await db.query(
      `SELECT jos.id, jos.service_id, jos.actual_amount, s.service_name
       FROM job_order_services jos
       JOIN services s ON s.id = jos.service_id
       WHERE jos.job_order_id = $1`,
      [jobOrderId],
    )
    const currentServices = curRes.rows
    const validServiceIds = new Set(currentServices.map((s) => Number(s.id)))

    acceptedServiceIds = acceptedServiceIds.filter(id => validServiceIds.has(id))
    declinedServiceIds = declinedServiceIds.filter(id => validServiceIds.has(id))

    const acceptedSet = new Set<number>(acceptedServiceIds.map(Number))
    const feeServiceIds = new Set(
      currentServices
        .filter((s) => s.service_name === 'OBD-II Diagnostic Scan')
        .map((s) => Number(s.id)),
    )

    let serverTotal = 0
    for (const s of currentServices) {
      if (acceptedSet.has(Number(s.id)) || feeServiceIds.has(Number(s.id))) {
        serverTotal += Number(s.actual_amount || 0)
      }
    }

    if (amount <= 0 || amount > serverTotal) {
      return NextResponse.json({ error: `Amount must be greater than 0 and not exceed the total of ₱${serverTotal}` }, { status: 400 })
    }

    if (serverTotal >= 50000) {
      const minAmount = Math.round(serverTotal * 0.2)
      if (amount < minAmount) {
        return NextResponse.json({ error: `A 20% downpayment (₱${minAmount.toLocaleString()}) is required for bills of ₱50,000 or more.` }, { status: 400 })
      }
    }

    let proofUrl: string | null = null
    if (proofFile) {
      proofUrl = await uploadPaymentProof(String(jobOrderId), proofFile)
    }

    const quotationSelection = JSON.stringify({ acceptedServiceIds, declinedServiceIds })

    const { rows } = await db.query(
      `INSERT INTO payments
        (job_order_id, payment_method, amount_paid, payment_date, verification_status, payment_channel, reference_number, proof_of_payment_image, quotation_selection)
       VALUES ($1, $2::payment_method, $3, NOW(), 'pending', $4, $5, $6, $7::jsonb)
       RETURNING id`,
      [jobOrderId, dbMethod, amount, channelLabel, referenceNumber, proofUrl, quotationSelection]
    )
    const paymentId = rows[0].id

    await db.query(
      `INSERT INTO system_audit_logs (user_id, action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ($1, 'created'::audit_action_enum, 'payments', $2, $3, NOW())`,
      [userId, paymentId, JSON.stringify({ event: 'quotation_payment_submitted', job_order_id: jobOrderId, acceptedServiceIds, declinedServiceIds })],
    )

    return NextResponse.json({ success: true, paymentId })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
