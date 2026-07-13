'use client'


import { useEffect, useMemo, useState } from "react";
import {
  Download,
  CheckCircle2,
  ShieldCheck,
  Store,
  Send,
  Upload,
  Sparkles,
  Clock,
  X,
  ChevronRight,
  Wallet,
  Gift,
  History,
  Award,
  Car,
} from "lucide-react";
import {
  type Service,
  type Warranty,
  type Rewards,
  CATEGORY_ORDER,
  REWARDS_BANNER_IMAGE,
  STATUS_STYLE,
  WARRANTY_STATUS_STYLE,
  peso,
  serviceTotal,
} from "@/data/billings";
import { getServices, getWarranties, getWarrantyHistory, getRewards } from "@/controllers/billingController";

const EMPTY_REWARDS: Rewards = { tier: "", nextTier: "", pointsToNextTier: 0, redeemable: [] };

// ---------------------------------------------------------------------------
// File download helpers (client-side)
// ---------------------------------------------------------------------------

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buildInvoiceText(service: Service) {
  const total = serviceTotal(service);
  const lines = [
    "AutoKita — Service Invoice",
    "================================",
    `Invoice #: ${service.invoice}`,
    `Service: ${service.name}`,
    `Vehicle: ${service.vehicle}`,
    `Date: ${service.date}`,
    "",
  ];
  for (const cat of CATEGORY_ORDER) {
    const items = service.items.filter((i) => i.category === cat);
    if (!items.length) continue;
    lines.push(`-- ${cat} --`);
    for (const it of items) {
      lines.push(`${it.name}  x${it.qty}  @ ₱${peso(it.price)}  =  ₱${peso(it.qty * it.price)}`);
    }
    lines.push("");
  }
  lines.push(`Subtotal: ₱${peso(total)}`);
  if (service.status !== "pending") lines.push(`Amount Paid: ₱${peso(service.amountPaid)}`);
  if (service.status !== "paid") lines.push(`Balance Due: ₱${peso(total - service.amountPaid)}`);
  lines.push("", `Status: ${STATUS_STYLE[service.status].label}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function Billing() {
  useEffect(() => { document.title = "Billing & Warranty — AutoKita"; }, []);

  // Loaded through the controller (mock API) — see billingController.ts.
  const [services, setServices] = useState<Service[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [warrantyHistory, setWarrantyHistory] = useState<Warranty[]>([]);
  const [rewards, setRewards] = useState<Rewards>(EMPTY_REWARDS);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [showRewards, setShowRewards] = useState(false);
  const [showWarrantyHistory, setShowWarrantyHistory] = useState(false);
  const [points, setPoints] = useState(1280);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getServices().then((data) => active && setServices(data));
    getWarranties().then((data) => active && setWarranties(data));
    getWarrantyHistory().then((data) => active && setWarrantyHistory(data));
    getRewards().then((data) => active && setRewards(data));
    return () => {
      active = false;
    };
  }, []);

  // ---------------------------------------------------------------------
  // Vehicles — derived from the customer's services, so the warranty
  // panel can be filtered to whichever vehicle is currently selected.
  // ---------------------------------------------------------------------
  const vehicles = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const s of services) {
      if (!seen.has(s.vehicle)) {
        seen.add(s.vehicle);
        list.push(s.vehicle);
      }
    }
    return list;
  }, [services]);

  const [selectedVehicle, setSelectedVehicle] = useState<string>(vehicles[0] ?? "");

  const vehicleWarranties = useMemo(
    () => warranties.filter((w) => w.vehicle === selectedVehicle),
    [warranties, selectedVehicle]
  );

  const notify = (msg: string) => setToast(msg);

  const handleDownloadOne = (service: Service) => {
    downloadText(`${service.invoice}.txt`, buildInvoiceText(service));
    notify(`Downloaded invoice ${service.invoice}.`);
  };

  const handleDownloadAll = () => {
    const content = services.map(buildInvoiceText).join("\n\n================================\n\n");
    downloadText("all-invoices.txt", content);
    notify("Downloaded all invoices.");
  };

  const handleSubmitPayment = (service: Service, method: "shop" | "ewallet") => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === service.id
          ? {
              ...s,
              status: method === "ewallet" ? "verifying" : s.status,
            }
          : s
      )
    );
    setSelectedService(null);
    notify(
      method === "ewallet"
        ? `Payment proof submitted for ${service.invoice}. We'll verify within 2–4 business hours.`
        : `Noted! Please settle ₱${peso(serviceTotal(service) - service.amountPaid)} at the shop for ${service.invoice}.`
    );
  };

  const handleRedeem = (rewardId: string, name: string, cost: number) => {
    if (points < cost) {
      notify("Not enough points to redeem this reward yet.");
      return;
    }
    setPoints((p) => p - cost);
    notify(`Redeemed: ${name}. Check your email for the voucher code.`);
  };

  const handleFileClaim = (warranty: Warranty) => {
    notify(`Claim request submitted for "${warranty.t}". Our team will reach out shortly.`);
    setSelectedWarranty(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Billing & Warranty Portal</h1>
          <p className="text-sm text-muted-foreground">
            Manage payments, invoices, and your active protection plans.
          </p>
        </div>
        <button
          onClick={handleDownloadAll}
          className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted/40"
        >
          <Download className="h-4 w-4" /> Download All Invoices
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        {/* --------------------------------------------------------------- */}
        {/* Services table                                                  */}
        {/* --------------------------------------------------------------- */}
        <div className="rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b p-6 pb-4">
            <div>
              <h2 className="text-lg font-bold">Your Services</h2>
              <p className="text-xs text-muted-foreground">
                Every visit is billed separately. Click a service to view the breakdown and pay.
              </p>
            </div>
            <span className="rounded-full border px-2 py-0.5 text-xs">{services.length} Total</span>
          </div>

          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground border-b">
              <tr>
                <th className="px-6 py-3 font-medium">Service</th>
                <th className="px-3 py-3 font-medium">Date</th>
                <th className="px-3 py-3 font-medium">Total</th>
                <th className="px-3 py-3 font-medium">Paid</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium text-right">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => {
                const total = serviceTotal(s);
                const badge = STATUS_STYLE[s.status];
                return (
                  <tr
                    key={s.id}
                    onClick={() => setSelectedService(s)}
                    className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.invoice} · {s.vehicle}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-muted-foreground">{s.date}</td>
                    <td className="px-3 py-4 font-medium">₱{peso(total)}</td>
                    <td className="px-3 py-4 text-muted-foreground">
                      {s.amountPaid ? `₱${peso(s.amountPaid)}` : "—"}
                    </td>
                    <td className="px-3 py-4">
                      <span
                        className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-brand">
                        View <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* --------------------------------------------------------------- */}
        {/* Sidebar — warranties, offers                                    */}
        {/* --------------------------------------------------------------- */}
        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold">
                <ShieldCheck className="h-4 w-4 text-teal" /> Active Warranties
              </h3>
              <span className="rounded-full border px-2 py-0.5 text-xs">
                {vehicleWarranties.length} Total
              </span>
            </div>

            {/* Vehicle selector — filters the list below to just this vehicle */}
            {vehicles.length > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="w-full truncate bg-transparent text-xs font-semibold outline-none"
                >
                  {vehicles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="mt-4 space-y-4">
              {vehicleWarranties.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No warranties on file for this vehicle yet.
                </p>
              )}
              {vehicleWarranties.map((w) => (
                <div key={w.t} className="border-b pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <img
                      src={w.image}
                      alt={w.t}
                      className="h-12 w-12 shrink-0 rounded-lg border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-bold">🛡 {w.t}</div>
                        <span
                          className={`whitespace-nowrap text-xs font-semibold ${WARRANTY_STATUS_STYLE[w.status]}`}
                        >
                          {w.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs">
                    <div className="text-muted-foreground">Component Covered:</div>
                    <b>{w.comp}</b>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" /> Expires: {w.expires}
                    </span>
                    <button onClick={() => setSelectedWarranty(w)} className="text-brand hover:underline">
                      Details ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowWarrantyHistory(true)}
              className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              View Full Warranty History
            </button>
          </div>

          <div className="rounded-xl border bg-brand-soft/40 p-5">
            <Sparkles className="h-6 w-6 text-brand" />
            <h3 className="mt-3 text-lg font-bold">Exclusive Offers for You</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Based on your vehicle's history, you qualify for 2 special loyalty discounts.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> 20% Off Next Wheel Alignment
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> Free Diagnostic check next visit
              </div>
            </div>
            <button
              onClick={() => setShowRewards(true)}
              className="mt-4 w-full rounded-md bg-brand py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              View My Rewards ✨
            </button>
          </div>
        </aside>
      </div>

      {selectedService && (
        <ServiceModal
          service={selectedService}
          onClose={() => setSelectedService(null)}
          onDownload={handleDownloadOne}
          onSubmitPayment={handleSubmitPayment}
        />
      )}

      {showRewards && (
        <RewardsModal points={points} rewards={rewards} onClose={() => setShowRewards(false)} onRedeem={handleRedeem} />
      )}

      {showWarrantyHistory && (
        <WarrantyHistoryModal
          history={warrantyHistory.filter((w) => w.vehicle === selectedVehicle)}
          onClose={() => setShowWarrantyHistory(false)}
          onSelect={(w) => {
            setShowWarrantyHistory(false);
            setSelectedWarranty(w);
          }}
        />
      )}

      {selectedWarranty && (
        <WarrantyDetailsModal
          warranty={selectedWarranty}
          onClose={() => setSelectedWarranty(null)}
          onFileClaim={handleFileClaim}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-[70] max-w-sm rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal shell (shared frame)
// ---------------------------------------------------------------------------

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidth = "max-w-2xl",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-10">
      <div className={`w-full ${maxWidth} rounded-xl border bg-card shadow-xl`}>
        <div className="flex items-start justify-between border-b p-6">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted/50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-6">{children}</div>
        {footer && <div className="flex items-center justify-between border-t p-6">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Service modal — sectioned Parts / Labor breakdown + payment
// ---------------------------------------------------------------------------

function ServiceModal({
  service,
  onClose,
  onDownload,
  onSubmitPayment,
}: {
  service: Service;
  onClose: () => void;
  onDownload: (s: Service) => void;
  onSubmitPayment: (s: Service, method: "shop" | "ewallet") => void;
}) {
  const [method, setMethod] = useState<"shop" | "ewallet">("ewallet");
  const total = serviceTotal(service);
  const balance = total - service.amountPaid;
  const badge = STATUS_STYLE[service.status];
  const needsPayment = service.status === "pending" || service.status === "downpayment";

  return (
    <ModalShell
      title={service.name}
      subtitle={`${service.invoice} · ${service.date} · ${service.vehicle}`}
      onClose={onClose}
      footer={
        <>
          <button
            onClick={() => onDownload(service)}
            className="inline-flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted/40"
          >
            <Download className="h-4 w-4" /> Download Invoice
          </button>
          {needsPayment ? (
            <button
              onClick={() => onSubmitPayment(service, method)}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              <CheckCircle2 className="h-4 w-4" />
              {service.status === "downpayment" ? `Pay Balance · ₱${peso(balance)}` : "Finish Checkout"}
            </button>
          ) : service.status === "verifying" ? (
            <span className="flex items-center gap-1 text-sm font-semibold text-brand">
              <Clock className="h-4 w-4" /> Verifying payment…
            </span>
          ) : (
            <span className="flex items-center gap-1 text-sm font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" /> Fully Paid
            </span>
          )}
        </>
      }
    >
      <div className="mb-4 flex items-center justify-end">
        <span className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Itemized breakdown, grouped by section */}
      {CATEGORY_ORDER.map((cat) => {
        const items = service.items.filter((i) => i.category === cat);
        if (!items.length) return null;
        const sectionTotal = items.reduce((sum, i) => sum + i.qty * i.price, 0);
        return (
          <div key={cat} className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{cat}</h4>
              <span className="text-xs text-muted-foreground">₱{peso(sectionTotal)}</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {items.map((it) => (
                  <tr key={it.name} className="border-b last:border-0">
                    <td className="py-2.5">{it.name}</td>
                    <td className="py-2.5 text-muted-foreground">x{it.qty}</td>
                    <td className="py-2.5 text-muted-foreground">₱{peso(it.price)}</td>
                    <td className="py-2.5 text-right font-medium">₱{peso(it.qty * it.price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Totals */}
      <div className="ml-auto max-w-xs space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <b>₱{peso(total)}</b>
        </div>
        {service.status === "downpayment" && (
          <>
            <div className="flex justify-between text-success">
              <span>Downpayment received:</span>
              <span>− ₱{peso(service.amountPaid)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg">
              <b>Balance Due:</b>
              <b className="text-teal">₱{peso(balance)}</b>
            </div>
          </>
        )}
        {(service.status === "pending" || service.status === "verifying") && (
          <div className="flex justify-between border-t pt-2 text-lg">
            <b>Total Due:</b>
            <b className="text-teal">₱{peso(total)}</b>
          </div>
        )}
        {service.status === "paid" && (
          <div className="flex justify-between border-t pt-2 text-lg">
            <b>Total Paid:</b>
            <b className="text-success">₱{peso(service.amountPaid)}</b>
          </div>
        )}
      </div>

      {/* Payment section */}
      {needsPayment && (
        <div className="mt-6 border-t pt-6">
          <h3 className="font-bold">Choose Payment Method</h3>
          <p className="text-xs text-muted-foreground">
            Select your preferred way to settle {service.status === "downpayment" ? "the remaining balance" : "this bill"}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => setMethod("shop")}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 ${
                method === "shop" ? "border-brand bg-brand-soft/30" : "border-border"
              }`}
            >
              <Store className="h-5 w-5" /> <span className="text-sm">Pay at Shop</span>
            </button>
            <button
              onClick={() => setMethod("ewallet")}
              className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 ${
                method === "ewallet" ? "border-brand bg-brand-soft/30" : "border-border"
              }`}
            >
              <Send className="h-5 w-5 text-brand" /> <span className="text-sm">E-Wallet Transfer</span>
            </button>
          </div>

          {method === "ewallet" && (
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Wallet className="h-3 w-3" /> Payment Details
                </div>
                {[
                  { n: "GCash", num: "0917-123-4567" },
                  { n: "Maya", num: "0908-765-4321" },
                ].map((p) => (
                  <div key={p.n} className="mt-2 flex items-center justify-between rounded-lg bg-muted/40 p-3">
                    <div className="text-xs">
                      <div className="text-sm font-bold">{p.n}</div>
                      <div>
                        Account Name: <b>AutoCare Services</b>
                      </div>
                      <div>
                        Mobile Number: <b>{p.num}</b>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="grid h-16 w-16 place-items-center rounded border bg-white p-1 text-[8px]">QR</div>
                      <div className="mt-1 text-[10px]">{p.n} QR</div>
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Upload Payment Proof
                </div>
                <label className="mt-2 flex h-32 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-muted/20 p-6 text-center hover:bg-muted/30">
                  <Upload className="h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-xs text-muted-foreground">Drag and drop or click to upload PDF/JPG</p>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" />
                </label>
              </div>
            </div>
          )}

          <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> Estimated verification time for transfers: 2–4 business hours.
          </div>
        </div>
      )}
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Rewards modal
// ---------------------------------------------------------------------------

function RewardsModal({
  points,
  rewards,
  onClose,
  onRedeem,
}: {
  points: number;
  rewards: Rewards;
  onClose: () => void;
  onRedeem: (id: string, name: string, cost: number) => void;
}) {
  const progress = Math.min(100, Math.round((points / rewards.pointsToNextTier) * 100));

  return (
    <ModalShell title="My Rewards" subtitle="Earn points every time you get serviced with us." onClose={onClose}>
      <div className="relative overflow-hidden rounded-lg">
        <img
          src={REWARDS_BANNER_IMAGE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[oklch(0.25_0.05_240)]/95 via-[oklch(0.3_0.05_240)]/90 to-[oklch(0.35_0.05_240)]/80" />
        <div className="relative p-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-white" />
              <div>
                <div className="text-xs text-white/70">Current Tier</div>
                <div className="font-bold">{rewards.tier}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-white/70">Points Balance</div>
              <div className="text-xl font-bold">{points.toLocaleString()} pts</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-white/70">
              <span>{rewards.tier}</span>
              <span>{rewards.nextTier}</span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-white/20">
              <div className="h-2 rounded-full bg-white" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-1 text-xs text-white/70">
              {Math.max(0, rewards.pointsToNextTier - points).toLocaleString()} pts to {rewards.nextTier}
            </div>
          </div>
        </div>
      </div>

      <h3 className="mt-6 mb-3 text-sm font-bold">Redeem Rewards</h3>
      <div className="space-y-2">
        {rewards.redeemable.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-3 text-sm">
              <img src={r.image} alt={r.name} className="h-12 w-12 shrink-0 rounded-lg border object-cover" />
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 shrink-0 text-brand" />
                <div>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.cost.toLocaleString()} pts</div>
                </div>
              </div>
            </div>
            <button
              onClick={() => onRedeem(r.id, r.name, r.cost)}
              disabled={points < r.cost}
              className="shrink-0 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redeem
            </button>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Warranty history modal
// ---------------------------------------------------------------------------

function WarrantyHistoryModal({
  history,
  onClose,
  onSelect,
}: {
  history: Warranty[];
  onClose: () => void;
  onSelect: (w: Warranty) => void;
}) {
  return (
    <ModalShell title="Warranty History" subtitle="All warranty plans linked to this vehicle." onClose={onClose}>
      <div className="space-y-3">
        {history.length === 0 && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No warranty history found for this vehicle.
          </p>
        )}
        {history.map((w, i) => (
          <button
            key={`${w.t}-${i}`}
            onClick={() => onSelect(w)}
            className="flex w-full items-center justify-between rounded-lg border p-3 text-left hover:bg-muted/30"
          >
            <div className="flex items-center gap-3">
              <img src={w.image} alt={w.t} className="h-10 w-10 shrink-0 rounded-md border object-cover" />
              <History className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{w.t}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {w.comp} · Purchased {w.purchased}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className={`whitespace-nowrap text-xs font-semibold ${WARRANTY_STATUS_STYLE[w.status]}`}>
                {w.status}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Warranty details modal
// ---------------------------------------------------------------------------

function WarrantyDetailsModal({
  warranty,
  onClose,
  onFileClaim,
}: {
  warranty: Warranty;
  onClose: () => void;
  onFileClaim: (w: Warranty) => void;
}) {
  const canClaim = warranty.status === "Active" || warranty.status === "Expiring Soon";

  return (
    <ModalShell
      title={warranty.t}
      subtitle={`${warranty.vehicle} · Covers: ${warranty.comp}`}
      onClose={onClose}
      maxWidth="max-w-lg"
      footer={
        <>
          <span className={`text-sm font-semibold ${WARRANTY_STATUS_STYLE[warranty.status]}`}>
            {warranty.status}
          </span>
          {canClaim ? (
            <button
              onClick={() => onFileClaim(warranty)}
              className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              File a Claim
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">Not eligible for new claims</span>
          )}
        </>
      }
    >
      <div className="-mx-6 -mt-6 mb-4 h-40 w-[calc(100%+3rem)] overflow-hidden">
        <img src={warranty.image} alt={warranty.t} className="h-full w-full object-cover" />
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-xs text-muted-foreground">Purchased</div>
          <div className="font-medium">{warranty.purchased}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Expires</div>
          <div className="font-medium">{warranty.expires}</div>
        </div>
      </div>
      <div className="mt-4">
        <div className="text-xs text-muted-foreground">Coverage Terms</div>
        <p className="mt-1 text-sm">{warranty.terms}</p>
      </div>
    </ModalShell>
  );
}

export default Billing;
