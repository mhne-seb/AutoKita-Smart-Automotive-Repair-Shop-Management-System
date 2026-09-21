// Shared types for the Job Orders → Inspection → Quotation → Service Progress flow.

export type Stage = 'inspecting' | 'quotation' | 'in-progress' | 'completed'

export const stageOrder: Stage[] = ['inspecting', 'quotation', 'in-progress', 'completed']

export const stageLabels: Record<Stage, string> = {
  inspecting: 'Inspecting',
  quotation: 'Quotation',
  'in-progress': 'In Progress',
  completed: 'Completed',
}

export interface JobOrderCard {
  id: string
  customer: string
  vehicle: string
  customerId: string
  stage: Stage
  service: string
  time: string
  plate: string
  payment: string
  paid: boolean
  mechanic: string
  stepsDone: number
  stepsTotal: number
  mileage?: number
  vehicleYear?: number
  // A cancelled job order maps to the 'completed' stage (it's terminal) but
  // must never be labelled as if the work was done.
  cancelled?: boolean
}

export type FindingStatus = 'ok' | 'needs-attention' | 'urgent'

export const findingStatusMeta: Record<FindingStatus, { label: string; classes: string }> = {
  ok: { label: 'OK', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'needs-attention': { label: 'Needs Attention', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  urgent: { label: 'Replace/Urgent', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
}

export interface MechanicalFinding {
  id: string
  name: string
  note: string
  status: FindingStatus
  photo?: string
}

export interface InspectionPhotoSlot {
  id: string
  label: string
  title?: string
  url?: string
  // Present once a photo has been uploaded: the inspection_photos row that backs this slot, and the mechanic's condition note for it.
  rowId?: number
  note?: string
}

export const REFERENCE_PHOTO_STATUS = 'reference-photo'

export interface InspectionData {
  jobOrderId: string
  vehicleTitle: string
  plate: string
  customer: string
  photoSlots: InspectionPhotoSlot[]
  findings: MechanicalFinding[]
  timer: {
    startedAt: string
    estimatedFinish: string
    laborHoursEstimate: number
    currentDurationHours: number
    running: boolean
    progressPercent: number
  }
  approvalRequired: boolean
  // Customer agreed to the OBD-II scan fee at booking — mechanic may scan.
  diagnosticScanAuthorized?: boolean
  pullOutRequested?: boolean
  // The admin has added at least one service to the quotation.
  quotationStarted?: boolean
  // What the customer asked for when they booked (from the service ticket).
  // category/notes/requestedSlot are parsed out of the free-text concern
  // field when it matches a known booking-form format; `raw` always has
  // the original text as a fallback.
  request?: {
    serviceMode: 'Shop Visit' | 'Home Service'
    homeAddress: string | null
    category: string | null
    notes: string | null
    requestedSlot: string | null
    requestedOn: string
    raw: string
  } | null
}

export type PartStatus = 'in-stock' | 'to-order'

export interface QuotationPart {
  id: string
  name: string
  partNo: string
  qty: number
  unitPrice: number
  status: PartStatus
}

export interface QuotationService {
  id: string
  code: string
  name: string
  description: string
  laborHours: number
  laborCost: number
  parts: QuotationPart[]
  dbServiceId?: number
  estimated_amount?: number
  estimated_hours?: number
}

export interface QuotationData {
  jobOrderId: string
  services: QuotationService[]
  notes: string
  sentToCustomer: boolean
  quotationApproved: boolean
}

export type TaskStatus = 'completed' | 'active' | 'pending'

// A part a task is waiting on. The shop orders as needed (no inventory
// system), so the app only distinguishes "still to order" from "here".
export interface TaskPart {
  id: number
  name: string
  partNo: string
  qty: number
  status: string // job_order_parts_status; app uses in_stock | to_order | received
  // Set once the part was bought through "Record purchase" — where it came from.
  purchaseOrderId?: number
  supplierName?: string
  purchasedOn?: string
  unitCost?: number // what the shop paid per unit (supplier_unit_cost)
}

// One "Record purchase" save — a purchase_orders row and the parts it covered.
export interface PartsPurchase {
  id: number
  supplierName: string
  purchasedOn: string
  totalCost: number
  partCount: number
  status: string // purchase_orders.status: sent | partially_received | fulfilled
}

export interface Supplier {
  id: number
  name: string
}

export function partIsReady(p: TaskPart): boolean {
  return p.status !== 'to_order' && p.status !== 'ordered' && p.status !== 'in_transit'
}

export interface ServiceTask {
  id: string
  title: string
  note: string
  time: string
  status: TaskStatus
  startedAt?: string
  scheduledDate?: string
  mechanicId?: number
  mechanicName?: string
  estimatedFinish?: string
  parts?: TaskPart[]
  // Photo of the finished work — set when the task is completed (required).
  photoUrl?: string
  // Set when the task was added mid-service from an approved finding.
  findingId?: number
}

export interface ServiceSection {
  id: string
  title: string
  tasks: ServiceTask[]
}

// A mid-service finding: something the mechanic noticed that the approved
// quotation didn't cover. Proposed services/parts live on the finding as
// plain lists until the customer decides; only on approval do they become
// real job_order_services / job_order_parts / service_progress_tasks rows.
export interface ProposedService {
  serviceId: number | null // null = custom service not in the catalog yet
  name: string
  hours: number
  price: number
}
export interface ProposedPart {
  name: string
  partNo: string
  qty: number
  unitPrice: number
  serviceName: string // which proposed service this part is for
}
export interface ServiceFinding {
  id: number
  taskId: number | null // null = general finding, not tied to a task
  taskTitle: string | null
  reportedByName: string | null
  findings: string
  photoUrl: string | null
  services: ProposedService[]
  parts: ProposedPart[]
  extraCost: number
  decision: 'pending' | 'approved' | 'disputed' // disputed = customer declined
  decidedAt: string | null
  createdAt: string
}

export interface ServiceProgressData {
  jobOrderId: string
  sections: ServiceSection[]
  quotationConfirmed: boolean
  purchases: PartsPurchase[]
  findings: ServiceFinding[]
  // The job-order-level clock (not per-service): when the job went onto the
  // floor, when it's promised back, and the estimated labor. ISO values are
  // kept so the page can tick the running duration live.
  timer: {
    startedAtIso: string | null
    completedAtIso: string | null
    startedAt: string
    estimatedFinish: string
    estimatedDurationHours: number
  }
}
