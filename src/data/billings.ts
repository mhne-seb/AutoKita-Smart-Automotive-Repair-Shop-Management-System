// Types

export type PaymentStatus = "paid" | "downpayment" | "pending" | "verifying";

export type ServiceItem = {
  name: string;
  category: "Parts" | "Labor";
  qty: number;
  price: number;
};

export type Service = {
  id: string;
  invoice: string;
  name: string;
  vehicle: string;
  date: string;
  items: ServiceItem[];
  amountPaid: number;
  status: PaymentStatus;
};

export type Warranty = {
  t: string;
  vehicle: string;
  status: "Active" | "Expiring Soon" | "Expired" | "Claimed";
  comp: string;
  expires: string;
  purchased: string;
  terms: string;
  image: string;
};

// Constants
export const CATEGORY_ORDER: ServiceItem["category"][] = ["Parts", "Labor"];


// Warranty images (random assignment from local assets)
const WARRANTY_IMAGE_POOL = [
  "/assets/engine/e1.png",
  "/assets/engine/e2.jpg",
  "/assets/engine/e3.jpeg",
  "/assets/engine/e4.jpg",
  "/assets/engine/e5.jpg",
  "/assets/ac/a3.webp",
  "/assets/ac/a4.jpg",
  "/assets/ac/a5.jpg",
  "/assets/ac/a6.jpg",
  "/assets/diagnostic/c1.jpg",
  "/assets/diagnostic/c2.jpg",
  "/assets/diagnostic/c3.jpg",
  "/assets/diagnostic/c4.jpg",
  "/assets/diagnostic/c5.jpg",
  "/assets/diagnostic/c6.jpg",
  "/assets/cars/honda.jpg",
  "/assets/cars/tesla.jpg",
];

function randomImage() {
  return WARRANTY_IMAGE_POOL[Math.floor(Math.random() * WARRANTY_IMAGE_POOL.length)];
}

export const REWARDS_BANNER_IMAGE = "/assets/cars/tesla.jpg";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
export const INITIAL_SERVICES: Service[] = [
  {
    id: "srv-1",
    invoice: "INV-2024-0891",
    name: "Oil Change & Brake Service",
    vehicle: "Toyota Camry (ABC-1234)",
    date: "October 24, 2023",
    items: [
      { name: "Engine Oil Filter Replacement", category: "Parts", qty: 1, price: 145 },
      { name: "Synthetic Motor Oil (5W-30)", category: "Parts", qty: 5, price: 100 },
      { name: "Brake Pad Replacement (Front)", category: "Parts", qty: 2, price: 350 },
      { name: "Standard Multi-Point Inspection", category: "Labor", qty: 1, price: 300 },
      { name: "Brake System Labor Charge", category: "Labor", qty: 1, price: 300 },
    ],
    amountPaid: 0,
    status: "pending",
  },
  {
    id: "srv-2",
    invoice: "INV-2024-0872",
    name: "Wheel Alignment & Tire Rotation",
    vehicle: "Toyota Camry (ABC-1234)",
    date: "September 2, 2023",
    items: [
      { name: "4-Wheel Alignment", category: "Labor", qty: 1, price: 850 },
      { name: "Tire Rotation Service", category: "Labor", qty: 1, price: 250 },
    ],
    amountPaid: 550,
    status: "downpayment",
  },
  {
    id: "srv-3",
    invoice: "INV-2024-0803",
    name: "Annual Preventive Maintenance",
    vehicle: "Toyota Camry (ABC-1234)",
    date: "July 15, 2023",
    items: [
      { name: "Air Filter Replacement", category: "Parts", qty: 1, price: 220 },
      { name: "Spark Plug Set", category: "Parts", qty: 4, price: 90 },
      { name: "Full Diagnostic & Tune-up", category: "Labor", qty: 1, price: 600 },
    ],
    amountPaid: 1180,
    status: "paid",
  },
];

export const WARRANTIES: Warranty[] = [
  {
    t: "Engine Shield Platinum",
    vehicle: "Toyota Camry (ABC-1234)",
    status: "Active",
    comp: "Pistons, Camshaft, Crankshaft",
    expires: "Aug 12, 2026",
    purchased: "Aug 12, 2025",
    terms:
      "Covers parts and labor for internal engine component failure under normal use. Excludes damage from lack of maintenance or unauthorized modification.",
    image: randomImage(),
  },
  {
    t: "Brake Safety Guard",
    vehicle: "Toyota Camry (ABC-1234)",
    status: "Expiring Soon",
    comp: "Brake Pads & Rotors",
    expires: "Aug 12, 2026",
    purchased: "Aug 12, 2025",
    terms: "Covers replacement of brake pads and rotors due to premature wear. One claim per 12-month period.",
    image: randomImage(),
  },
  {
    t: "Standard Transmission",
    vehicle: "Toyota Camry (ABC-1234)",
    status: "Active",
    comp: "Gearbox & Clutch Assembly",
    expires: "Aug 12, 2026",
    purchased: "Aug 12, 2025",
    terms: "Covers gearbox and clutch assembly repair or replacement due to manufacturing defect or normal wear.",
    image: randomImage(),
  },
];

export const WARRANTY_HISTORY: Warranty[] = [
  ...WARRANTIES,
  {
    t: "Basic Paint Protection",
    vehicle: "Toyota Camry (ABC-1234)",
    status: "Expired",
    comp: "Exterior Paint & Clear Coat",
    expires: "Mar 10, 2024",
    purchased: "Mar 10, 2023",
    terms: "Covered clear coat peeling and fading under normal outdoor exposure.",
    image: randomImage(),
  },
  {
    t: "AC System Cover",
    vehicle: "Toyota Camry (ABC-1234)",
    status: "Claimed",
    comp: "Compressor & Condenser",
    expires: "Jan 5, 2024",
    purchased: "Jan 5, 2023",
    terms: "Covered compressor and condenser failure. Claim filed and resolved on Nov 8, 2023.",
    image: randomImage(),
  },
];

export interface Rewards {
  tier: string
  nextTier: string
  pointsToNextTier: number
  redeemable: { id: string; name: string; cost: number; image: string }[]
}

export const REWARDS: Rewards = {
  tier: "Gold Member",
  nextTier: "Platinum Member",
  pointsToNextTier: 2000,
  redeemable: [
    { id: "r1", name: "20% Off Next Wheel Alignment", cost: 500, image: randomImage() },
    { id: "r2", name: "Free Diagnostic Check", cost: 300, image: randomImage() },
    { id: "r3", name: "₱200 Service Voucher", cost: 800, image: randomImage() },
  ],
};

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------
export const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  paid: { label: "Paid", className: "bg-[color:oklch(0.93_0.06_155)] text-success" },
  downpayment: { label: "Downpayment", className: "bg-[color:oklch(0.94_0.06_80)] text-warning" },
  pending: { label: "Pending Payment", className: "bg-[color:oklch(0.9_0.05_240)] text-brand" },
  verifying: { label: "Verifying Payment", className: "bg-[color:oklch(0.92_0.05_300)] text-brand" },
};

export const WARRANTY_STATUS_STYLE: Record<Warranty["status"], string> = {
  Active: "text-success",
  "Expiring Soon": "text-warning",
  Expired: "text-muted-foreground",
  Claimed: "text-brand",
};

// ---------------------------------------------------------------------------
// Formatting / calculation helpers
// ---------------------------------------------------------------------------
export const peso = (n: number) =>
  n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const serviceTotal = (s: Service) =>
  s.items.reduce((sum, i) => sum + i.qty * i.price, 0);