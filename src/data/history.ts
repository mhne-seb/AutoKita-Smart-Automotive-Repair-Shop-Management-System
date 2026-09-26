// Types for the Service History page. Data itself comes from
// billingController.getServiceHistory() (real job order records) — see
// app/api/customer/history/route.ts.

export type ServiceItem = [description: string, amount: string];

export type ServiceStatus = "Completed" | "Cancelled";

export type ServiceRecord = {
  id: string;
  jobOrderId: number;
  date: string; // display string, e.g. "Oct 24, 2023"
  isoDate: string; // ISO string used for real date-range filtering/sorting
  vehicle: string;
  desc: string;
  amt: string;
  status: ServiceStatus;
  mechanic: string;
  location: string;
  items: ServiceItem[];
};
