import { ServiceProgressData } from './types'

export const serviceProgress: Record<string, ServiceProgressData> = {
  i1: {
    jobOrderId: 'i1',
    quotationConfirmed: false,
    sections: [
      {
        id: 'received',
        title: 'Received',
        tasks: [
          { id: 't1', title: 'Customer check-in', note: 'Customer arrived. Details recorded — name, contact, and vehicle info confirmed.', time: '08:00 AM', status: 'completed' },
          { id: 't2', title: 'Vehicle intake form', note: 'Pre-service condition documented. No pre-existing body damage noted.', time: '08:15 AM', status: 'completed' },
        ],
      },
      {
        id: 'inspecting',
        title: 'Inspecting',
        tasks: [
          { id: 't3', title: 'Engine oil level', note: 'Checked engine oil — level is slightly low, needs top-up.', time: '08:45 AM', status: 'completed' },
          { id: 't4', title: 'Brake pads & rotors', note: 'Front pads at 2mm — replacement required. Rotors look fine.', time: '09:00 AM', status: 'completed' },
          { id: 't5', title: 'OBD fault code scan', note: 'No active fault codes detected. System is clear.', time: '09:15 AM', status: 'completed' },
          { id: 't6', title: 'Undercarriage inspection', note: 'No rust or damage found. All bolts are secure.', time: '09:30 AM', status: 'completed' },
        ],
      },
      {
        id: 'quotation',
        title: 'Quotation',
        tasks: [
          { id: 't7', title: 'List parts & labor costs', note: 'Brake pads ₱1,800 + oil ₱600 + labor ₱2,100. Total: ₱4,500.', time: '09:45 AM', status: 'completed' },
          { id: 't8', title: 'Send quotation to customer', note: 'Quotation sent via SMS and email. Awaiting reply.', time: '10:00 AM', status: 'active' },
          { id: 't9', title: 'Customer approval received', note: 'Wait for customer to confirm before proceeding.', time: '—', status: 'pending' },
        ],
      },
      {
        id: 'in-progress',
        title: 'In Progress',
        tasks: [
          { id: 't10', title: 'Replace engine oil & filter', note: 'Drain old oil, replace filter, fill with fresh 5W-30.', time: '—', status: 'pending' },
          { id: 't11', title: 'Replace front brake pads', note: 'Install new OEM pads, torque to spec.', time: '—', status: 'pending' },
          { id: 't12', title: 'Clear OBD fault codes', note: 'Re-scan after repairs and confirm no new codes.', time: '—', status: 'pending' },
          { id: 't13', title: 'Final road test', note: 'Test drive to verify brake feel and engine response.', time: '—', status: 'pending' },
        ],
      },
      {
        id: 'complete',
        title: 'Complete',
        tasks: [
          { id: 't14', title: 'Final quality inspection', note: 'Mechanic signs off on all completed service items.', time: '—', status: 'pending' },
          { id: 't15', title: 'Payment processing', note: 'Collect payment via cash, card, or GCash before vehicle release.', time: '—', status: 'pending' },
          { id: 't16', title: 'Vehicle release to customer', note: 'Hand over keys and signed service summary to the customer.', time: '—', status: 'pending' },
        ],
      },
    ],
  },
  i2: {
    jobOrderId: 'i2',
    quotationConfirmed: false,
    sections: [
      {
        id: 'received',
        title: 'Received',
        tasks: [{ id: 't1', title: 'Customer check-in', note: 'Vehicle dropped off for rotor resurfacing.', time: '09:00 AM', status: 'completed' }],
      },
      {
        id: 'inspecting',
        title: 'Inspecting',
        tasks: [{ id: 't2', title: 'Brake system inspection', note: 'In progress.', time: '—', status: 'active' }],
      },
      { id: 'quotation', title: 'Quotation', tasks: [{ id: 't3', title: 'Send quotation to customer', note: 'Not yet started.', time: '—', status: 'pending' }] },
      { id: 'in-progress', title: 'In Progress', tasks: [{ id: 't4', title: 'Resurface rotors', note: 'Not yet started.', time: '—', status: 'pending' }] },
      { id: 'complete', title: 'Complete', tasks: [{ id: 't5', title: 'Vehicle release to customer', note: 'Not yet started.', time: '—', status: 'pending' }] },
    ],
  },
  i3: {
    jobOrderId: 'i3',
    quotationConfirmed: true,
    sections: [
      { id: 'received', title: 'Received', tasks: [{ id: 't1', title: 'Customer check-in', note: 'Vehicle dropped off.', time: '09:00 AM, May 27', status: 'completed' }] },
      { id: 'inspecting', title: 'Inspecting', tasks: [{ id: 't2', title: 'Fuel system inspection', note: 'Filter found clogged.', time: '09:15 AM, May 27', status: 'completed' }] },
      { id: 'quotation', title: 'Quotation', tasks: [{ id: 't3', title: 'Send quotation to customer', note: 'Awaiting customer approval.', time: '09:45 AM, May 27', status: 'active' }] },
      { id: 'in-progress', title: 'In Progress', tasks: [{ id: 't4', title: 'Replace fuel filter', note: 'Not yet started.', time: '—', status: 'pending' }] },
      { id: 'complete', title: 'Complete', tasks: [{ id: 't5', title: 'Vehicle release to customer', note: 'Not yet started.', time: '—', status: 'pending' }] },
    ],
  },
  i4: {
    jobOrderId: 'i4',
    quotationConfirmed: true,
    sections: [
      { id: 'received', title: 'Received', tasks: [{ id: 't1', title: 'Customer check-in', note: 'Vehicle dropped off.', time: '09:00 AM, May 17', status: 'completed' }] },
      { id: 'inspecting', title: 'Inspecting', tasks: [{ id: 't2', title: 'A/C system inspection', note: 'Low refrigerant found.', time: '09:15 AM, May 17', status: 'completed' }] },
      { id: 'quotation', title: 'Quotation', tasks: [{ id: 't3', title: 'Customer approval received', note: 'Approved on the spot.', time: '09:30 AM, May 17', status: 'completed' }] },
      { id: 'in-progress', title: 'In Progress', tasks: [{ id: 't4', title: 'Clean & recharge A/C system', note: 'Completed successfully.', time: '10:30 AM, May 17', status: 'completed' }] },
      { id: 'complete', title: 'Complete', tasks: [{ id: 't5', title: 'Vehicle release to customer', note: 'Keys and receipt handed over.', time: '11:00 AM, May 17', status: 'completed' }] },
    ],
  },
}

export function getServiceProgressById(id: string): ServiceProgressData | undefined {
  return serviceProgress[id]
}