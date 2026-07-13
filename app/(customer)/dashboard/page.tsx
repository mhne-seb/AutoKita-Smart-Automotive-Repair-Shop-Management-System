'use client'

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Phone,
  Mail,
  Wrench,
  Plus,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  X,
  MapPin,
  PackageCheck,
  Search,
} from "lucide-react";
import { getJobOrders } from "@/controllers/jobOrderController";
import type { JobOrderCard as JobOrderData } from "@/data/types";
const heroCar = "/assets/ac/a1.jpg"; 
const teslaImg = "/assets/cars/tesla.jpg"; 
const hondaImg = "/assets/cars/honda.jpg"; 

// The currently "logged in" mock customer — see src/data/users.ts. 
const CURRENT_CUSTOMER_ID = "CUST-2026-1234";

// Maps a job order's Stage to the 0-based index the ServiceCard stepper uses.
const STAGE_TO_STEP: Record<string, number> = {
  inspecting: 1,
  quotation: 2,
  "in-progress": 3,
  completed: 4,
};

const STAGE_LABEL: Record<string, string> = {
  inspecting: "Under Inspection",
  quotation: "Under Quotation",
  "in-progress": "In Progress",
  completed: "Completed",
};

// Cycle a couple of vehicle photos for cards beyond the first two.
const CARD_IMAGES = [teslaImg, hondaImg];

function Dashboard() {
  useEffect(() => { document.title = "Dashboard — AutoKita"; }, []);

  const [contactOpen, setContactOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalData | null>(null);

  const [myJobOrders, setMyJobOrders] = useState<JobOrderData[]>([]);

  useEffect(() => {
    let active = true;
    getJobOrders(CURRENT_CUSTOMER_ID).then((data) => {
      if (active) setMyJobOrders(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {/* WELCOME BANNER*/}
          <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-brand via-brand to-[color:oklch(0.22_0.05_250)] p-6 text-white shadow-lg">
            <div className="pointer-events-none absolute -right-24 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />

            {

            }
            <img
              src={heroCar}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full object-cover object-top opacity-40 mix-blend-luminosity"
            />

            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-widest text-white/70">Welcome back</div>
              <h1 className="mt-1 text-3xl font-bold md:text-4xl animate-fade-up">Hello, Juan Dela Cruz 👋</h1>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-white/85">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> juand.cruz@example.com
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> +63 951 234 567
                </span>
              </div>
              <p className="mt-4 max-w-md text-sm text-white/80">
                Your vehicles are being looked after. Here's what's happening today.
              </p>
            </div>
          </section>

          {/* OVERVIEW - MY SERVICES */}
          <section>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Services</h2>
              <span className="text-xs text-muted-foreground">Last synced: Today, 10:45 AM</span>
            </div>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {myJobOrders.length === 0 ? (
                <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No active services yet — book one from the button above.
                </div>
              ) : (
                myJobOrders.map((job, i) => (
                  <ServiceCard
                    key={job.id}
                    image={CARD_IMAGES[i % CARD_IMAGES.length]}
                    vehicle={job.vehicle}
                    jobOrderId={`#${job.id.toUpperCase()}`}
                    status={STAGE_LABEL[job.stage]}
                    note={`Mechanic ${job.mechanic ?? "unassigned"} — ${job.service}`}
                    stepIndex={STAGE_TO_STEP[job.stage]}
                  />
                ))
              )}
            </div>
          </section>

          <section>
            <div className="rounded-xl border bg-card p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Activity</h2>
                <button
                  onClick={() => setHistoryOpen(true)}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  View Full History
                </button>
              </div>
              <div className="mt-5 space-y-5">
                <Activity
                  icon={CheckCircle2}
                  color="text-success"
                  title="Payment Confirmed"
                  time="2 hours ago"
                  desc="Your payment of ₱ 1,945.00 for Job Order ID #JO-2024-8830 has been successfully processed and verified."
                />
                <Activity
                  icon={Wrench}
                  color="text-brand"
                  title="New Booking Created"
                  time="Yesterday"
                  desc="Successfully scheduled a Brake System Inspection for the 2022 Tesla Model 3 on May 24th."
                />
                <Activity
                  icon={AlertCircle}
                  color="text-warning"
                  title="Additional Service Proposed"
                  time="Mar 20"
                  desc="Mechanic suggested replacing front brake pads due to 80% wear. Please review the proposal in your notifications."
                />
                <Activity
                  icon={FileText}
                  color="text-muted-foreground"
                  title="Report Generated"
                  time="Mar 18"
                  desc="A new diagnostic report for your Honda Civic is now available for download in the Billing section."
                />
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-6">

          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quick Actions</div>
            <div className="mt-4 space-y-2">
              <Link
                href="/dashboard/register-vehicle"
                className="flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-4 w-4" /> Book New Service
              </Link>
              <button
                onClick={() => setContactOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-md border py-2.5 text-sm font-medium transition-transform duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" /> Contact Shop Office
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Vehicles</div>
            <div className="mt-4 space-y-3">
              <VehicleRow image={teslaImg} model="2022 Tesla Model 3" plate="ABC 1234" />
              <VehicleRow image={hondaImg} model="2019 Honda Civic RS" plate="GAH 5542" />
              <Link
                href="/dashboard/register-vehicle"
                className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-brand hover:bg-accent hover:text-brand"
              >
                <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" /> Register New Vehicle
              </Link>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contextual Alerts</div>
            <div className="mt-4 space-y-3">
              <Alert
                tone="destructive"
                title="Approval Required"
                badge="NOW"
                body="Mechanical failure detected in Brake Pad wear sensor. Replacement cost: ₱ 750.00."
                actions={
                  <>
                    <button
                      onClick={() =>
                        setConfirmModal({
                          tone: "brand",
                          title: "Review & Approve",
                          body: "Mechanical failure detected in the Brake Pad wear sensor for your 2022 Tesla Model 3. The mechanic recommends an immediate replacement.",
                          details: [
                            { label: "Job Order", value: "#JO-2024-8830" },
                            { label: "Part", value: "Brake Pad Wear Sensor" },
                            { label: "Replacement Cost", value: "₱ 750.00" },
                            { label: "Requested by", value: "Mechanic — Bay 2" },
                          ],
                          confirmLabel: "Approve Service",
                          onConfirm: () => setConfirmModal(null),
                        })
                      }
                      className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-white transition-transform duration-150 active:scale-[0.97]"
                    >
                      Review & Approve
                    </button>
                    <button
                      onClick={() =>
                        setConfirmModal({
                          tone: "destructive",
                          title: "Decline Service",
                          body: "Are you sure you want to decline the Brake Pad wear sensor replacement? Your vehicle will continue to run with the current worn part.",
                          details: [
                            { label: "Job Order", value: "#JO-2024-8830" },
                            { label: "Part", value: "Brake Pad Wear Sensor" },
                            { label: "Replacement Cost", value: "₱ 750.00" },
                          ],
                          confirmLabel: "Decline",
                          onConfirm: () => setConfirmModal(null),
                        })
                      }
                      className="text-xs font-medium transition-transform duration-150 active:scale-[0.97]"
                    >
                      Decline
                    </button>
                  </>
                }
              />
              <Alert
                tone="neutral"
                title="Mechanic Note"
                badge="1H AGO"
                body="I've started the intake inspection. Will update you once computer diagnostics are complete."
              />
              <Alert
                tone="success"
                title="Service Completed"
                badge="YESTERDAY"
                body="The oil change for your Honda Civic was completed successfully. Feel free to pick it up anytime before 6pm."
              />
              <button
                onClick={() =>
                  setConfirmModal({
                    tone: "destructive",
                    title: "Clear All Notifications",
                    body: "This will clear all current notifications from your dashboard. You can still find them later in your full activity history.",
                    confirmLabel: "Clear All",
                    onConfirm: () => setConfirmModal(null),
                  })
                }
                className="w-full pt-2 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear All Notifications
              </button>
            </div>
          </div>
        </aside>
      </div>

      {contactOpen && <ContactShopModal onClose={() => setContactOpen(false)} />}
      {historyOpen && <HistoryModal onClose={() => setHistoryOpen(false)} />}
      {confirmModal && (
        <ConfirmModal data={confirmModal} onClose={() => setConfirmModal(null)} />
      )}
    </div>
  );
}

/* ---------- Shared animated modal wrapper (fade + scale in/out) ---------- */

function Modal({
  onClose,
  children,
  panelClassName = "w-full max-w-md",
}: {
  onClose: () => void;
  children: (args: { close: () => void }) => React.ReactNode;
  panelClassName?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = () => {
    setVisible(false);
    setTimeout(onClose, 150);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={close}
    >
      <div
        className={`${panelClassName} rounded-xl border bg-card p-6 shadow-xl transition-all duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {children({ close })}
      </div>
    </div>
  );
}

/* ---------- Contact Shop modal ---------- */

function ContactShopModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose}>
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">AutoKita Service Center</h3>
              <p className="text-xs text-muted-foreground">We're here to help</p>
            </div>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Phone</div>
                <div className="text-muted-foreground">+63 2 8123 4567 / +63 917 123 4567</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Email</div>
                <div className="text-muted-foreground">support@autokita.ph</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Address</div>
                <div className="text-muted-foreground">123 Ortigas Ave, Pasig City, Metro Manila</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 text-brand" />
              <div>
                <div className="font-medium">Business Hours</div>
                <div className="text-muted-foreground">Mon–Sat, 8:00 AM – 6:00 PM</div>
              </div>
            </div>
          </div>

          <a
            href="tel:+6329123456"
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-2.5 text-sm font-semibold text-brand-foreground transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
          >
            <Phone className="h-4 w-4" /> Call Shop Now
          </a>
        </>
      )}
    </Modal>
  );
}

/* ---------- Full History modal ---------- */

const FULL_HISTORY = [
  {
    icon: CheckCircle2,
    color: "text-success",
    title: "Payment Confirmed",
    time: "2 hours ago",
    desc: "Your payment of ₱ 1,945.00 for Job Order ID #JO-2024-8830 has been successfully processed and verified.",
  },
  {
    icon: Wrench,
    color: "text-brand",
    title: "New Booking Created",
    time: "Yesterday",
    desc: "Successfully scheduled a Brake System Inspection for the 2022 Tesla Model 3 on May 24th.",
  },
  {
    icon: AlertCircle,
    color: "text-warning",
    title: "Additional Service Proposed",
    time: "Mar 20",
    desc: "Mechanic suggested replacing front brake pads due to 80% wear. Please review the proposal in your notifications.",
  },
  {
    icon: FileText,
    color: "text-muted-foreground",
    title: "Report Generated",
    time: "Mar 18",
    desc: "A new diagnostic report for your Honda Civic is now available for download in the Billing section.",
  },
  {
    icon: CheckCircle2,
    color: "text-success",
    title: "Service Completed",
    time: "Mar 15",
    desc: "Oil change and filter replacement for your 2019 Honda Civic RS was completed.",
  },
  {
    icon: Wrench,
    color: "text-brand",
    title: "Booking Created",
    time: "Mar 10",
    desc: "Scheduled a routine maintenance check for the 2019 Honda Civic RS.",
  },
];

function HistoryModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} panelClassName="w-full max-w-lg max-h-[80vh] overflow-y-auto">
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">Full Activity History</h3>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-5 space-y-5">
            {FULL_HISTORY.map((item, i) => (
              <Activity key={i} icon={item.icon} color={item.color} title={item.title} time={item.time} desc={item.desc} />
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Generic confirm modal (Review & Approve / Decline / Clear All) ---------- */

type ConfirmModalData = {
  tone: "brand" | "destructive";
  title: string;
  body: string;
  details?: { label: string; value: string }[];
  confirmLabel: string;
  onConfirm: () => void;
};

function ConfirmModal({ data, onClose }: { data: ConfirmModalData; onClose: () => void }) {
  const confirmClasses =
    data.tone === "destructive"
      ? "bg-destructive text-white hover:opacity-90"
      : "bg-[color:oklch(0.22_0.05_250)] text-white hover:opacity-90";

  return (
    <Modal onClose={onClose}>
      {({ close }) => (
        <>
          <div className="flex items-start justify-between">
            <h3 className="text-lg font-semibold">{data.title}</h3>
            <button onClick={close} className="rounded-md p-1 transition-colors hover:bg-accent">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-sm text-muted-foreground">{data.body}</p>

          {data.details && (
            <div className="mt-4 space-y-2 rounded-md border bg-muted/30 p-3">
              {data.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => {
                data.onConfirm();
                close();
              }}
              className={`flex-1 rounded-md py-2.5 text-sm font-semibold transition-transform duration-150 active:scale-[0.98] ${confirmClasses}`}
            >
              {data.confirmLabel}
            </button>
            <button
              onClick={close}
              className="flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

/* ---------- Service card with car-icon stepper ---------- */

const SERVICE_STEPS = [
  { label: "Received", icon: PackageCheck },
  { label: "Inspecting", icon: Search },
  { label: "Quotation", icon: FileText },
  { label: "In Progress", icon: Wrench },
  { label: "Completed", icon: CheckCircle2 },
];

function ServiceCard({
  image,
  vehicle,
  jobOrderId,
  status,
  note,
  stepIndex,
}: {
  image: string;
  vehicle: string;
  jobOrderId: string;
  status: string;
  note: string;
  stepIndex: number; // 0-based index into SERVICE_STEPS
}) {
  return (
    <div className="group overflow-hidden rounded-xl border bg-card transition-shadow duration-300 hover:shadow-lg">
      <div className="overflow-hidden">
        <img
          src={image}
          alt={vehicle}
          className="h-32 w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110"
        />
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium text-brand">
              Active Booking
            </span>
            <span className="text-[10px] text-muted-foreground">{jobOrderId}</span>
          </div>
          <Wrench className="h-4 w-4 text-brand" />
        </div>

        <div className="mt-3 text-lg font-bold">{vehicle}</div>
        <div className="mt-2 text-sm">
          <span className="text-muted-foreground">Status: </span>
          <b>{status}</b>
        </div>

        {/* Stepper */}
        <div className="mt-6 flex items-start">
          {SERVICE_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isDone = i < stepIndex;
            const isCurrent = i === stepIndex;
            const isActive = isDone || isCurrent;
            return (
              <div key={step.label} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div className="relative flex h-7 w-7 items-center justify-center">
                    {isCurrent && (
                      <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                    )}
                    <div
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform duration-300 ${
                        isActive
                          ? "border-brand bg-brand text-white"
                          : "border-muted bg-muted/50 text-muted-foreground"
                      } ${isCurrent ? "scale-110" : ""}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                  </div>
<span
  className={`text-center text-[6.5px] font-semibold uppercase leading-tight tracking-tighter transition-colors duration-300 ${
    isActive ? "text-brand" : "text-muted-foreground"
  }`}
>
  {step.label}
</span>
                </div>
                {i < SERVICE_STEPS.length - 1 && (
                  <div className={`-mt-5 h-0.5 flex-1 transition-colors duration-300 ${isDone ? "bg-brand" : "bg-muted"}`} />
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> Last update: {note}
        </div>
        <Link
          href="/dashboard/tracking/received"
          className="mt-4 flex w-full items-center justify-center gap-1 rounded-md bg-[color:oklch(0.22_0.05_250)] py-2 text-xs font-medium text-white transition-transform duration-150 hover:opacity-90 active:scale-[0.98]"
        >
          View Full Tracking{" "}
          <ChevronRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function Activity({
  icon: Icon,
  color,
  title,
  time,
  desc,
}: {
  icon: any;
  color: string;
  title: string;
  time: string;
  desc: string;
}) {
  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">{time}</div>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function VehicleRow({ image, model, plate }: { image: string; model: string; plate: string }) {
  return (
    <div className="group flex items-center gap-3 rounded-md border bg-muted/30 p-2.5 transition-colors hover:bg-muted/60">
      <img
        src={image}
        alt={model}
        className="h-9 w-9 rounded-md object-cover transition-transform duration-300 group-hover:scale-110"
      />
      <div>
        <div className="text-sm font-semibold">{model}</div>
        <div className="text-xs text-muted-foreground">{plate}</div>
      </div>
    </div>
  );
}

function Alert({
  tone,
  title,
  badge,
  body,
  actions,
}: {
  tone: "destructive" | "neutral" | "success";
  title: string;
  badge: string;
  body: string;
  actions?: React.ReactNode;
}) {
  const toneMap = {
    destructive: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-muted/30",
    success: "border-success/30 bg-success/5",
  };
  const iconMap = {
    destructive: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
    neutral: <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />,
    success: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  };
  return (
    <div className={`rounded-md border p-3 transition-shadow duration-200 hover:shadow-sm ${toneMap[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {iconMap[tone]} {title}
        </div>
        <span className="text-[10px] font-semibold text-muted-foreground">{badge}</span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{body}</p>
      {actions && <div className="mt-3 flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export default Dashboard;
