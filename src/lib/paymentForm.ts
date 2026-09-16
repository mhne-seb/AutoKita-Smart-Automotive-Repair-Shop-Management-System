// paymentForm.ts — reads a manual bank/e-wallet transfer out of a multipart
// form the same way for every payment route (downpayment and final balance),
// so the rules live in one place: a known channel, a reference number, and a
// screenshot as evidence for the admin to check against the shop's account.

import { getPaymentChannel, type PaymentChannel } from '@/data/paymentChannels'

const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export type TransferDetails =
  | { ok: true; channel: PaymentChannel; referenceNumber: string; file: File }
  | { ok: false; error: string; status: number }

export function readTransferDetails(form: FormData): TransferDetails {
  const channel = getPaymentChannel(String(form.get('channel') ?? ''))
  const referenceNumber = String(form.get('referenceNumber') ?? '').trim()
  const file = form.get('file')

  if (!channel) return { ok: false, error: 'A valid payment channel is required', status: 400 }
  if (!referenceNumber) return { ok: false, error: 'Reference number is required', status: 400 }
  if (!(file instanceof File)) return { ok: false, error: 'Proof of payment is required', status: 400 }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { ok: false, error: 'Proof of payment must be a JPEG, PNG or WebP image', status: 415 }
  }
  if (file.size > MAX_BYTES) return { ok: false, error: 'Proof of payment must be under 5MB', status: 413 }

  return { ok: true, channel, referenceNumber, file }
}
