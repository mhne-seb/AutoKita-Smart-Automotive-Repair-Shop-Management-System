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

export interface TechnicianNote {
  id: string
  author: string
  timestamp: string
  content: string
  photos?: { label: string; url: string }[]
}

export interface InspectionPhotoSlot {
  id: string
  label: string
  url?: string
}

export interface InspectionData {
  jobOrderId: string
  vehicleTitle: string
  plate: string
  customer: string
  photoSlots: InspectionPhotoSlot[]
  notes: TechnicianNote[]
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
}

export interface QuotationData {
  jobOrderId: string
  services: QuotationService[]
  notes: string
  sentToCustomer: boolean
}

export type TaskStatus = 'completed' | 'active' | 'pending'

export interface ServiceTask {
  id: string
  title: string
  note: string
  time: string
  status: TaskStatus
}

export interface ServiceSection {
  id: string
  title: string
  tasks: ServiceTask[]
}

export interface ServiceProgressData {
  jobOrderId: string
  sections: ServiceSection[]
  quotationConfirmed: boolean
}