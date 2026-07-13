// Mock data for the Admin "Job Order Detail" 

export interface ServiceLine {
  id: string
  name: string
  description: string
  done: boolean
}

export interface PartLine {
  id: string
  qty: number
  name: string
  partNo: string
  unitPrice: number
}

export const initialServices: ServiceLine[] = [
  { id: 's1', name: 'Change Oil (Fully Synthetic)', description: 'Includes new oil filter and standard multipoint checklist.', done: true },
  { id: 's2', name: 'Turbo Cleaning Service', description: 'Complete carbon residue clearance for maximum engine throughput.', done: true },
  { id: 's3', name: 'Pull Down Transmission', description: 'Comprehensive transmission check, diagnostic check on solenoid.', done: false },
]

export const initialParts: PartLine[] = [
  { id: 'p1', qty: 4, name: 'Iridium Spark Plugs', partNo: 'SP-IRIDIUM-NGK', unitPrice: 850 },
  { id: 'p2', qty: 1, name: 'Oil Filter OEM', partNo: 'OF-CHEV-17', unitPrice: 650 },
  { id: 'p3', qty: 6, name: 'Mobil 1 5W-30 Synthetic (Liter)', partNo: 'MO-5W30-SYN', unitPrice: 700 },
  { id: 'p4', qty: 1, name: 'Front Brake Pads Ceramic', partNo: 'BR-PAD-FR', unitPrice: 3200 },
  { id: 'p5', qty: 1, name: 'Turbo Cleaning Kit', partNo: 'TURBO-KIT', unitPrice: 2800 },
  { id: 'p6', qty: 1, name: 'LED Fog Lights (set)', partNo: 'FOG-LED-SET', unitPrice: 2500 },
  { id: 'p7', qty: 1, name: 'Transmission Fluid Service', partNo: 'TRANS-FLD', unitPrice: 30000 },
]

export const SERVICE_PRESETS = ['Others', 'Oil Change', 'Brake Service']
