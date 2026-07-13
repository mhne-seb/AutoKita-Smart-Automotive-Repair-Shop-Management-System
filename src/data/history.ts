// Sample/mock data for the Service History page.

export type ServiceItem = [description: string, amount: string];

export type ServiceStatus = "Completed" | "Cancelled";

export type ServiceRecord = {
  id: string;
  date: string; // display string, e.g. "Oct 24, 2023"
  isoDate: string; // ISO string used for real date-range filtering/sorting
  vehicle: string;
  desc: string;
  amt: string;
  status: ServiceStatus;
  mechanic: string;
  location: string;
  warranty: string;
  items: ServiceItem[];
};

export const SERVICE_HISTORY: ServiceRecord[] = [
  {
    id: "BK-9021",
    date: "Oct 24, 2023",
    isoDate: "2023-10-24",
    vehicle: "Toyota Camry (ABC-1234)",
    desc: "Full Engine Diagnostic",
    amt: "1,945.00",
    status: "Completed",
    mechanic: "Rico Salvador",
    location: "AutoKita Plaza - Manila",
    warranty: "12 mo / 12,000 mi",
    items: [
      ["Diagnostic Scan", "500.00"],
      ["Sensor Calibration", "600.00"],
      ["Labor", "845.00"],
    ],
  },
  {
    id: "BK-8842",
    date: "Sep 12, 2023",
    isoDate: "2023-09-12",
    vehicle: "Toyota Camry (ABC-1234)",
    desc: "Major Interval Service (60k)",
    amt: "550.00",
    status: "Completed",
    mechanic: "Nico Cruz",
    location: "AutoKita Plaza - Manila",
    warranty: "6 mo / 6,000 mi",
    items: [
      ["Oil Change", "250.00"],
      ["Filter Replacement", "150.00"],
      ["Labor", "150.00"],
    ],
  },
  {
    id: "BK-8510",
    date: "Aug 05, 2023",
    isoDate: "2023-08-05",
    vehicle: "Honda CR-V (XYZ-9876)",
    desc: "Brake Pad Replacement",
    amt: "1,500.00",
    status: "Completed",
    mechanic: "Rico Salvador",
    location: "AutoKita Plaza - Manila",
    warranty: "12 mo / 12,000 mi",
    items: [
      ["Brake Pads (Front)", "900.00"],
      ["Labor", "600.00"],
    ],
  },
  {
    id: "BK-8201",
    date: "Jun 18, 2023",
    isoDate: "2023-06-18",
    vehicle: "Toyota Camry (ABC-1234)",
    desc: "Oil Change & Tire Rotation",
    amt: "2,000.00",
    status: "Completed",
    mechanic: "Ella Reyes",
    location: "AutoKita Plaza - Manila",
    warranty: "6 mo",
    items: [
      ["Synthetic Oil (5W-30)", "1,200.00"],
      ["Tire Rotation", "500.00"],
      ["Labor", "300.00"],
    ],
  },
  {
    id: "BK-7944",
    date: "May 10, 2023",
    isoDate: "2023-05-10",
    vehicle: "Honda CR-V (XYZ-9876)",
    desc: "AC Gas Refill",
    amt: "1,890.00",
    status: "Cancelled",
    mechanic: "—",
    location: "—",
    warranty: "—",
    items: [],
  },
  {
    id: "BK-7710",
    date: "Apr 02, 2023",
    isoDate: "2023-04-02",
    vehicle: "Ford Ranger (DEF-4567)",
    desc: "Wheel Alignment & Balancing",
    amt: "1,200.00",
    status: "Completed",
    mechanic: "Nico Cruz",
    location: "AutoKita Plaza - Manila",
    warranty: "3 mo",
    items: [
      ["4-Wheel Alignment", "700.00"],
      ["Wheel Balancing", "500.00"],
    ],
  },
  {
    id: "BK-7502",
    date: "Feb 20, 2023",
    isoDate: "2023-02-20",
    vehicle: "Honda CR-V (XYZ-9876)",
    desc: "Battery Replacement",
    amt: "4,500.00",
    status: "Completed",
    mechanic: "Ella Reyes",
    location: "AutoKita Plaza - Manila",
    warranty: "18 mo",
    items: [
      ["Maintenance-Free Battery", "4,200.00"],
      ["Labor", "300.00"],
    ],
  },
  {
    id: "BK-7280",
    date: "Jan 15, 2023",
    isoDate: "2023-01-15",
    vehicle: "Ford Ranger (DEF-4567)",
    desc: "Transmission Fluid Flush",
    amt: "3,100.00",
    status: "Completed",
    mechanic: "Rico Salvador",
    location: "AutoKita Plaza - Manila",
    warranty: "12 mo",
    items: [
      ["ATF Fluid (4L)", "2,400.00"],
      ["Labor", "700.00"],
    ],
  },
  {
    id: "BK-6990",
    date: "Dec 03, 2022",
    isoDate: "2022-12-03",
    vehicle: "Toyota Camry (ABC-1234)",
    desc: "Aircon Compressor Repair",
    amt: "6,800.00",
    status: "Completed",
    mechanic: "Nico Cruz",
    location: "AutoKita Plaza - Manila",
    warranty: "12 mo",
    items: [
      ["AC Compressor", "5,600.00"],
      ["Refrigerant Recharge", "600.00"],
      ["Labor", "600.00"],
    ],
  },
  {
    id: "BK-6750",
    date: "Oct 28, 2022",
    isoDate: "2022-10-28",
    vehicle: "Honda CR-V (XYZ-9876)",
    desc: "Timing Belt Replacement",
    amt: "5,200.00",
    status: "Cancelled",
    mechanic: "—",
    location: "—",
    warranty: "—",
    items: [],
  },
  {
    id: "BK-6510",
    date: "Sep 09, 2022",
    isoDate: "2022-09-09",
    vehicle: "Ford Ranger (DEF-4567)",
    desc: "Suspension Check-up",
    amt: "980.00",
    status: "Completed",
    mechanic: "Ella Reyes",
    location: "AutoKita Plaza - Manila",
    warranty: "3 mo",
    items: [["Inspection & Labor", "980.00"]],
  },
  {
    id: "BK-6300",
    date: "Jul 22, 2022",
    isoDate: "2022-07-22",
    vehicle: "Toyota Camry (ABC-1234)",
    desc: "Spark Plug Replacement",
    amt: "1,350.00",
    status: "Completed",
    mechanic: "Rico Salvador",
    location: "AutoKita Plaza - Manila",
    warranty: "6 mo",
    items: [
      ["Iridium Spark Plugs (4)", "950.00"],
      ["Labor", "400.00"],
    ],
  },
];

// Shop details used on the printable/downloadable invoice.
export const SHOP_INFO = {
  name: "AutoKita Auto Service Center",
  tagline: "Trusted Vehicle Care, Every Mile",
  address: "123 Aurora Blvd, Brgy. San Isidro, Quezon City, Metro Manila, Philippines 1113",
  phone: "+63 2 8123 4567",
  email: "support@autokita.ph",
  tin: "123-456-789-000",
};