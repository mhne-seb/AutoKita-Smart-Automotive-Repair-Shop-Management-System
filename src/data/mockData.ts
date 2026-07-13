// Central mock data for the AutoKita admin dashboard

export type JobStatus = 'Pending' | 'Approved' | 'In Progress' | 'Completed' | 'Cancelled'
export type ServiceMode = 'Shop Visit' | 'Home Service'

export interface Customer {
  customerId: string
  name: string
  phone: string
  vehicle: string
  plate: string
  serviceMode: ServiceMode
  status: JobStatus
  servicesNeeded: string[]
  assignedMechanic: string | null
  totalCost: number
  balanceDue: number
  lastService: string
  jobOrderId: string
}

export const customers: Customer[] = [
  {
    customerId: 'CUST-2026-1234',
    name: 'Juan Dela Cruz',
    phone: '+63 995 123 4567',
    vehicle: 'Tesla Model 3 2022',
    plate: 'ABC 1234',
    serviceMode: 'Shop Visit',
    status: 'In Progress',
    servicesNeeded: ['Engine Tune-up', 'Spark Plug Replacement', 'Synthetic Oil Change'],
    assignedMechanic: 'Jose Santos',
    totalCost: 71558,
    balanceDue: 46550,
    lastService: '2026-05-27',
    jobOrderId: 'JO-1234',
  },
  {
    customerId: 'CUST-2026-1235',
    name: 'Elmer Villanueva',
    phone: '+63 920 888 1122',
    vehicle: 'Honda Civic 2019',
    plate: 'XYZ 9999',
    serviceMode: 'Home Service',
    status: 'Approved',
    servicesNeeded: ['Brake Pad Replacement', 'Rotors Resurfacing', 'Brake Fluid Flush'],
    assignedMechanic: 'Jose Santos',
    totalCost: 45000,
    balanceDue: 45000,
    lastService: '2026-05-28',
    jobOrderId: 'JO-1235',
  },
  {
    customerId: 'CUST-2026-1236',
    name: 'Vince Navarro',
    phone: '+63 916 222 5555',
    vehicle: 'Nissan Terra 2021',
    plate: 'NDG 1124',
    serviceMode: 'Shop Visit',
    status: 'Pending',
    servicesNeeded: ['EGR Cleaning', 'Fuel Filter Replacement'],
    assignedMechanic: null,
    totalCost: 12400,
    balanceDue: 0,
    lastService: '2026-05-20',
    jobOrderId: 'JO-1236',
  },
  {
    customerId: 'CUST-2026-1237',
    name: 'Tonyo Cruz',
    phone: '+63 915 555 4321',
    vehicle: 'Mitsubishi Montero 2022',
    plate: 'DEF 5678',
    serviceMode: 'Home Service',
    status: 'Pending',
    servicesNeeded: ['A/C Cleaning & Recharge', 'Cabin Filter Replacement'],
    assignedMechanic: null,
    totalCost: 8900,
    balanceDue: 2000,
    lastService: '2026-05-17',
    jobOrderId: 'JO-1237',
  },
  {
    customerId: 'CUST-2026-1238',
    name: 'Dodong Mendoza',
    phone: '+63 917 444 9090',
    vehicle: 'Ford Ranger 2020',
    plate: 'GHI 4321',
    serviceMode: 'Shop Visit',
    status: 'In Progress',
    servicesNeeded: ['Suspension Check', 'Wheel Alignment'],
    assignedMechanic: 'Robert Dizon',
    totalCost: 54200,
    balanceDue: 12000,
    lastService: '2026-05-22',
    jobOrderId: 'JO-1238',
  },
]

// ---------------------------------------------------------------------------

export interface Mechanic {
  id: string
  name: string
  branch: string
  email: string
  phone: string
  location: string
  status: 'Available' | 'Busy'
  jobsAssigned: number
  jobsCapacity: number
  rank: string
  baseSalary: number
  commissionPercent: number
  servicesDoneWeekly: number
  color: string
}

export const mechanics: Mechanic[] = [
  {
    id: 'MCH-01',
    name: 'Jose Santos',
    branch: 'AutoKita Main Branch',
    email: 'jose.santos@autokita.com',
    phone: '+63 917 000 1234',
    location: 'Manila, Philippines',
    status: 'Busy',
    jobsAssigned: 4,
    jobsCapacity: 5,
    rank: '1 (Senior Mechanic)',
    baseSalary: 12000,
    commissionPercent: 15,
    servicesDoneWeekly: 14,
    color: 'bg-pink-500',
  },
  {
    id: 'MCH-02',
    name: 'Anthony Tan',
    branch: 'AutoKita Main Branch',
    email: 'anthony.tan@autokita.com',
    phone: '+63 917 000 4321',
    location: 'Manila, Philippines',
    status: 'Available',
    jobsAssigned: 1,
    jobsCapacity: 5,
    rank: '3 (Junior Mechanic)',
    baseSalary: 9500,
    commissionPercent: 12,
    servicesDoneWeekly: 8,
    color: 'bg-red-500',
  },
  {
    id: 'MCH-03',
    name: 'Robert Dizon',
    branch: 'AutoKita Main Branch',
    email: 'robert.dizon@autokita.com',
    phone: '+63 917 000 1324',
    location: 'Manila, Philippines',
    status: 'Busy',
    jobsAssigned: 5,
    jobsCapacity: 5,
    rank: '2 (Lead Inspector)',
    baseSalary: 14000,
    commissionPercent: 10,
    servicesDoneWeekly: 11,
    color: 'bg-emerald-500',
  },
]

// ---------------------------------------------------------------------------

export interface RevenuePoint {
  month: string
  revenue: number
  jobsCompleted: number
}

export const revenueTrend: RevenuePoint[] = [
  { month: 'Dec', revenue: 130000, jobsCompleted: 18 },
  { month: 'Jan', revenue: 148000, jobsCompleted: 20 },
  { month: 'Feb', revenue: 142000, jobsCompleted: 19 },
  { month: 'Mar', revenue: 205000, jobsCompleted: 26 },
  { month: 'Apr', revenue: 300000, jobsCompleted: 34 },
  { month: 'May', revenue: 310000, jobsCompleted: 33 },
]

export interface ServiceMixSlice {
  label: string
  percent: number
  color: string
}

export const serviceMix: ServiceMixSlice[] = [
  { label: 'Change Oil', percent: 38, color: '#0f172a' },
  { label: 'Brake Service', percent: 22, color: '#10b981' },
  { label: 'Transmission', percent: 12, color: '#f59e0b' },
  { label: 'Turbo Cleaning', percent: 9, color: '#8b5cf6' },
  { label: 'Electrical', percent: 11, color: '#ec4899' },
  { label: 'Others', percent: 8, color: '#94a3b8' },
]

// ---------------------------------------------------------------------------

export interface ChurnRow {
  customerId: string
  name: string
  contact: string
  churnStatus: 'New Customer' | 'High Churn Risk' | 'Medium Churn Risk' | 'Loyal Customer'
  vehicle: string
  mileage: string
  lastCheckup: string
  // Total number of completed visits/services for this customer.
  // Anything below 2 is treated as "New Customer" regardless of lastCheckup,
  // since there isn't enough history yet to judge churn risk.
  serviceCount: number
  offer: string
}

export const churnList: ChurnRow[] = [
  {
    customerId: 'CUST-2026-1234',
    name: 'Juan Dela Cruz',
    contact: '+63 995 123 4567',
    churnStatus: 'High Churn Risk',
    vehicle: '2022 Tesla Model 3',
    mileage: '78,450 mi',
    lastCheckup: '2026-05-27',
    serviceCount: 5,
    offer: 'Free Oil Change Reminder',
  },
  {
    customerId: 'CUST-2026-1235',
    name: 'Elmer Villanueva',
    contact: '+63 920 888 1122',
    churnStatus: 'Medium Churn Risk',
    vehicle: '2019 Honda Civic',
    mileage: '42,550 mi',
    lastCheckup: '2026-05-28',
    serviceCount: 3,
    offer: '15% Discount Maintenance Promo',
  },
  {
    customerId: 'CUST-2026-1236',
    name: 'Vince Navarro',
    contact: '+63 916 222 5555',
    churnStatus: 'Loyal Customer',
    vehicle: '2021 Nissan Terra',
    mileage: '10,550 mi',
    lastCheckup: '2026-05-20',
    serviceCount: 7,
    offer: 'Quick-Service Special Offer',
  },
  {
    customerId: 'CUST-2026-1237',
    name: 'Tonyo Cruz',
    contact: '+63 915 555 4321',
    churnStatus: 'New Customer',
    vehicle: '2022 Mitsubishi Montero',
    mileage: '3,200 mi',
    lastCheckup: '2026-05-17',
    serviceCount: 1,
    offer: 'Welcome New Customer Promo',
  },
  {
    customerId: 'CUST-2026-1238',
    name: 'Dodong Mendoza',
    contact: '+63 917 444 9090',
    churnStatus: 'New Customer',
    vehicle: '2020 Ford Ranger',
    mileage: '1,050 mi',
    lastCheckup: '2026-05-22',
    serviceCount: 1,
    offer: 'Welcome New Customer Promo',
  },
]

// ---------------------------------------------------------------------------

// A single line item on a customer's invoice — grouped as Parts or Labor
// in the payment record modal / downloadable invoice.
export interface PaymentItem {
  category: 'Parts' | 'Labor'
  name: string
  qty: number
  price: number
}

export interface PaymentRecord {
  customerId: string
  name: string
  contact: string
  services: string
  modeOfPayment: string
  paymentType: 'Full Payment' | 'Downpayment'
  // For 'Full Payment' records, this is the total amount paid.
  // For 'Downpayment' records, this is the remaining BALANCE DUE
  // (i.e. subtotal from `items` minus `downpaymentAmount`).
  amount: number
  status: 'Paid' | 'To Be Paid'
  // Itemized parts/labor breakdown shown in the payment modal and invoice.
  // Falls back to the plain `services` string if omitted.
  items?: PaymentItem[]
  // Amount already received as downpayment. Only relevant when
  // paymentType === 'Downpayment'.
  downpaymentAmount?: number
}

export const paymentRecords: PaymentRecord[] = [
  {
    customerId: 'CUS-2026-1434',
    name: 'Mario Dela Cruz',
    contact: '+63 917 123 4567',
    services: 'Engine Oil Replacement, Brake Pads',
    modeOfPayment: 'GCash',
    paymentType: 'Full Payment',
    amount: 300,
    status: 'Paid',
    items: [
      { category: 'Labor', name: 'Engine Oil Replacement', qty: 1, price: 200 },
      { category: 'Parts', name: 'Brake Pads', qty: 1, price: 100 },
    ],
  },
  {
    customerId: 'CUS-2026-1934',
    name: 'Ana Reyes',
    contact: '+63 918 234 5678',
    services: 'Battery Diagnostic & Swap',
    modeOfPayment: 'Cash',
    paymentType: 'Downpayment',
    amount: 900, // balance due
    status: 'To Be Paid',
    items: [
      { category: 'Parts', name: 'Replacement Battery', qty: 1, price: 1500 },
      { category: 'Labor', name: 'Battery Diagnostic Service', qty: 1, price: 300 },
    ],
    downpaymentAmount: 900, // subtotal 1800 - downpayment 900 = 900 balance
  },
  {
    customerId: 'CUS-2026-1644',
    name: 'Roberto Lim',
    contact: '+63 920 345 6789',
    services: 'Full Underchassis Checkup',
    modeOfPayment: 'Credit Card',
    paymentType: 'Full Payment',
    amount: 950,
    status: 'Paid',
    items: [{ category: 'Labor', name: 'Full Underchassis Checkup', qty: 1, price: 950 }],
  },
  {
    customerId: 'CUS-2026-1874',
    name: 'Josephine Santos',
    contact: '+63 915 456 7890',
    services: 'Engine Oil Replacement',
    modeOfPayment: 'Maya',
    paymentType: 'Downpayment',
    amount: 600, // balance due
    status: 'To Be Paid',
    items: [{ category: 'Labor', name: 'Engine Oil Replacement', qty: 1, price: 1200 }],
    downpaymentAmount: 600, // subtotal 1200 - downpayment 600 = 600 balance
  },
  {
    customerId: 'CUS-2026-1904',
    name: 'Bernard Tan',
    contact: '+63 916 567 8901',
    services: 'Brake Pads Installation, Battery Diagnostic',
    modeOfPayment: 'Bank Transfer',
    paymentType: 'Full Payment',
    amount: 900,
    status: 'Paid',
    items: [
      { category: 'Parts', name: 'Brake Pads', qty: 1, price: 300 },
      { category: 'Labor', name: 'Battery Diagnostic Service', qty: 1, price: 600 },
    ],
  },
  {
    customerId: 'CUS-2026-1294',
    name: 'Cristina Villanueva',
    contact: '+63 921 678 9012',
    services: 'Full Underchassis Checkup',
    modeOfPayment: 'GCash',
    paymentType: 'Downpayment',
    amount: 475, // balance due
    status: 'To Be Paid',
    items: [{ category: 'Labor', name: 'Full Underchassis Checkup', qty: 1, price: 950 }],
    downpaymentAmount: 475, // subtotal 950 - downpayment 475 = 475 balance
  },
]

export interface WeeklyService {
  name: string
  qty: number
  price: number
  allocatedCommission: number
}

export const weeklyServices: WeeklyService[] = [
  { name: 'Engine Oil Replacement', qty: 24, price: 1200, allocatedCommission: 4320 },
  { name: 'Brake Pads Installation', qty: 18, price: 2100, allocatedCommission: 3780 },
  { name: 'Battery Diagnostic & Swap', qty: 12, price: 1800, allocatedCommission: 2160 },
  { name: 'Full Underchassis Checkup', qty: 32, price: 950, allocatedCommission: 3040 },
]

// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string
  user: string
  employee: string
  action: string
  entityType: string
  entityId: string
  date: string
}

export const auditLog: AuditLogEntry[] = [
  {
    id: '#DB-4892',
    user: 'Boss Boyet',
    employee: 'Boss Boyet',
    action: 'Modified Job Order Details',
    entityType: 'Job Order Table',
    entityId: 'JO-2026-1234',
    date: '2026-05-27',
  },
]

// ---------------------------------------------------------------------------

export const currency = (value: number) =>
  `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`