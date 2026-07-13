// ---------------------------------------------------------------------------
// diagnosticAssistantController — wraps src/data/diagnosticAssistant.ts (Admin
// AI Diagnostic Assistant widget). Bundles the fault codes, parts cross-check,
// service prescription, suggested prompts, vehicle info, and seed chat
// messages into one payload since the widget always loads them together on
// open — mirrors how the other job-order-flow controllers
// (inspectionController, quotationController, serviceProgressController)
// wrap their data file.
// ---------------------------------------------------------------------------

import {
  FAULT_CODES,
  PARTS_CROSS_CHECK,
  SERVICE_PRESCRIPTION,
  SUGGESTED_PROMPTS,
  VEHICLE,
  INITIAL_MESSAGES,
  P0300_BREAKDOWN,
  FOLLOWUP_REPLY,
  getEstTotal,
  type FaultCode,
  type PartLine,
  type PrescriptionLine,
  type VehicleScanInfo,
  type DiagnosticMsg,
} from '@/data/diagnosticAssistant'

// Re-exported so the component can seed its useState hooks synchronously on
// first render, same pattern as quotationController/inspectionController.
export {
  FAULT_CODES,
  PARTS_CROSS_CHECK,
  SERVICE_PRESCRIPTION,
  SUGGESTED_PROMPTS,
  VEHICLE,
  INITIAL_MESSAGES,
  P0300_BREAKDOWN,
  FOLLOWUP_REPLY,
  severityChip,
  severityDot,
  peso,
  getEstTotal,
  type FaultSeverity,
  type FaultCode,
  type PartLine,
  type PrescriptionLine,
  type VehicleScanInfo,
  type DiagnosticMsg,
} from '@/data/diagnosticAssistant'

export interface DiagnosticSession {
  vehicle: VehicleScanInfo
  faultCodes: FaultCode[]
  partsCrossCheck: PartLine[]
  servicePrescription: PrescriptionLine[]
  estTotal: number
  suggestedPrompts: string[]
  initialMessages: DiagnosticMsg[]
}

function simulateDelay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

/**
 * Loads everything the Diagnostic Assistant widget needs for one OBD2 scan
 * session in a single call. A real backend would key this off a scan/job
 * order id (e.g. `getDiagnosticSession(jobOrderId)`); the mock version
 * always returns the same demo vehicle.
 */
export async function getDiagnosticSession(): Promise<DiagnosticSession> {
  return simulateDelay({
    vehicle: VEHICLE,
    faultCodes: FAULT_CODES,
    partsCrossCheck: PARTS_CROSS_CHECK,
    servicePrescription: SERVICE_PRESCRIPTION,
    estTotal: getEstTotal(SERVICE_PRESCRIPTION),
    suggestedPrompts: SUGGESTED_PROMPTS,
    initialMessages: INITIAL_MESSAGES,
  })
}

/** Mock "ask the assistant" */
export async function askDiagnosticAssistant(question: string): Promise<{ reply: string }> {
  return simulateDelay({ reply: FOLLOWUP_REPLY }, 700)
}

/** Mock "turn this prescription into a quotation"  */
export async function generateQuotationFromPrescription(): Promise<{ success: boolean }> {
  return simulateDelay({ success: true }, 400)
}