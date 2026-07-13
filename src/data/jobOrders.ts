import { JobOrderCard } from './types'

// Moved out of JobOrders.tsx so the page component only handles rendering/state,
// and this data can be reused by other pages (Inspection, Quotation, Service Progress)
// that need to look up a job order by id.
export const jobOrders: JobOrderCard[] = [
  {
    id: 'i1',
    customer: 'Juan Dela Cruz',
    vehicle: '2022 Tesla Model 3',
    customerId: 'CUST-2026-1234',
    stage: 'in-progress',
    service: 'Full Detail & Oil Change',
    time: 'May 28, 9:00 AM',
    plate: 'ABC 1234',
    payment: '₱4,500',
    paid: true,
    mechanic: 'Jose Santos',
    stepsDone: 3,
    stepsTotal: 4,
  },
  {
    id: 'i2',
    customer: 'Elmer Villanueva',
    vehicle: '2019 Honda Civic',
    customerId: 'CUST-2026-1235',
    stage: 'inspecting',
    service: 'Rotors Resurfacing',
    time: 'Jun 12, 9:00 AM',
    plate: 'XYZ 9999',
    payment: '₱5,500',
    paid: true,
    mechanic: 'Jose Santos',
    stepsDone: 0,
    stepsTotal: 4,
  },
  {
    id: 'i3',
    customer: 'Juan Dela Cruz',
    vehicle: '2021 Nissan Terra',
    customerId: 'CUST-2026-1236',
    stage: 'quotation',
    service: 'Fuel Filter Replacement',
    time: 'May 27, 9:00 AM',
    plate: 'NDG 1124',
    payment: '₱2,100',
    paid: false,
    mechanic: 'Jose Santos',
    stepsDone: 0,
    stepsTotal: 4,
  },
  {
    id: 'i4',
    customer: 'Tonyo Cruz',
    vehicle: '2021 Nissan Terra',
    customerId: 'CUST-2026-1237',
    stage: 'completed',
    service: 'A/C Cleaning',
    time: 'May 17, 9:00 AM',
    plate: 'DEF 5678',
    payment: '₱5,800',
    paid: true,
    mechanic: 'Jose Santos',
    stepsDone: 4,
    stepsTotal: 4,
  },
  {
    // Second vehicle for the demo Customer login (CUST-2026-1234 / Juan Dela
    // Cruz) so the Customer dashboard has two live cards, both of which
    // reflect whatever stage the Admin side moves them to.
    id: 'i5',
    customer: 'Juan Dela Cruz',
    vehicle: '2019 Honda Civic RS',
    customerId: 'CUST-2026-1234',
    stage: 'quotation',
    service: 'Quotation Revision',
    time: 'Jun 2, 1:30 PM',
    plate: 'RS 8831',
    payment: '₱3,200',
    paid: false,
    mechanic: 'Jose Santos',
    stepsDone: 2,
    stepsTotal: 4,
  },
]

export function getJobOrderById(id: string): JobOrderCard | undefined {
  return jobOrders.find((c) => c.id === id)
}