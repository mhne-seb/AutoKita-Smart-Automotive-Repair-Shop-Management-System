
export type PaymentChannelType = 'e_wallet' | 'bank_transfer'

export interface PaymentChannel {
  id: string
  label: string
  type: PaymentChannelType
  accountName: string
  accountNumber: string
  // Path under /public to the channel's payment QR (e.g. '/assets/qr-gcash.png').
  // Leave unset until the shop provides one — the UI shows a placeholder.
  qrImage?: string
}

export const PAYMENT_CHANNELS: PaymentChannel[] = [
  { id: 'gcash', label: 'GCash', type: 'e_wallet', accountName: 'AutoKita Repair Shop', accountNumber: '0917 000 0000' },
  { id: 'maya', label: 'Maya', type: 'e_wallet', accountName: 'AutoKita Repair Shop', accountNumber: '0917 000 0000' },
  { id: 'bdo', label: 'BDO', type: 'bank_transfer', accountName: 'AutoKita Repair Shop Inc.', accountNumber: '0000 0000 0000' },
  { id: 'bpi', label: 'BPI', type: 'bank_transfer', accountName: 'AutoKita Repair Shop Inc.', accountNumber: '0000 0000 0000' },
]

export function getPaymentChannel(id: string): PaymentChannel | undefined {
  return PAYMENT_CHANNELS.find((c) => c.id === id)
}
