'use client'

// Route: /dashboard/register-vehicle — form for a Customer to add a new vehicle to their account.

import { useState, useEffect} from "react";
import { FileText, Car, Wrench, ClipboardList, Info, Calendar, ShieldCheck, CheckCircle2, X } from "lucide-react";

function RegisterVehicle() {
  useEffect(() => { document.title = "Register New Vehicle — AutoKita"; }, []);

  const [pickup, setPickup] = useState<"shop" | "home">("shop");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">Register New Vehicle</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card icon={FileText} title="Customer Details" subtitle="Review your contact details for this booking.">
            <div className="text-xs font-medium text-muted-foreground">Origin</div>
            <div className="mt-3">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Full Name</label>
              <input defaultValue="Juan Dela Cruz" className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Contact Number</label>
                <input defaultValue="+63 951234567" className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Email Address</label>
                <input defaultValue="juand.cruz@example.com" className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
              </div>
            </div>
          </Card>

          <Card icon={Car} title="New Vehicle Details" subtitle="Enter the specifications of your new vehicle.">
            <div className="grid gap-3 md:grid-cols-2">
              <F label="Vehicle Model" placeholder="e.g., Toyota Camry 2022" />
              <S label="Year" placeholder="Model 2022" />
              <S label="Transmission" placeholder="AUTOMATIC" />
              <F label="Mileage" />
              <F label="License Plate" placeholder="e.g., ABC-1234" wide />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-[color:var(--brand)]" />
              Save this vehicle for future bookings
            </label>
          </Card>

          <Card icon={Wrench} title="Service Preferences" subtitle="Tell us what your vehicle needs and where.">
            <label className="text-sm font-medium">Type of Service</label>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <Radio label="Shop Visit" active={pickup === "shop"} onClick={() => setPickup("shop")} />
              <Radio label="Home Service" active={pickup === "home"} onClick={() => setPickup("home")} />
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Service Category</label>
              <select className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
                <option>Select a Service</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Additional Notes or Concerns</label>
              <textarea rows={4} placeholder="Describe any specific issues (e.g., strange noises, warning lights)..." className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
            </div>
          </Card>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand" />
              <h3 className="font-semibold">Booking Summary</h3>
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <SumRow label="Customer Name" value="Juan Dela Cruz" />
              <SumRow label="Vehicle" value="" />
              <SumRow label="Plate Number" value="" />
              <SumRow label="Service Option" value="" />
              <SumRow label="Service Needed" value="" />
            </div>
          </div>

          <div className="rounded-xl bg-brand p-4 text-brand-foreground">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Info className="h-4 w-4" /> NOTE TO CUSTOMER
            </div>
            <p className="mt-2 text-xs text-white/85">
              Please ensure you have the vehicle's registration documents ready for the mechanic's verification.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <Calendar className="mx-auto h-4 w-4 text-brand" />
              <div className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">Availability</div>
              <div className="text-sm font-bold">24h Response</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <ShieldCheck className="mx-auto h-4 w-4 text-brand" />
              <div className="mt-2 text-[10px] font-semibold uppercase text-muted-foreground">Warranty</div>
              <div className="text-sm font-bold">6 Months</div>
            </div>
          </div>
        </aside>
      </div>

      <div className="mt-8 flex justify-end gap-3">
        <button className="rounded-md border px-5 py-2 text-sm hover:bg-accent">Save as Draft</button>
        <button
          onClick={() => setShowConfirmModal(true)}
          className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          Confirm Booking
        </button>
      </div>

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card p-6 text-center shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button onClick={() => setShowConfirmModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-lg font-bold">Booking Confirmed!</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Your vehicle registration and service request have been submitted. We'll notify you once it's reviewed.
            </p>
            <button
              onClick={() => setShowConfirmModal(false)}
              className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              Okay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand"><Icon className="h-4 w-4" /></div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function F({ label, wide, ...p }: { label: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <input {...p} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" />
    </div>
  );
}

function S({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground focus:border-brand focus:outline-none">
        <option>{placeholder}</option>
      </select>
    </div>
  );
}

function Radio({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-md border p-3 text-sm ${
      active ? "bg-muted" : "hover:bg-accent"
    }`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-muted-foreground"}`}>
        {active && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      {label}
    </button>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}

export default RegisterVehicle;
