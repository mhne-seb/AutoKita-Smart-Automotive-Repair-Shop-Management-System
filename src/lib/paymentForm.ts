
import { getPaymentChannel, type PaymentChannel } from '@/data/paymentChannels'
import { db } from '@/lib/db'

// The browser tells us the file type, but anyone can lie about it. Look at the
// first bytes of the file itself: JPEG, PNG and WebP each start with their own
// fixed signature.
export async function hasImageSignature(file: File): Promise<boolean> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47
  const webp =
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  return jpeg || png || webp
}

// The same reference number must not pay for two different bills. Only
// payments that are still waiting or were accepted count; a rejected one
// frees its number so the customer can correct a typo.
export async function referenceAlreadyUsed(referenceNumber: string): Promise<boolean> {
  const { rows } = await db.query(
    `SELECT 1 FROM payments
     WHERE LOWER(TRIM(reference_number)) = LOWER(TRIM($1))
       AND verification_status IN ('pending', 'verified')
     LIMIT 1`,
    [referenceNumber],
  )
  return rows.length > 0
}

export const PROOF_NOT_IMAGE_MESSAGE = 'The proof must be a real JPEG, PNG or WebP image.'
export const REFERENCE_USED_MESSAGE = 'This reference number was already used. Check the number, or contact the shop.'

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
