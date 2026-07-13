// Reference/seed data for the Admin Mechanics Management page.

export type EmploymentType = 'Full-Time' | 'Part-Time' | 'Contractual'

export const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-Time', 'Part-Time', 'Contractual']

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Fallback avatar background colors when a mechanic has no uploaded photo.
export const AVATAR_PALETTE = ['1e3a5f', '0f766e', 'b45309', '7c3aed', 'be123c', '15803d']

// Sample customer names used to simulate each mechanic's recent job history.
export const CUSTOMER_POOL = [
  'Juan Dela Cruz',
  'Elmer Villanueva',
  'Vince Navarro',
  'Tonyo Cruz',
  'Dodong Mendoza',
  'Grace Panganiban',
  'Liza Bautista',
]
