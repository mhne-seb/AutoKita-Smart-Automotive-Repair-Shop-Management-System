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


function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function toDateValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dy = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dy}`
}

// Book New Service modal — ported from the public /book page (BookPage) so the
// dashboard flow matches it field-for-field, just shown as a modal instead of
// a standalone route with its own Header/Footer.

// Book New Service modal — single-page form matching the /dashboard/register-vehicle layout.

const BOOK_CATEGORIES = [
  "Oil Change", "Brake Service", "Engine Diagnostics", "Tire Replacement",
  "Aircon Repair", "General Maintenance", "Car Wash & Detailing",
];
const BOOK_OTHERS = "Others";
const BOOK_VEHICLE_MAKES = [
  "Toyota", "Honda", "Mitsubishi", "Ford", "Nissan", "Hyundai", "Kia",
  "Suzuki", "Isuzu", "Mazda", "Chevrolet", "Subaru", "Volkswagen",
  "BMW", "Mercedes-Benz", "Peugeot", "Geely", "Chery", "MG",
];
const BOOK_YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));

// onBooked fires once a booking succeeds so the dashboard behind the modal
// refetches — the new Pending Request should be there when the modal closes,
// not after a manual refresh.
export function BookServiceModal({ initialVehicleId, onClose, onBooked }: { initialVehicleId?: string; onClose: () => void; onBooked: () => void }) {
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // Plate of a car that already has an open job order — shows a modal instead
  // of a browser alert when the customer tries to book it again.
  const [inServicePlate, setInServicePlate] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeJobOrders, setActiveJobOrders] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleTransmission, setVehicleTransmission] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [pickup, setPickup] = useState<"shop" | "home">("shop");
  const [preferredDate, setPreferredDate] = useState<Date>(startOfToday());
  const [preferredTime, setPreferredTime] = useState<string>("08:00 AM");
  const [homeAddress, setHomeAddress] = useState("");
  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceCategoryOther, setServiceCategoryOther] = useState("");
  const [notes, setNotes] = useState("");
  // Explicit agreement to the OBD-II scan fee when the category needs it.
  const [scanAcknowledged, setScanAcknowledged] = useState(false);
  const needsScan = requiresDiagnosticScan(serviceCategory);

  useEffect(() => {
    const userId = sessionStorage.getItem("autokita_user_id");
    if (!userId) {
      setLoading(false);
      return;
    }
    fetch(`/api/dashboard?userId=${userId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
        
        const activeJo = data.activeJobOrders || [];
        if (data.activeJobOrders) setActiveJobOrders(activeJo);

        if (data.vehicles && data.vehicles.length > 0) {
          setVehicles(data.vehicles);
          if (initialVehicleId) {
            const v = data.vehicles.find((v: any) => v.id.toString() === initialVehicleId);
            if (v && !v.in_service) {
              setSelectedVehicleId(initialVehicleId);
            }
          }
        } else {
          setSelectedVehicleId("new");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load dashboard data", err);
        setLoading(false);
      });
      
    try {
      const draftStr = sessionStorage.getItem("autokita_booking_draft");
      if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.date && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
          const [y, m, d] = draft.date.split("-").map(Number);
          const parsed = new Date(y, m - 1, d);
          parsed.setHours(0, 0, 0, 0);
          if (parsed >= startOfToday()) {
            setPreferredDate(parsed);
          }
        }
        if (draft.time) {
          // Assume time is one of the valid TimeslotPicker options
          setPreferredTime(draft.time);
        }
      }
    } catch {
      // ignore
    } finally {
      sessionStorage.removeItem("autokita_booking_draft");
    }
  }, []);

  // Keep the page behind the modal still while the form scrolls inside it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  const isVehicleActive = (plate: string) =>
    vehicles.some((v) => v.in_service && String(v.plate_number).toUpperCase() === String(plate).toUpperCase());

  const handleConfirm = async () => {
    if (isSubmitting) return;
    const userId = sessionStorage.getItem("autokita_user_id");
    if (!userId) {
      toast.error("You must be logged in to book a service.");
      return;
    }

    const errs: Record<string, string> = {};

    if (!selectedVehicleId) {
      errs.selectedVehicleId = "Please select a vehicle or choose '+ Register New Vehicle'.";
    }

    if (selectedVehicleId === "new") {
      if (!vehicleModel.trim()) {
        errs.vehicleModel = "Vehicle model is required (e.g., Civic, Vios).";
      }
      if (!vehiclePlate.trim()) {
        errs.vehiclePlate = "License plate is required.";
      } else {
        const cleanPlate = normalizePlateNumber(vehiclePlate);
        if (!isValidPlateNumber(cleanPlate)) {
          errs.vehiclePlate = PLATE_FORMAT_ERROR_MESSAGE;
        } else if (isVehicleActive(cleanPlate) || isVehicleActive(vehiclePlate)) {
          setInServicePlate(vehiclePlate);
          return;
        }
      }
      if (vehicleMileage && parseFloat(vehicleMileage) < 0) {
        errs.vehicleMileage = "Mileage cannot be negative.";
      }
    }

    if (!serviceCategory) {
      errs.serviceCategory = "Please select a service category.";
    } else if (serviceCategory === BOOK_OTHERS && !serviceCategoryOther.trim()) {
      errs.serviceCategoryOther = "Please describe the service you need.";
    }

    if (pickup === "home" && !user?.address && !homeAddress.trim()) {
      errs.homeAddress = "Home address is required.";
    }

    if (needsScan && !scanAcknowledged) {
      toast.error("Please agree to the diagnostic scan fee to continue.");
      return;
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error("Please fill in the required fields highlighted in red.");
      return;
    }

    const category = serviceCategory === BOOK_OTHERS ? serviceCategoryOther.trim() : serviceCategory;
    const reqBody: any = {
      userId: parseInt(userId, 10),
      serviceMode: pickup === "shop" ? "Shop Visit" : "Home Service",
      customerConcern: `Category: ${category || "Not specified"}. Notes: ${notes || "None"}`,
      homeAddress: pickup === "home" ? (user?.address || homeAddress.trim().substring(0, 200)) : (user?.address || "None"),
      diagnosticScanAuthorized: needsScan && scanAcknowledged,
      preferredDatetime: preferredDate && preferredTime ? toManilaIso(toDateValue(preferredDate), preferredTime) : null,
    };

    if (selectedVehicleId === "new") {
      const cleanPlate = normalizePlateNumber(vehiclePlate);
      reqBody.newVehicleDetails = {
        make: vehicleMake || null,
        model: vehicleModel.trim(),
        year: vehicleYear || new Date().getFullYear().toString(),
        type: vehicleTransmission || "Sedan",
        mileage: vehicleMileage || "0",
        plate: cleanPlate,
      };
    } else {
      reqBody.vehicleId = parseInt(selectedVehicleId, 10);
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/customer/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
      });
      const data = await res.json();
      if (data.success) {
        setShowConfirmModal(true);
        onBooked();
      } else if (data.code === 'INVALID_PLATE_FORMAT') {
        setFieldErrors((prev) => ({
          ...prev,
          vehiclePlate: data.message || "Invalid license plate format (e.g., ABC-1234 or 123-ABC)."
        }));
        toast.error("Invalid license plate format.");
      } else if (data.code === 'PLATE_REGISTERED') {
        setFieldErrors((prev) => ({
          ...prev,
          vehiclePlate: "This vehicle is already registered. Please select it from your saved vehicles."
        }));
        toast.error("Vehicle already registered.");
      } else {
        toast.error("Booking failed: " + (data.message || "Please check details and try again."));
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred while confirming your booking. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedVehicleDetails =
    selectedVehicleId === "new" ? null : vehicles.find((v) => v.id.toString() === selectedVehicleId);
  const displayVehicle = selectedVehicleDetails
    ? `${selectedVehicleDetails.vehicle_model} (${selectedVehicleDetails.plate_number})`
    : vehicleModel
    ? `${vehicleModel} (${vehiclePlate || "—"})`
    : "—";

  const userFullName = user ? `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.nickname : "Guest";
  const userContact = user?.contact_number || "—";
  const userEmail = user?.email || "—";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col rounded-xl border bg-card shadow-2xl">
        <div className="flex shrink-0 items-start justify-between border-b p-6 md:px-8">
          <div>
            <h1 className="text-2xl font-bold">Book New Service</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Register a vehicle or pick an existing one to schedule your visit.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 md:px-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading...
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="space-y-5 min-w-0">
              <BookModalCard icon={User} title="Customer Details" subtitle="Review your contact details for this booking.">
                <div>
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
              </BookModalCard>

              <BookModalCard icon={Car} title="Vehicle Details" subtitle="Select an existing vehicle or register a new one.">
                <div className="mb-4">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">Select Vehicle</label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => {
                      setSelectedVehicleId(e.target.value);
                      if (fieldErrors.selectedVehicleId) setFieldErrors((p) => ({ ...p, selectedVehicleId: "" }));
                    }}
                    className={cn(
                      "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none transition-colors",
                      fieldErrors.selectedVehicleId
                        ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500"
                        : "border-input focus:border-brand"
                    )}
                  >
                    <option value="" disabled>
                      {" "}Select a vehicle...
                    </option>
                    {vehicles.map((v) => {
                      const isActive = !!v.in_service;
                      return (
                        <option key={v.id} value={v.id.toString()} disabled={isActive}>
                          {v.vehicle_model} ({v.plate_number}) {isActive ? " - Currently in Job Order" : ""}
                        </option>
                      );
                    })}
                    <option value="new">+ Register New Vehicle</option>
                  </select>
                  {fieldErrors.selectedVehicleId ? (
                    <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.selectedVehicleId}</p>
                  ) : selectedVehicleId === "" ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Choose one of your saved vehicles, or register a new one.
                    </p>
                  ) : null}
                </div>

                {selectedVehicleId === "new" && (
                  <>
                    <div className="mb-4 h-px bg-border" />
                    <div className="grid gap-3 md:grid-cols-2">
                      <BookModalSelect
                        label="Vehicle Make (Brand)"
                        placeholder="Select Brand"
                        value={vehicleMake}
                        onChange={(e) => {
                          setVehicleMake(e.target.value);
                          if (fieldErrors.vehicleMake) setFieldErrors((p) => ({ ...p, vehicleMake: "" }));
                        }}
                        options={BOOK_VEHICLE_MAKES}
                        error={fieldErrors.vehicleMake}
                      />
                      <BookModalInput
                        label="Vehicle Model"
                        placeholder="e.g., Vios, Civic, Montero"
                        value={vehicleModel}
                        onChange={(e) => {
                          setVehicleModel(e.target.value);
                          if (fieldErrors.vehicleModel) setFieldErrors((p) => ({ ...p, vehicleModel: "" }));
                        }}
                        error={fieldErrors.vehicleModel}
                      />
                      <BookModalSelect
                        label="Year"
                        placeholder="Select Year"
                        value={vehicleYear}
                        onChange={(e) => setVehicleYear(e.target.value)}
                        options={BOOK_YEARS}
                      />
                      <BookModalSelect
                        label="Transmission"
                        placeholder="Select Transmission"
                        value={vehicleTransmission}
                        onChange={(e) => setVehicleTransmission(e.target.value)}
                        options={["Automatic", "Manual"]}
                      />
                      <BookModalInput
                        label="Mileage"
                        placeholder="e.g., 50000"
                        type="number"
                        value={vehicleMileage}
                        onChange={(e) => {
                          setVehicleMileage(e.target.value);
                          if (fieldErrors.vehicleMileage) setFieldErrors((p) => ({ ...p, vehicleMileage: "" }));
                        }}
                        error={fieldErrors.vehicleMileage}
                      />
                      <BookModalInput
                        label="License Plate"
                        placeholder="e.g., ABC-1234"
                        wide
                        value={vehiclePlate}
                        onChange={(e) => {
                          setVehiclePlate(e.target.value);
                          if (fieldErrors.vehiclePlate) setFieldErrors((p) => ({ ...p, vehiclePlate: "" }));
                        }}
                        error={fieldErrors.vehiclePlate}
                      />
                    </div>
                  </>
                )}
              </BookModalCard>

              <BookModalCard icon={Wrench} title="Service Preferences" subtitle="Tell us what your vehicle needs and where.">
                <label className="text-sm font-medium">Type of Service</label>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <BookRadioTile icon={MapPin} label="Shop Visit" active={pickup === "shop"} onClick={() => setPickup("shop")} />
                  <BookRadioTile icon={Car} label="Home Service" active={pickup === "home"} onClick={() => setPickup("home")} />
                </div>
                {pickup === "home" && !user?.address && (
                  <div className="mt-4">
                    <BookModalInput
                      label="Home Address"
                      placeholder="Enter your full home address"
                      value={homeAddress}
                      onChange={(e) => {
                        setHomeAddress(e.target.value);
                        if (fieldErrors.homeAddress) setFieldErrors((p) => ({ ...p, homeAddress: "" }));
                      }}
                      error={fieldErrors.homeAddress}
                    />
                  </div>
                )}
                <div className="mt-4">
                  <div className="mt-2">
                    <TimeslotPicker
                      date={preferredDate}
                      time={preferredTime}
                      onChangeDate={setPreferredDate}
                      onChangeTime={setPreferredTime}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="text-sm font-medium">Service Category</label>
                  <select
                    value={serviceCategory}
                    onChange={(e) => {
                      setServiceCategory(e.target.value);
                      setScanAcknowledged(false);
                      if (fieldErrors.serviceCategory) setFieldErrors((p) => ({ ...p, serviceCategory: "" }));
                    }}
                    className={cn(
                      "mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground focus:outline-none transition-colors",
                      fieldErrors.serviceCategory
                        ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500"
                        : "border-input focus:border-brand"
                    )}
                  >
                    <option value="">Select a Service</option>
                    {BOOK_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value={BOOK_OTHERS}>Others (type your own)</option>
                  </select>
                  {fieldErrors.serviceCategory && (
                    <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.serviceCategory}</p>
                  )}
                  {serviceCategory === BOOK_OTHERS && (
                    <>
                      <input
                        value={serviceCategoryOther}
                        onChange={(e) => {
                          setServiceCategoryOther(e.target.value);
                          if (fieldErrors.serviceCategoryOther) setFieldErrors((p) => ({ ...p, serviceCategoryOther: "" }));
                        }}
                        placeholder="Please describe the service you need"
                        autoFocus
                        className={cn(
                          "mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none transition-colors",
                          fieldErrors.serviceCategoryOther
                            ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500"
                            : "border-brand/50 focus:border-brand"
                        )}
                      />
                      {fieldErrors.serviceCategoryOther && (
                        <p className="mt-1 text-xs text-rose-500 font-medium">{fieldErrors.serviceCategoryOther}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Scanner-fee disclosure — same rule and wording as the public
                    booking page. Confirm is blocked until it's agreed to. */}
                {needsScan && (
                  <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="font-semibold text-amber-950">
                          Scan fee: {formatPeso(DIAGNOSTIC_SCAN_FEE)}
                        </p>
                        <p className="mt-1 text-sm text-amber-900">
                          To find the problem, we will plug a scanner into your car. You will pay this fee{" "}
                          <b>even if you decide not to push through with the repair</b>. Repairs are priced
                          separately, and we&apos;ll ask you first.
                        </p>
                        <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-amber-950">
                          <input
                            type="checkbox"
                            checked={scanAcknowledged}
                            onChange={(e) => setScanAcknowledged(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-600"
                          />
                          <span>I agree to pay the {formatPeso(DIAGNOSTIC_SCAN_FEE)} scan fee.</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
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
              </BookModalCard>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <div className="rounded-xl border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4 text-brand" />
                  <h3 className="font-semibold">Booking Summary</h3>
                </div>
                <div className="mt-5 space-y-3 text-sm">
                  <BookSumRow label="Customer Name" value={userFullName} />
                  <BookSumRow label="Vehicle" value={displayVehicle} />
                  <BookSumRow label="Service Option" value={pickup === "shop" ? "Shop Visit" : "Home Service"} />
                  <BookSumRow label="Service Needed" value={serviceCategory || "—"} />
                  {preferredDate && preferredTime && (
                    <BookSumRow
                      label="Preferred Date"
                      value={new Date(toManilaIso(toDateValue(preferredDate), preferredTime)).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
        </div>

        {!loading && (
          <div className="flex shrink-0 justify-end gap-3 border-t p-4 md:px-8">
            <button onClick={onClose} className="rounded-md border px-5 py-2 text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting || (needsScan && !scanAcknowledged)}
              title={needsScan && !scanAcknowledged ? "Agree to the diagnostic scan fee first" : undefined}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Confirming..." : "Confirm Booking"}
            </button>
          </div>
        )}
      </div>

      {inServicePlate && (
        <VehicleInServiceModal plate={inServicePlate} onClose={() => setInServicePlate(null)} />
      )}

      {showConfirmModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="relative w-full max-w-sm rounded-xl bg-card p-6 text-center shadow-lg">
            <button 
              onClick={() => { setShowConfirmModal(false); onClose(); }}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-accent"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
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
                onClose();
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

function BookModalCard({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: any;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function BookModalInput({
  label,
  wide,
  error,
  className,
  ...p
}: { label: string; wide?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <input
        {...p}
        className={cn(
          "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:outline-none",
          error
            ? "border-rose-500 text-rose-950 dark:text-rose-100 focus:border-rose-500 ring-1 ring-rose-500"
            : "border-input focus:border-brand",
          className
        )}
      />
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

function BookModalSelect({
  label,
  placeholder,
  options,
  error,
  className,
  ...p
}: { label: string; placeholder: string; options?: string[]; error?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <select
        {...p}
        className={cn(
          "mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground transition-colors focus:outline-none",
          error
            ? "border-rose-500 focus:border-rose-500 ring-1 ring-rose-500"
            : "border-input focus:border-brand",
          className
        )}
      >
        <option value="">{placeholder}</option>
        {options?.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>}
    </div>
  );
}

function BookRadioTile({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md border p-3 text-sm transition ${
        active ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-muted-foreground"}`}>
        {active && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      <Icon className="h-4 w-4 text-brand" /> {label}
    </button>
  );
}

function BookSumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%] line-clamp-2">{value || "—"}</span>
    </div>
  );
}

