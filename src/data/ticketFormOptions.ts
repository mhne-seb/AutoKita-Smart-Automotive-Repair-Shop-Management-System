// Reference/config data for the Admin "New Ticket" form on the Job Queue
// page. 

export const PROVINCES: Record<string, string[]> = {
  'Metro Manila': ['Quezon City', 'Manila', 'Makati', 'Pasig'],
  Cavite: ['Bacoor', 'Imus', 'Dasmariñas'],
  Laguna: ['Calamba', 'Santa Rosa', 'Biñan'],
  Rizal: ['Antipolo', 'Cainta', 'Taytay'],
}

export const SERVICE_CATEGORIES = [
  'Oil Change',
  'Brake Service',
  'Engine Diagnostic',
  'Tire Service',
  'Electrical Repair',
  'Aircon Service',
  'Full Maintenance',
]

export const YEARS = Array.from({ length: 17 }, (_, i) => String(2026 - i))
