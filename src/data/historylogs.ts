// Mock data dedicated to the "History Logs" pages (Job Orders / Tickets /

export type HistoryStatus = 'Completed' | 'Cancelled' | 'Pending'

export interface JobOrderHistoryEntry {
  id: string
  customerId: string
  name: string
  vehicle: string
  branch: string
  services: string
  total: number
  date: string
  status: HistoryStatus
}

export const jobOrderHistorySummary = {
  total: 1284,
  completed: 1097,
  cancelled: 143,
  pending: 44,
}

export const jobOrderHistory: JobOrderHistoryEntry[] = [
  { id: 'JO-2024-0891', customerId: 'CUST-2026-1234', name: 'Juan Dela Cruz', vehicle: '2022 Tesla Model 3', branch: 'AutoKita - Main Branch', services: 'Oil Change, Brake Service', total: 7750, date: '2024-12-18', status: 'Completed' },
  { id: 'JO-2024-0889', customerId: 'CUST-2026-1236', name: 'Vince Navarro', vehicle: '2021 Nissan Terra', branch: 'AutoKita - Main Branch', services: 'Full Underchassis Checkup', total: 3500, date: '2024-12-16', status: 'Cancelled' },
  { id: 'JO-2024-0886', customerId: 'CUST-2026-1239', name: 'Andrea Lim', vehicle: '2023 Kia Stinger', branch: 'AutoKita - Main Branch', services: 'Brake Fluid, Tire Rotation', total: 4100, date: '2024-12-13', status: 'Pending' },
  { id: 'JO-2024-0883', customerId: 'CUST-2026-1242', name: 'Bernard Cruz', vehicle: '2016 Mazda CX-5', branch: 'AutoKita - Main Branch', services: 'Coolant Flush', total: 5600, date: '2024-12-10', status: 'Completed' },
  { id: 'JO-2024-0879', customerId: 'CUST-2026-1245', name: 'Marisol Reyes', vehicle: '2021 Honda CR-V', branch: 'AutoKita - Main Branch', services: 'Spark Plug Replacement', total: 6200, date: '2024-12-08', status: 'Completed' },
  { id: 'JO-2024-0876', customerId: 'CUST-2026-1248', name: 'Dante Villanueva', vehicle: '2018 Toyota Hilux', branch: 'AutoKita - Main Branch', services: 'Timing Belt Replacement', total: 21500, date: '2024-12-06', status: 'Completed' },
  { id: 'JO-2024-0873', customerId: 'CUST-2026-1251', name: 'Carla Mendoza', vehicle: '2020 Mitsubishi Mirage', branch: 'AutoKita - Main Branch', services: 'Full Underchassis Checkup', total: 8400, date: '2024-12-04', status: 'Completed' },
  { id: 'JO-2024-0870', customerId: 'CUST-2026-1254', name: 'Luis Santos', vehicle: '2017 Nissan Navara', branch: 'AutoKita - Main Branch', services: 'Suspension Check', total: 7100, date: '2024-12-02', status: 'Cancelled' },
  { id: 'JO-2024-0867', customerId: 'CUST-2026-1257', name: 'Patricia Cruz', vehicle: '2022 Kia Carnival', branch: 'AutoKita - Main Branch', services: 'A/C Cleaning & Recharge', total: 4850, date: '2024-11-30', status: 'Completed' },
  { id: 'JO-2024-0864', customerId: 'CUST-2026-1260', name: 'Ramon Bautista', vehicle: '2019 Ford EcoSport', branch: 'AutoKita - Main Branch', services: 'Brake Pad Replacement', total: 9300, date: '2024-11-28', status: 'Completed' },
  { id: 'JO-2024-0861', customerId: 'CUST-2026-1263', name: 'Ella Fernandez', vehicle: '2020 Subaru XV', branch: 'AutoKita - Main Branch', services: 'Wheel Alignment', total: 3200, date: '2024-11-25', status: 'Completed' },
  { id: 'JO-2024-0858', customerId: 'CUST-2026-1266', name: 'Miguel Torres', vehicle: '2021 Isuzu D-Max', branch: 'AutoKita - Main Branch', services: 'Engine Tune-up', total: 12800, date: '2024-11-22', status: 'Pending' },
]

// ---------------------------------------------------------------------------

export type TicketType = 'Shop Visit' | 'Home Service'

export interface TicketHistoryEntry {
  id: string
  customerId: string
  name: string
  contact: string
  vehicle: string
  type: TicketType
  services: string
  status: HistoryStatus
}

export const ticketHistorySummary = {
  total: 3891,
  completed: 3402,
  cancelled: 389,
  pending: 100,
}

export const ticketHistory: TicketHistoryEntry[] = [
  { id: 'TKT-2024-0441', customerId: 'CUST-2026-1234', name: 'Juan Dela Cruz', contact: '+63 995 123 4567', vehicle: '2022 Tesla Model 3', type: 'Shop Visit', services: 'Oil Change, Brake...', status: 'Completed' },
  { id: 'TKT-2024-0440', customerId: 'CUST-2026-1235', name: 'Elmer Villanueva', contact: '+63 920 888 1122', vehicle: '2019 Honda Civic', type: 'Home Service', services: 'Spark Plugs, Air F...', status: 'Completed' },
  { id: 'TKT-2024-0439', customerId: 'CUST-2026-1236', name: 'Vince Navarro', contact: '+63 916 222 5555', vehicle: '2021 Nissan Terra', type: 'Shop Visit', services: 'Engine Diagnostic', status: 'Cancelled' },
  { id: 'TKT-2024-0438', customerId: 'CUST-2026-1237', name: 'Maria Santos', contact: '+63 917 400 9900', vehicle: '2020 Toyota Fortuner', type: 'Shop Visit', services: 'Transmission Flus...', status: 'Completed' },
  { id: 'TKT-2024-0437', customerId: 'CUST-2026-1238', name: 'Carlo Reyes', contact: '+63 999 321 0011', vehicle: '2018 Mitsubishi Strada', type: 'Home Service', services: 'Suspension, Whe...', status: 'Completed' },
  { id: 'TKT-2024-0436', customerId: 'CUST-2026-1239', name: 'Andrea Lim', contact: '+63 906 711 2233', vehicle: '2023 Kia Stinger', type: 'Shop Visit', services: 'Brake Fluid, Tire R...', status: 'Pending' },
  { id: 'TKT-2024-0435', customerId: 'CUST-2026-1240', name: 'Rico Bautista', contact: '+63 915 877 6644', vehicle: '2017 Ford Ranger', type: 'Shop Visit', services: 'Timing Belt Repla...', status: 'Completed' },
  { id: 'TKT-2024-0434', customerId: 'CUST-2026-1241', name: 'Jasmine Torres', contact: '+63 928 554 3310', vehicle: '2021 Hyundai Tucson', type: 'Home Service', services: 'AC Regas, Cabin ...', status: 'Cancelled' },
]

// ---------------------------------------------------------------------------

export type CustomerTier = 'New' | 'Regular' | 'Loyal Customer' | 'VIP'

export interface CustomerHistoryEntry {
  customerId: string
  name: string
  contact: string
  vehicle: string
  jobs: number
  totalSpent: number
  lastService: string
  payment: 'Paid' | 'Unpaid'
  tier: CustomerTier
}

export const customerHistorySummary = {
  total: 847,
  fullyPaid: 710,
  outstanding: 137,
  totalRevenue: 1_440_000,
}

export const customerHistory: CustomerHistoryEntry[] = [
  { customerId: 'CUST-2026-1234', name: 'Juan Dela Cruz', contact: '+63 995 123 4567', vehicle: '2022 Tesla Model 3', jobs: 8, totalSpent: 62400, lastService: '2024-12-18', payment: 'Paid', tier: 'Loyal Customer' },
  { customerId: 'CUST-2026-1235', name: 'Elmer Villanueva', contact: '+63 920 888 1122', vehicle: '2019 Honda Civic', jobs: 4, totalSpent: 21200, lastService: '2024-12-17', payment: 'Paid', tier: 'Regular' },
  { customerId: 'CUST-2026-1236', name: 'Vince Navarro', contact: '+63 916 222 5555', vehicle: '2021 Nissan Terra', jobs: 2, totalSpent: 7000, lastService: '2024-12-16', payment: 'Unpaid', tier: 'New' },
  { customerId: 'CUST-2026-1237', name: 'Maria Santos', contact: '+63 917 400 9900', vehicle: '2020 Toyota Fortuner', jobs: 12, totalSpent: 98750, lastService: '2024-12-15', payment: 'Paid', tier: 'VIP' },
  { customerId: 'CUST-2026-1238', name: 'Carlo Reyes', contact: '+63 999 321 0011', vehicle: '2018 Mitsubishi Strada', jobs: 6, totalSpent: 44600, lastService: '2024-12-14', payment: 'Paid', tier: 'Regular' },
  { customerId: 'CUST-2026-1239', name: 'Andrea Lim', contact: '+63 906 711 2233', vehicle: '2023 Kia Stinger', jobs: 3, totalSpent: 12300, lastService: '2024-12-13', payment: 'Unpaid', tier: 'New' },
  { customerId: 'CUST-2026-1240', name: 'Rico Bautista', contact: '+63 915 877 6644', vehicle: '2017 Ford Ranger', jobs: 9, totalSpent: 77100, lastService: '2024-12-12', payment: 'Paid', tier: 'Loyal Customer' },
  { customerId: 'CUST-2026-1241', name: 'Jasmine Torres', contact: '+63 928 554 3310', vehicle: '2021 Hyundai Tucson', jobs: 1, totalSpent: 3900, lastService: '2024-12-11', payment: 'Unpaid', tier: 'New' },
]

// ---------------------------------------------------------------------------

export const currency = (value: number) => `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
