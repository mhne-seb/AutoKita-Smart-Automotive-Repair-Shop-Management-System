'use client'


import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Wrench,
  Gauge,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Check,
  Hash,
  ClipboardCheck,
  User,
  X,
  MapPin,
  Search,
  CreditCard,
  RefreshCw,
  Loader2,
  Sparkles,
  Car,
  Inbox,
  ShieldCheck,
  Download,
  Calendar,
  CalendarClock,
  Camera,
  XCircle,
  Gift,
  Copy,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { VehicleInServiceModal } from "@/components/dashboard/VehicleInServiceModal";
import { NotificationsModal } from "@/components/NotificationsModal";
import { loadCustomerNotifications } from "@/lib/notificationFeeds";
import { ShopLoading } from "@/components/ShopLoading";
import { requiresDiagnosticScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import type {
  DashboardData,
  DashboardActivity,
  DashboardJobOrder,
  DashboardPendingTicket,
  DashboardShop,
} from "@/controllers/dashboardController";
import { getCompletedData } from "@/controllers/serviceProgressController";
import { fetchJobOrderPdfData, generateJobOrderPdf } from "@/lib/jobOrderPdf";
import { formatStamp, cn } from "@/lib/utils";
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from "@/lib/plate";
import { TimeslotPicker } from "@/components/TimeslotPicker";
import { toManilaIso } from "@/lib/bookingSlotsShared";

import { Modal } from "@/components/dashboard/Modal";

const CURRENT_USER_ID = 280;

function formatMoney(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Service Report modal — shown for completed/released job orders instead of the tracker.
// Reuses the same data source as the Completed tracking page so the numbers always match.

function formatDashboardLogTime(iso: string | null | undefined) {
  return formatStamp(iso);
}

type ReportTimelineEntry = {
  key: string;
  label: string;
  detail?: string;
  time?: string | null;
  status: "completed" | "active" | "pending";
  image?: string;
};

function buildReportTimeline(data: Awaited<ReturnType<typeof getCompletedData>>): ReportTimelineEntry[] {
  const { jobOrder, logs } = data;
  if (!jobOrder) return [];
  const jo: any = jobOrder;

  return [
    {
      key: "received",
      label: "Vehicle Received",
      detail: `${jobOrder.vehicle_year} ${jobOrder.vehicle_model} checked in at the shop.`,
      time: formatDashboardLogTime(jo.date_arrived) || null,
      status: "completed",
    },
    {
      key: "inspecting",
      label: "Mechanic Inspecting Vehicle",
      detail: "Technician performed the pre-diagnostic inspection.",
      time: formatDashboardLogTime(jo.date_arrived) || null,
      status: "completed",
    },
    {
      key: "inspection_completed",
      label: "Inspection Completed",
      detail: "Findings logged and quotation drafting started.",
      time: formatDashboardLogTime(jo.inspection_completed_at) || null,
      status: "completed",
    },
    {
      key: "quotation_prepared",
      label: "Quotation Prepared",
      detail: "Service quotation was sent for your review.",
      time: formatDashboardLogTime(jo.quotation_prepared_at) || null,
      status: "completed",
    },
    {
      key: "downpayment",
      label: "Downpayment / Confirmation Received",
      detail: "Quotation confirmed and servicing authorized.",
      time: formatDashboardLogTime(jo.downpayment_received_at) || null,
      status: "completed",
    },
    ...logs.map((log) => ({
      key: `log-${log.id}`,
      label: log.activity_description,
      time: formatDashboardLogTime(log.log_time),
      status: "completed" as const,
    })),
    {
      key: "service_completed",
      label: "Vehicle Service Completed",
      detail: "All confirmed services finished by our technicians.",
      time: null,
      status: "completed",
    },
  ];
}

export function ServiceReportModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCompletedData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id")) || CURRENT_USER_ID;
    getCompletedData(userId, jobId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [jobId]);

  const [downloading, setDownloading] = useState(false);
  const handleDownload = async () => {
    if (!data?.jobOrder) return;
    setDownloading(true);
    const pdfData = await fetchJobOrderPdfData(data.jobOrder.job_order_id);
    setDownloading(false);
    if (!pdfData) return;
    void generateJobOrderPdf(pdfData);
  };

  return (
    <Modal onClose={onClose} panelClassName="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">Service Report</h3>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : error || !data?.jobOrder ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Report not available for this service yet.</p>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-brand-soft/40 p-4 text-sm">
                <div className="font-semibold">
                  {data.jobOrder.vehicle_year} {data.jobOrder.vehicle_model} — {data.jobOrder.plate_number}
                </div>
                <div className="text-xs text-muted-foreground">Job Order #JO-{data.jobOrder.job_order_id}</div>
              </div>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Service Timeline</div>
                  <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold">
                    {buildReportTimeline(data).length} Milestones
                  </span>
                </div>
                <div className="mt-3">
                  {buildReportTimeline(data).map((entry, idx, arr) => {
                    const isLast = idx === arr.length - 1;
                    const badgeLabel = entry.status === "completed" ? "Completed" : entry.status === "active" ? "Active" : "Pending";
                    const badgeClasses =
                      entry.status === "completed"
                        ? "bg-success/15 text-[color:oklch(0.5_0.16_145)]"
                        : entry.status === "active"
                        ? "bg-brand-soft text-brand"
                        : "bg-muted text-muted-foreground";

                    return (
                      <div key={entry.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div
                            className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                              entry.status === "completed"
                                ? "border-muted-foreground/40 bg-background"
                                : entry.status === "active"
                                ? "border-brand bg-background"
                                : "border-muted-foreground/20 bg-background"
                            }`}
                          >
                            {entry.status === "active" && (
                              <>
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30" />
                                <span className="relative h-2.5 w-2.5 rounded-full bg-brand" />
                              </>
                            )}
                            {entry.status === "completed" && (
                              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" strokeWidth={2} />
                            )}
                          </div>
                          {!isLast && <div className="w-px flex-1 bg-border" />}
                        </div>

                        <div className={`min-w-0 flex-1 ${isLast ? "pb-0" : "pb-5"}`}>
                          <div className="flex w-full items-start justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold">{entry.label}</div>
                              {entry.detail && (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">{entry.detail}</p>
                              )}
                              {entry.time && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {entry.time}
                                </div>
                              )}
                            </div>
                            <span className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClasses}`}>
                              {badgeLabel}
                            </span>
                          </div>

                          {entry.key === "released" && entry.image && (
                            <img
                              src={entry.image}
                              alt="Vehicle release proof"
                              className="mt-2 aspect-video w-full max-w-sm rounded-lg border object-cover"
                            />
                          )}
                          {entry.key === "released" && !entry.image && entry.status !== "completed" && (
                            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Camera className="h-3 w-3" /> Release photo will appear here once the vehicle is handed back.
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 space-y-2 text-sm">
                <div className="font-semibold">Technician Labor</div>
                {data.services.map((s) => (
                  <div key={s.id} className="flex justify-between text-muted-foreground">
                    <span>{s.service_name}</span>
                    <span>₱{formatMoney(s.actual_amount)}</span>
                  </div>
                ))}
                <div className="mt-3 font-semibold">Replaced Parts</div>
                {data.parts.map((p) => (
                  <div key={p.id} className="flex justify-between text-muted-foreground">
                    <span>{p.description} x{p.quantity}</span>
                    <span>₱{formatMoney(p.total_retail_amount)}</span>
                  </div>
                ))}
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold">₱{formatMoney(data.bill?.total)}</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Paid (verified)</span>
                  <span>− ₱{formatMoney(data.bill?.paid)}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="font-semibold">Balance Due</span>
                  <span className={`text-lg font-bold ${(data.bill?.balance ?? 0) > 0 ? "text-teal" : "text-success"}`}>₱{formatMoney(data.bill?.balance)}</span>
                </div>
              </div>

              {(data.bill?.balance ?? 0) > 0 && (
                <Link
                  href={`/dashboard/tracking/billing?jobOrderId=${jobId}`}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md"
                >
                  <CreditCard className="h-4 w-4" /> Pay Remaining Balance
                </Link>
              )}

              {data.warranties.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Warranties</div>
                  <div className="mt-2 space-y-1 text-sm">
                    {data.warranties.map((w) => (
                      <div key={w.id} className="flex items-center justify-between">
                        <span>{w.coverage_description}</span>
                        <ShieldCheck className="h-3.5 w-3.5 text-teal" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground cursor-pointer transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 hover:shadow-md hover:opacity-90 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Job Order
              </button>
            </>
          )}
        </>
      )}
    </Modal>
  );
}


