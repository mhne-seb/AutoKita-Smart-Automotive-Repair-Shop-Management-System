'use client'

// Route: /dashboard/register-vehicle — form for a Customer to add a new vehicle to their account and book a service.

import { useState, useEffect } from "react";
import { FileText, Car, Wrench, ClipboardList, Info, Calendar, ShieldCheck, CheckCircle2, X } from "lucide-react";

function RegisterVehicle() {
  useEffect(() => { document.title = "Register New Vehicle — AutoKita"; }, []);

  const [pickup, setPickup] = useState<"shop" | "home">("shop");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // User and vehicle state
  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeJobOrders, setActiveJobOrders] = useState<any[]>([]);
  
  // Form state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("new");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleTransmission, setVehicleTransmission] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const userId = sessionStorage.getItem("autokita_user_id");
    if (userId) {
      fetch(`/api/dashboard?userId=${userId}`)
        .then(res => res.json())
        .then(data => {
          if (data.user) setUser(data.user);
          if (data.vehicles) setVehicles(data.vehicles);
          if (data.activeJobOrders) setActiveJobOrders(data.activeJobOrders);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load dashboard data", err);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleConfirm = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const userId = sessionStorage.getItem("autokita_user_id");
    if (!userId) {
      alert("You must be logged in to book a service.");
      return;
    }

    const isVehicleActive = (plate: string) => {
      return activeJobOrders.some(jo => jo.plate_number === plate);
    };
    
    const reqBody: any = {
      userId: parseInt(userId, 10),
      serviceMode: pickup === "shop" ? "Shop Visit" : "Home Service",
      customerConcern: `Category: ${serviceCategory || 'Not specified'}. Notes: ${notes || 'None'}`,
      homeAddress: user?.address || "None"
    };

    if (selectedVehicleId === "new") {
      if (!vehicleModel || !vehiclePlate) {
        alert("Please provide the new vehicle's model and license plate.");
        return;
      }
      if (isVehicleActive(vehiclePlate)) {
        alert("This vehicle is currently in an active job order and cannot be booked for a new service.");
        return;
      }
      reqBody.newVehicleDetails = {
        model: vehicleModel,
        year: vehicleYear || new Date().getFullYear().toString(),
        type: vehicleTransmission || "Sedan",
        mileage: vehicleMileage || "0",
        plate: vehiclePlate
      };
    } else {
      reqBody.vehicleId = parseInt(selectedVehicleId, 10);
    }

    try {
      const res = await fetch("/api/customer/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();
      if (data.success) {
        setShowConfirmModal(true);
      } else {
        alert("Booking failed: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while confirming your booking.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVehicleDetails = selectedVehicleId === "new" 
    ? null 
    : vehicles.find(v => v.id.toString() === selectedVehicleId);

  const displayVehicle = selectedVehicleDetails 
    ? `${selectedVehicleDetails.vehicle_model} (${selectedVehicleDetails.plate_number})`
    : vehicleModel ? `${vehicleModel} (${vehiclePlate})` : "—";

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  const userFullName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.nickname : 'Guest';
  const userContact = user?.contact_number || '—';
  const userEmail = user?.email || '—';

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-bold">Register New Vehicle & Book Service</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-5">
          <Card icon={FileText} title="Customer Details" subtitle="Review your contact details for this booking.">
            <div className="text-xs font-medium text-muted-foreground">Origin</div>
            <div className="mt-3">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Full Name</label>
              <input value={userFullName} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Contact Number</label>
                <input value={userContact} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
              </div>
              <div>
                <label className="text-[10px] font-semibold uppercase text-muted-foreground">Email Address</label>
                <input value={userEmail} className="mt-1 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm" readOnly />
              </div>
            </div>
          </Card>

          <Card icon={Car} title="Vehicle Details" subtitle="Select an existing vehicle or register a new one.">
            <div className="mb-4">
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Select Vehicle</label>
              <select 
                value={selectedVehicleId} 
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
              >
                {vehicles.map(v => {
                  const isActive = activeJobOrders.some(jo => jo.plate_number === v.plate_number);
                  return (
                    <option key={v.id} value={v.id.toString()} disabled={isActive}>
                      {v.vehicle_model} ({v.plate_number}) {isActive ? " - Currently in Job Order" : ""}
                    </option>
                  );
                })}
                <option value="new">+ Register New Vehicle</option>
              </select>
            </div>

            {selectedVehicleId === "new" && (
              <>
                <div className="mb-4 h-px bg-border" />
                <div className="grid gap-3 md:grid-cols-2">
                  <F label="Vehicle Model" placeholder="e.g., Toyota Camry 2022" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} />
                  <S label="Year" placeholder="Select Year" value={vehicleYear} onChange={(e) => setVehicleYear(e.target.value)} options={["2025", "2024", "2023", "2022", "2021", "2020", "2019"]} />
                  <S label="Transmission" placeholder="Select Transmission" value={vehicleTransmission} onChange={(e) => setVehicleTransmission(e.target.value)} options={["Automatic", "Manual"]} />
                  <F label="Mileage" placeholder="e.g., 50000" type="number" value={vehicleMileage} onChange={(e) => setVehicleMileage(e.target.value)} />
                  <F label="License Plate" placeholder="e.g., ABC-1234" wide value={vehiclePlate} onChange={(e) => setVehiclePlate(e.target.value)} />
                </div>
                <label className="mt-4 flex items-center gap-2 text-sm">
                  <input type="checkbox" defaultChecked className="h-4 w-4 accent-[color:var(--brand)]" />
                  Save this vehicle for future bookings
                </label>
              </>
            )}
          </Card>

          <Card icon={Wrench} title="Service Preferences" subtitle="Tell us what your vehicle needs and where.">
            <label className="text-sm font-medium">Type of Service</label>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              <Radio label="Shop Visit" active={pickup === "shop"} onClick={() => setPickup("shop")} />
              <Radio label="Home Service" active={pickup === "home"} onClick={() => setPickup("home")} />
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Service Category</label>
              <select 
                value={serviceCategory}
                onChange={(e) => setServiceCategory(e.target.value)}
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none"
              >
                <option value="">Select a Service</option>
                <option value="Periodic Maintenance">Periodic Maintenance</option>
                <option value="General Repair">General Repair</option>
                <option value="Checkup & Diagnostics">Checkup & Diagnostics</option>
                <option value="Body & Paint">Body & Paint</option>
              </select>
            </div>
            <div className="mt-4">
              <label className="text-sm font-medium">Additional Notes or Concerns</label>
              <textarea 
                rows={4} 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe any specific issues (e.g., strange noises, warning lights)..." 
                className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none" 
              />
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
              <SumRow label="Customer Name" value={userFullName} />
              <SumRow label="Vehicle" value={displayVehicle} />
              <SumRow label="Service Option" value={pickup === "shop" ? "Shop Visit" : "Home Service"} />
              <SumRow label="Service Needed" value={serviceCategory || "—"} />
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
          onClick={handleConfirm}
          disabled={isSubmitting}
          className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isSubmitting ? "Confirming..." : "Confirm Booking"}
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
              onClick={() => {
                setShowConfirmModal(false);
                window.location.href = '/dashboard';
              }}
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

function S({ label, placeholder, options, ...p }: { label: string; placeholder: string, options?: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <select {...p} className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:border-brand focus:outline-none">
        <option value="">{placeholder}</option>
        {options?.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
}

function Radio({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
      active ? "bg-muted border-brand" : "hover:bg-accent border-border"
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
      <span className="font-medium text-right max-w-[60%] line-clamp-2">{value || "—"}</span>
    </div>
  );
}

export default RegisterVehicle;
