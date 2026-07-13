import { InspectionData } from './types'

export const inspections: Record<string, InspectionData> = {
  i1: {
    jobOrderId: 'i1',
    vehicleTitle: '2022 Tesla Model 3',
    plate: 'ABC-1234',
    customer: 'Juan Dela Cruz',
    photoSlots: [
      { id: 'front', label: 'Front Quarter', url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=400&q=60' },
      { id: 'engine', label: 'Engine Bay', url: 'https://images.unsplash.com/photo-1621361365424-06f0e1eaf0c3?w=400&q=60' },
      { id: 'under', label: 'Underchassis', url: 'https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?w=400&q=60' },
    ],
    notes: [
      {
        id: 'n1',
        author: 'Boss Boyet',
        timestamp: '15 mins ago',
        content:
          "Initial scan completed for the 2022 Tesla Model 3. The brake system requires immediate attention as noted in the findings below. I've also topped up the washer fluid as a courtesy. Battery health remains optimal. We recommend immediate replacement of front brake pads to ensure safety.",
        photos: [
          { label: 'Front Quarter', url: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=300&q=60' },
          { label: 'Front Bay Area', url: 'https://images.unsplash.com/photo-1632823469850-1b7b1e8b7692?w=300&q=60' },
          { label: 'Underchasis', url: 'https://images.unsplash.com/photo-1621361365424-06f0e1eaf0c3?w=300&q=60' },
        ],
      },
    ],
    findings: [
      { id: 'f1', name: 'Engine oil', note: 'Oil levels are slightly low; recommended synthetic upgrade for high mileage.', status: 'needs-attention' },
      {
        id: 'f2',
        name: 'Front brake pads',
        note: 'Pad thickness at 2mm. Critical safety risk. Immediate replacement recommended.',
        status: 'urgent',
        photo: 'https://images.unsplash.com/photo-1600661653561-629509216228?w=300&q=60',
      },
      { id: 'f3', name: 'Battery', note: 'Voltage holding steady at 12.6V. No leakage or corrosion detected.', status: 'ok' },
      { id: 'f4', name: 'Air filter', note: 'Dust accumulation visible. Should be replaced at the next service interval.', status: 'needs-attention' },
      { id: 'f5', name: 'Transmission fluid', note: 'Fluid is discolored with a slight burnt odor. Recommend a full flush.', status: 'urgent' },
      { id: 'f6', name: 'Tire tread depth', note: 'Depth consistent at 6mm across all tires. Even wear pattern.', status: 'ok' },
    ],
    timer: {
      startedAt: '08:15 AM Today',
      estimatedFinish: '04:30 PM Today',
      laborHoursEstimate: 6.5,
      currentDurationHours: 4.2,
      running: true,
      progressPercent: 88,
    },
    approvalRequired: true,
  },
  i2: {
    jobOrderId: 'i2',
    vehicleTitle: '2019 Honda Civic',
    plate: 'XYZ-9999',
    customer: 'Elmer Villanueva',
    photoSlots: [
      { id: 'front', label: 'Front Quarter' },
      { id: 'engine', label: 'Engine Bay' },
      { id: 'under', label: 'Underchassis' },
    ],
    notes: [],
    findings: [
      { id: 'f1', name: 'Front rotors', note: 'Visible scoring, resurfacing requested by customer.', status: 'needs-attention' },
      { id: 'f2', name: 'Brake pads', note: 'Pad thickness at 6mm, within safe range.', status: 'ok' },
    ],
    timer: {
      startedAt: '09:00 AM Today',
      estimatedFinish: '11:30 AM Today',
      laborHoursEstimate: 2.5,
      currentDurationHours: 0,
      running: false,
      progressPercent: 5,
    },
    approvalRequired: false,
  },
  i3: {
    jobOrderId: 'i3',
    vehicleTitle: '2021 Nissan Terra',
    plate: 'NDG-1124',
    customer: 'Juan Dela Cruz',
    photoSlots: [
      { id: 'front', label: 'Front Quarter' },
      { id: 'engine', label: 'Engine Bay' },
      { id: 'under', label: 'Underchassis' },
    ],
    notes: [],
    findings: [
      { id: 'f1', name: 'Fuel filter', note: 'Clogged, restricting flow. Replacement needed.', status: 'urgent' },
    ],
    timer: {
      startedAt: '09:00 AM, May 27',
      estimatedFinish: '10:30 AM, May 27',
      laborHoursEstimate: 1.5,
      currentDurationHours: 1.5,
      running: false,
      progressPercent: 100,
    },
    approvalRequired: false,
  },
  i4: {
    jobOrderId: 'i4',
    vehicleTitle: '2021 Nissan Terra',
    plate: 'DEF-5678',
    customer: 'Tonyo Cruz',
    photoSlots: [
      { id: 'front', label: 'Front Quarter' },
      { id: 'engine', label: 'Engine Bay' },
      { id: 'under', label: 'Underchassis' },
    ],
    notes: [],
    findings: [
      { id: 'f1', name: 'A/C system', note: 'Cleaned and recharged. Cooling verified at 100%.', status: 'ok' },
    ],
    timer: {
      startedAt: '09:00 AM, May 17',
      estimatedFinish: '11:00 AM, May 17',
      laborHoursEstimate: 2,
      currentDurationHours: 2,
      running: false,
      progressPercent: 100,
    },
    approvalRequired: false,
  },
}

export function getInspectionById(id: string): InspectionData | undefined {
  return inspections[id]
}