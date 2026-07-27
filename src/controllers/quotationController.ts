export async function getQuotationData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/quotation?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      quotation_approved: boolean
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    services: { id: number; service_name: string; description_of_work: string; estimated_hours: number; amount: string }[]
    paymentStatus: { id: number; payment_method: string; amount_paid: string; verification_status: string; payment_date: string } | null
  }>
}

export async function confirmQuotationVia2FA(jobOrderId: number) {
  const res = await fetch('/api/tracking/quotation/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobOrderId }),
  })
  return res.json() as Promise<{ success: boolean }>
}

export async function submitQuotationPayment(jobOrderId: number, method: 'shop' | 'ewallet', amount: number) {
  const res = await fetch('/api/tracking/quotation/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobOrderId, method, amount }),
  })
  return res.json() as Promise<{ success: boolean; paymentId: number }>
}

export async function getQuotationPaymentStatus(jobOrderId: number) {
  const res = await fetch(`/api/tracking/quotation/payment-status?jobOrderId=${jobOrderId}`)
  return res.json() as Promise<{
    paymentStatus: { verification_status: string; payment_method: string } | null
  }>
}