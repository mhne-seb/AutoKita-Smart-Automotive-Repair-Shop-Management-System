import { QuotationData } from './types'

export const quotations: Record<string, QuotationData> = {
  i1: {
    jobOrderId: 'i1',
    sentToCustomer: false,
    notes:
      'Front brake pads worn to 2mm — immediate replacement recommended. Air filter heavily clogged. Oil change overdue by ~8,000 km based on last service record.',
    services: [
      {
        id: 'SVC-001',
        code: 'SVC-001',
        name: 'Engine Oil & Filter Change',
        description: 'Full synthetic oil change with genuine oil filter replacement.',
        laborHours: 1.5,
        laborCost: 1800,
        parts: [
          { id: 'PRT-0041', name: 'Synthetic Engine Oil 5W-40 (4L)', partNo: 'PRT-0041', qty: 1, unitPrice: 950, status: 'in-stock' },
          { id: 'PRT-0042', name: 'Genuine Oil Filter', partNo: 'PRT-0042', qty: 1, unitPrice: 450, status: 'in-stock' },
        ],
      },
      {
        id: 'SVC-002',
        code: 'SVC-002',
        name: 'Front Brake Pad Replacement',
        description: 'Replace worn front brake pads and inspect rotors.',
        laborHours: 2,
        laborCost: 2500,
        parts: [
          { id: 'PRT-0118', name: 'OEM Front Brake Pad Set', partNo: 'PRT-0118', qty: 1, unitPrice: 3800, status: 'in-stock' },
          { id: 'PRT-0119', name: 'Brake Pad Shim Kit', partNo: 'PRT-0119', qty: 1, unitPrice: 750, status: 'to-order' },
        ],
      },
      {
        id: 'SVC-003',
        code: 'SVC-003',
        name: 'Air Filter Replacement',
        description: 'Replace clogged engine air filter for optimal performance.',
        laborHours: 0.5,
        laborCost: 600,
        parts: [
          { id: 'PRT-0205', name: 'Engine Air Filter (OEM)', partNo: 'PRT-0205', qty: 1, unitPrice: 1200, status: 'to-order' },
        ],
      },
      {
        id: 'SVC-004',
        code: 'SVC-004',
        name: 'Spark Plug Replacement',
        description: 'Replace all 4 iridium spark plugs for better fuel efficiency.',
        laborHours: 1.5,
        laborCost: 1500,
        parts: [
          { id: 'PRT-0311', name: 'Iridium Spark Plug', partNo: 'PRT-0311', qty: 4, unitPrice: 850, status: 'in-stock' },
        ],
      },
    ],
  },
  i2: {
    jobOrderId: 'i2',
    sentToCustomer: false,
    notes: 'Front rotors show visible scoring; resurfacing requested by customer instead of full replacement.',
    services: [
      {
        id: 'SVC-001',
        code: 'SVC-001',
        name: 'Rotors Resurfacing',
        description: 'Machine both front rotors to restore an even braking surface.',
        laborHours: 2,
        laborCost: 3500,
        parts: [{ id: 'PRT-0501', name: 'Brake Cleaner Spray', partNo: 'PRT-0501', qty: 2, unitPrice: 250, status: 'in-stock' }],
      },
    ],
  },
  i3: {
    jobOrderId: 'i3',
    sentToCustomer: true,
    notes: 'Customer requested lowest-cost OEM-equivalent part.',
    services: [
      {
        id: 'SVC-001',
        code: 'SVC-001',
        name: 'Fuel Filter Replacement',
        description: 'Replace clogged fuel filter and prime fuel line.',
        laborHours: 1,
        laborCost: 900,
        parts: [{ id: 'PRT-0612', name: 'Fuel Filter (Aftermarket)', partNo: 'PRT-0612', qty: 1, unitPrice: 1200, status: 'in-stock' }],
      },
    ],
  },
  i4: {
    jobOrderId: 'i4',
    sentToCustomer: true,
    notes: 'A/C system cleaned and recharged, no further parts required.',
    services: [
      {
        id: 'SVC-001',
        code: 'SVC-001',
        name: 'A/C Cleaning',
        description: 'Full A/C system cleaning, sanitizing, and refrigerant recharge.',
        laborHours: 2,
        laborCost: 3800,
        parts: [{ id: 'PRT-0710', name: 'Refrigerant R134a (1kg)', partNo: 'PRT-0710', qty: 1, unitPrice: 2000, status: 'in-stock' }],
      },
    ],
  },
}

export function getQuotationById(id: string): QuotationData | undefined {
  return quotations[id]
}
