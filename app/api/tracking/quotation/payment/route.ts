import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { uploadPaymentProof } from '@/lib/storage'
import { getPaymentChannel } from '@/data/paymentChannels'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
    const channelId = String(form.get('channel') ?? '')
    const channel = getPaymentChannel(channelId)
    referenceNumber = String(form.get('referenceNumber') ?? '').trim() || null
    const file = form.get('file')

    if (!channel) {
      return NextResponse.json({ error: 'A valid payment channel is required' }, { status: 400 })
    }
    if (!referenceNumber) {
      return NextResponse.json({ error: 'Reference number is required' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Proof of payment is required' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Proof of payment must be a JPEG, PNG or WebP image' }, { status: 415 })
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: 'Proof of payment must be under 5MB' }, { status: 413 })
    }

    dbMethod = channel.type
    channelLabel = channel.label
    proofUrl = await uploadPaymentProof(String(jobOrderId), file)
  }

  try {
    const { rows: joRows } = await db.query(
      `SELECT quotation_approved FROM job_orders WHERE id = $1`, [jobOrderId]
    )
    if (joRows[0]?.quotation_approved) {
      return NextResponse.json({ error: 'Quotation already confirmed' }, { status: 409 })
    }

    // Delete rejected services
    await db.query(
      `DELETE FROM job_order_services WHERE job_order_id = $1 AND id != ALL($2::int[])`,
      [jobOrderId, acceptedServiceIds]
    )

    // Delete rejected parts (ID 999999 is the pseudo-service representing all parts)
    if (!acceptedServiceIds.includes(999999)) {
      await db.query(`DELETE FROM job_order_parts WHERE job_order_id = $1`, [jobOrderId])
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

    return NextResponse.json({ success: true, paymentId: rows[0].id })
  } catch (err) {
    console.error('[/api/tracking/quotation/payment] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
