export async function getReceivedData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/received?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      date_arrived: string
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    services: {
      id: number
      service_name: string
      description_of_work: string
      estimated_hours: number
      amount: string
    }[]
    history: {
      jo_date: string
      service_name: string
      grand_total: string
    }[]
    customerConcern: string | null
  }>
}

export async function getInspectingData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/inspecting?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      estimated_duration: string
      actual_duration: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    preDiagnostic: { mechanic_notes: string | null; datetime_created: string | null } | null
    findings: {
      id: number
      name: string | null
      status: string | null
      photo: string | null
      findings_description: string
      logged_date: string
    }[]
    shop: { name: string; address: string } | null
  }>
}

export async function getInProgressData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/in-progress?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    tasks: {
      id: number
      section_id: string
      task_title: string
      note: string
      task_status: string
      completed_at: string | null
      price: string
      billable: boolean
    }[]
  }>
}

export async function getCompletedData(userId: number, jobOrderId?: number) {
  const qs = new URLSearchParams({ userId: String(userId) })
  if (jobOrderId) qs.set('jobOrderId', String(jobOrderId))
  const res = await fetch(`/api/tracking/completed?${qs}`)
  return res.json() as Promise<{
    jobOrder: {
      job_order_id: number
      status: string
      quotation_approved: boolean
      date_arrived: string
      started_at: string
      date_promised: string
      estimated_duration: string
      actual_duration: string
      grand_total: string
      balance: string
      vehicle_model: string
      vehicle_year: number
      plate_number: string
    } | null
    logs: { id: number; activity_description: string; log_time: string }[]
    warranties: {
      id: number
      coverage_description: string
      start_date: string
      expiration_date: string
      status: string
    }[]
    services: {
      id: number
      service_name: string
      description_of_work: string
      estimated_hours: number
      actual_hours: number
      amount: string
    }[]
    parts: {
      id: number
      description: string
      quantity: number
      retail_unit_price: string
      total_retail_amount: string
    }[]
  }>
}