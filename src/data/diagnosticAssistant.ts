// Mock data for the Admin/mechanic-side AI Diagnostic Assistant
// (src/components/dashboard/MechanicAIAssistant.tsx).


export type FaultSeverity = 'critical' | 'warning' | 'info'

export interface FaultCode {
  code: string
  label: string
  severity: FaultSeverity
}

export interface PartLine {
  name: string
  note: string
  price: number
  severity: FaultSeverity
}

export interface PrescriptionLine {
  name: string
  price: number
  severity: FaultSeverity
}

export interface VehicleScanInfo {
  label: string
  scanned: string
  model: string
  engine: string
  odometer: string
}

export type DiagnosticMsg =
  | { id: string; role: 'bot'; kind: 'text'; text: string; time: string }
  | { id: string; role: 'bot'; kind: 'fault-card'; time: string }
  | { id: string; role: 'user'; kind: 'text'; text: string; time: string }

export const severityChip: Record<FaultSeverity, string> = {
  critical: 'bg-rose-600 text-white',
  warning: 'bg-amber-500 text-white',
  info: 'border border-slate-200 bg-slate-100 text-slate-600',
}

export const severityDot: Record<FaultSeverity, string> = {
  critical: 'bg-rose-500',
  warning: 'bg-amber-500',
  info: 'bg-slate-400',
}

export const VEHICLE: VehicleScanInfo = {
  label: 'PNP 1234 — 2020 Toyota Fortuner 2.4 4x4 AT',
  scanned: 'Dec 18, 2024 · 10:42 AM',
  model: 'Fortuner 2.4 4x4',
  engine: '2.4L Turbo Diesel',
  odometer: '78,420 km',
}

export const FAULT_CODES: FaultCode[] = [
  { code: 'P0300', label: 'Random/Multiple Cylinder Misfire Detected', severity: 'critical' },
  { code: 'P0420', label: 'Catalyst System Efficiency Below Threshold (Bank 1)', severity: 'warning' },
  { code: 'P0113', label: 'Intake Air Temperature Sensor Circuit High Input', severity: 'info' },
]

export const PARTS_CROSS_CHECK: PartLine[] = [
  { name: 'Spark Plugs (×4)', note: 'Inspect & likely replace', price: 2400, severity: 'critical' },
  { name: 'Ignition Coil Pack', note: 'Test each coil individually', price: 7000, severity: 'critical' },
  { name: 'Fuel Injectors (×4)', note: 'Clean or replace if clogged', price: 16000, severity: 'warning' },
  { name: 'Mass Air Flow Sensor', note: 'Clean sensor, re-test', price: 1200, severity: 'info' },
]

export const SERVICE_PRESCRIPTION: PrescriptionLine[] = [
  { name: 'Spark Plug Replacement', price: 2400, severity: 'critical' },
  { name: 'Coil Pack Replace', price: 7000, severity: 'critical' },
  { name: 'O2 Sensors (×2)', price: 8500, severity: 'warning' },
  { name: 'Injector Cleaning', price: 2800, severity: 'warning' },
  { name: 'MAF Cleaning', price: 600, severity: 'info' },
]

export const SUGGESTED_PROMPTS: string[] = [
  'Estimated labor time?',
  'Parts in inventory?',
  'Aftermarket compatibility?',
  'Safe to drive until service?',
]

export const INITIAL_MESSAGES: DiagnosticMsg[] = [
  {
    id: '1',
    role: 'bot',
    kind: 'text',
    time: '10:42 AM',
    text: `OBD2 scan loaded for ${VEHICLE.label}. I detected ${FAULT_CODES.length} fault codes from the scan on ${VEHICLE.scanned}. Cross-checking against service history and parts database now.`,
  },
  {
    id: '2',
    role: 'user',
    kind: 'text',
    time: '10:43 AM',
    text: 'Break down P0300. What parts do we need to check or replace?',
  },
  { id: '3', role: 'bot', kind: 'fault-card', time: '10:43 AM' },
]

// The P0300 breakdown card's fixed copy (code + explanation + rec) — kept
// separate from PARTS_CROSS_CHECK since that list is reused standalone
export const P0300_BREAKDOWN = {
  title: 'P0300 — Random/Multiple Cylinder Misfire',
  explanation:
    'ECU detects uneven combustion across multiple cylinders. For a 2020 Fortuner 2.4D, most likely culprits are ignition or fuel delivery components.',
  recommendation: 'Start with spark plugs and coil pack. If misfire persists after reset, proceed to injector cleaning.',
}

// Canned reply used when the mechanic sends a free-form message or taps a
// suggested prompt — placeholder for a real Agentic RAG response
export const FOLLOWUP_REPLY =
  "Checked against this vehicle's service history and the current parts database — I've folded that into the prescription on the right. Anything else you'd like me to cross-check?"

export const peso = (n: number) => `₱${n.toLocaleString('en-PH')}`

export const getEstTotal = (lines: PrescriptionLine[] = SERVICE_PRESCRIPTION) =>
  lines.reduce((sum, l) => sum + l.price, 0)
