'use client'

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, FileText, Wrench, ShieldCheck, Printer, Download, Clock, Car, User, PackageCheck } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getCompletedData } from "@/controllers/serviceProgressController";
import { getShopInfo } from "@/controllers/billingController";
// npm install jspdf
import jsPDF from "jspdf";

function formatMoney(v: string | number | null | undefined) {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
}

function warrantyDuration(start: string | null, end: string | null) {
  if (!start || !end) return "—";
  const months = Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24 * 30));
  return `${months} Month${months === 1 ? "" : "s"}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type CompletedData = Awaited<ReturnType<typeof getCompletedData>>;

function Completed() {
  useEffect(() => { document.title = "Service Completed — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<CompletedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getCompletedData(userId, jobOrderId)
      .then(setData)
      .catch(() => setError("Failed to load service report."))
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">Loading service report…</div>;
  }
  if (error || !data?.jobOrder) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">{error ?? "No completed job order found."}</div>;
  }

  const { jobOrder, logs, warranties, services, parts } = data;

  // NOTE: release-related fields (released_at / released_to / odometer /
  // release_photo_url) aren't in the current CompletedData shape yet — add
  // them to getCompletedData's return once the release flow is wired up on
  // the admin side. Falling back gracefully below in the meantime.
  const releasedAt = (jobOrder as any).released_at ?? null;
  const releasedTo = (jobOrder as any).released_to ?? "Customer / Authorized Representative";
  const releasePhoto = (jobOrder as any).release_photo_url ?? null;

  const laborTotal = services.reduce((sum, s) => sum + Number(s.actual_amount ?? 0), 0);
  const partsTotal = parts.reduce((sum, p) => sum + Number(p.total_retail_amount ?? 0), 0);
  const balanceDue = Number(jobOrder.balance ?? 0);

  const handleDownload = () => {
    void generateServiceReportPDF({ jobOrder, services, parts, warranties, releasedAt, releasedTo });
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active="completed" jobOrderId={jobOrder.job_order_id} />

      <div className="relative overflow-hidden rounded-2xl bg-brand-soft/60 p-8">
        <Check className="absolute right-8 top-8 h-32 w-32 text-brand/10" />
        <div className="flex items-start gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Check className="h-7 w-7" /></div>
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold">{statusLabel(jobOrder.status)}</span>
              <span className="text-xs text-muted-foreground">JOB ORDER #JO-{jobOrder.job_order_id}</span>
            </div>
            <h1 className="mt-3 text-3xl font-bold">Final Service Report</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Complete summary for your {jobOrder.vehicle_year} {jobOrder.vehicle_model} ({jobOrder.plate_number}) — services performed, parts and labor, payment, warranties, and release details.
            </p>
          </div>
          <div className="ml-auto flex shrink-0 gap-2">
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"><Printer className="h-3 w-3" /> Print</button>
            <button onClick={handleDownload} className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs hover:bg-accent"><Download className="h-3 w-3" /> Download</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-5">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 font-bold"><Wrench className="h-4 w-4" /> Services Performed</h3>
            <p className="text-xs text-muted-foreground">Full log of all work completed on your vehicle.</p>
            <div className="mt-4 divide-y">
              {logs.length === 0 && <p className="py-4 text-xs text-muted-foreground">No log entries yet.</p>}
              {logs.map((log) => (
                <div key={log.id} className="py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <Wrench className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground max-w-lg">{log.activity_description}</p>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0"><Clock className="h-3 w-3" /> {formatTime(log.log_time)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-4 w-4 text-teal" /> Warranty Certificates</h3>
              <span className="rounded-full border px-3 py-0.5 text-xs">{warranties.length} Warrant{warranties.length === 1 ? "y" : "ies"}</span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {warranties.length === 0 && <p className="text-xs text-muted-foreground">No warranties issued for this job order.</p>}
              {warranties.map((w) => (
                <div key={w.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <ShieldCheck className="h-4 w-4 text-brand" />
                    <span className="rounded-full border px-2 py-0.5 text-[10px]">{statusLabel(w.status).toUpperCase()}</span>
                  </div>
                  <div className="mt-3 text-sm font-bold">{w.coverage_description}</div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-muted-foreground">Duration:</span><span>{warrantyDuration(w.start_date, w.expiration_date)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Expires:</span><span>{formatDate(w.expiration_date)}</span></div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Warranty coverage applies to both parts and labor. Please keep your digital receipt for any potential claims.</p>
          </div>

          {/* --- Vehicle Release Information --- */}
          <div className="rounded-xl border bg-card p-6">
            <h3 className="flex items-center gap-2 font-bold"><Car className="h-4 w-4" /> Vehicle Release Information</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <User className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Released To</div>
                  <div className="text-sm font-medium">{releasedTo}</div>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">Released At</div>
                  <div className="text-sm font-medium">
                    {releasedAt ? `${formatDate(releasedAt)} · ${formatTime(releasedAt)}` : "Pending release"}
                  </div>
                </div>
              </div>
            </div>
            {releasePhoto ? (
              <img src={releasePhoto} alt="Vehicle release proof" className="mt-4 aspect-video w-full max-w-md rounded-lg border object-cover" />
            ) : (
              <div className="mt-4 flex items-center gap-2 rounded-md border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">
                <PackageCheck className="h-4 w-4" /> Release photo will appear here once the vehicle has been handed back.
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="flex items-center gap-2 font-bold"><FileText className="h-4 w-4" /> Payment Summary</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="font-semibold flex items-center gap-1">🔧 Technician Labor</div>
              {services.length === 0 && <p className="text-xs text-muted-foreground">No labor charges.</p>}
              {services.map((s) => (
                <div key={s.id} className="flex justify-between text-muted-foreground">
                  <span>{s.service_name} ({s.actual_hours ?? s.estimated_hours} hrs)</span>
                  <span>{formatMoney(s.actual_amount)}</span>
                </div>
              ))}

              <div className="mt-3 font-semibold flex items-center gap-1">⚙️ Replaced Parts</div>
              {parts.length === 0 && <p className="text-xs text-muted-foreground">No parts used.</p>}
              {parts.map((p) => (
                <div key={p.id} className="flex justify-between text-muted-foreground">
                  <span>{p.description} x{p.quantity}</span>
                  <span>{formatMoney(p.total_retail_amount)}</span>
                </div>
              ))}

              <div className="mt-3 border-t pt-3 space-y-1">
                <div className="flex justify-between"><span>Labor + Parts</span><b>{formatMoney(laborTotal + partsTotal)}</b></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-3">
                <span className="font-semibold">Total Due</span>
                <span className="text-2xl font-bold text-teal">{formatMoney(jobOrder.actual_grand_total)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Payment Status</span>
                <span className={`font-semibold ${balanceDue <= 0 ? "text-success" : "text-warning"}`}>
                  {balanceDue <= 0 ? "Fully Paid" : `₱${formatMoney(balanceDue)} balance`}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Completed;

// ---------------------------------------------------------------------------
// PDF generation — same visual format as the History page's downloadable
// invoice (logo header, SERVICE INVOICE title, details block, itemized
// DESCRIPTION/AMOUNT table covering both labor and parts, total, footer note),
// just sourced from the completed job order's data instead of a history row.
// ---------------------------------------------------------------------------

function loadCompletedLogoAsDataURL(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });
}

async function generateServiceReportPDF({
  jobOrder,
  services,
  parts,
  warranties,
  releasedAt,
  releasedTo,
}: {
  jobOrder: CompletedData["jobOrder"];
  services: CompletedData["services"];
  parts: CompletedData["parts"];
  warranties: CompletedData["warranties"];
  releasedAt: string | null;
  releasedTo: string;
}) {
  if (!jobOrder) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 56;

  const SHOP_INFO = await getShopInfo();

  // --- Logo ---
  const logoX = margin;
  const logoY = y;
  try {
    const logoDataUrl = await loadCompletedLogoAsDataURL("/autokita-logo.png");
    doc.addImage(logoDataUrl, "PNG", logoX, logoY - 14, 28, 28);
  } catch {
    doc.setDrawColor(15, 76, 92);
    doc.setLineWidth(1.5);
    doc.circle(logoX + 14, logoY + 10, 14, "S");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 76, 92);
    doc.text("A", logoX + 14, logoY + 15, { align: "center" });
  }

  // --- Shop name / tagline ---
  doc.setFontSize(16);
  doc.setTextColor(20, 20, 20);
  doc.text(SHOP_INFO.name, logoX + 36, logoY + 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 110);
  doc.text(SHOP_INFO.tagline, logoX + 36, logoY + 21);

  // --- Shop address block (right-aligned) ---
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  const addressLines = doc.splitTextToSize(SHOP_INFO.address, 220);
  doc.text(addressLines, pageWidth - margin, y - 4, { align: "right" });
  doc.text(`Tel: ${SHOP_INFO.phone}`, pageWidth - margin, y + 22, { align: "right" });
  doc.text(SHOP_INFO.email, pageWidth - margin, y + 34, { align: "right" });
  doc.text(`TIN: ${SHOP_INFO.tin}`, pageWidth - margin, y + 46, { align: "right" });

  y += 66;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 28;

  // --- Invoice title + booking meta ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20, 20, 20);
  doc.text("SERVICE INVOICE", margin, y);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(90, 90, 90);
  doc.text(`Job Order: JO-${jobOrder.job_order_id}`, pageWidth - margin, y - 12, { align: "right" });
  doc.text(`Date: ${formatDate(releasedAt) || new Date().toLocaleDateString("en-PH")}`, pageWidth - margin, y, { align: "right" });
  doc.text(`Status: ${statusLabel(jobOrder.status)}`, pageWidth - margin, y + 12, { align: "right" });

  y += 34;

  // --- Booking details grid ---
  const primaryService = services[0]?.service_name ?? "General Service";
  const serviceLabel = services.length > 1 ? `${primaryService} +${services.length - 1} more` : primaryService;
  const activeWarranty = warranties[0];
  const warrantyLabel = activeWarranty
    ? `${warrantyDuration(activeWarranty.start_date, activeWarranty.expiration_date)} — ${activeWarranty.coverage_description}`
    : "—";

  const details: [string, string][] = [
    ["Vehicle", `${jobOrder.vehicle_year} ${jobOrder.vehicle_model} (${jobOrder.plate_number})`],
    ["Mechanic", "AutoKita Service Team"],
    ["Location", SHOP_INFO.name],
    ["Warranty", warrantyLabel],
    ["Service", serviceLabel],
    ["Released To", releasedTo],
  ];
  doc.setFontSize(9);
  details.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(60, 60, 60);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20, 20, 20);
    doc.text(value, margin + 90, y);
    y += 16;
  });

  y += 12;

  // --- Line items table — labor and parts together, same as the invoice sample ---
  const col1 = margin;
  const col2 = pageWidth - margin;
  const items: [string, number][] = [
    ...services.map((s): [string, number] => [
      `${s.service_name}${s.actual_hours ? ` (${s.actual_hours} hrs)` : ""}`,
      Number(s.actual_amount ?? 0),
    ]),
    ...parts.map((p): [string, number] => [`${p.description} x${p.quantity}`, Number(p.total_retail_amount ?? 0)]),
  ];

  doc.setFillColor(15, 76, 92);
  doc.rect(margin, y, pageWidth - margin * 2, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DESCRIPTION", col1 + 8, y + 15);
  doc.text("AMOUNT (PHP)", col2 - 8, y + 15, { align: "right" });
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 30, 30);
  items.forEach(([desc, amt], idx) => {
    const rowHeight = 22;
    if (idx % 2 === 1) {
      doc.setFillColor(246, 247, 248);
      doc.rect(margin, y, pageWidth - margin * 2, rowHeight, "F");
    }
    doc.text(desc, col1 + 8, y + 15);
    doc.text(formatMoney(amt), col2 - 8, y + 15, { align: "right" });
    y += rowHeight;
  });

  // Total row
  doc.setDrawColor(15, 76, 92);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 76, 92);
  doc.text("TOTAL", col1 + 8, y);
  doc.text(`₱ ${formatMoney(jobOrder.actual_grand_total)}`, col2 - 8, y, { align: "right" });

  y += 40;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8.5);
  doc.setTextColor(140, 140, 140);
  doc.text(
    "Thank you for choosing AutoKita. This invoice was generated electronically and is valid without a signature.",
    margin,
    y,
    { maxWidth: pageWidth - margin * 2 }
  );

  doc.save(`AutoKita_ServiceReport_JO-${jobOrder.job_order_id}.pdf`);
}