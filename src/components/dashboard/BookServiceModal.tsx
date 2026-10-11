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
import { bookingNeedsScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import { buildCategoryLabel } from "@/lib/bookingServices";
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

type ServiceOption = { id: number; name: string; type: 'maintenance' | 'repair' | 'diagnostics'; description: string | null };
type PackageOption = { id: number; name: string; description: string | null; intervalKm: number | null; intervalMonths: number | null; serviceIds: number[] };

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
  const [options, setOptions] = useState<{ services: ServiceOption[]; packages: PackageOption[] } | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [tile, setTile] = useState<'maintenance' | 'repair' | 'notsure'>('maintenance');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [serviceSearch, setServiceSearch] = useState('');
  const notSure = tile === 'notsure';

  const [notes, setNotes] = useState("");
  // Explicit agreement to the OBD-II scan fee when the category needs it.
  const [scanAcknowledged, setScanAcknowledged] = useState(false);

  const selectedServices = options ? options.services.filter((s) => selectedIds.includes(s.id)) : [];
  const candidatePackage = options?.packages.find((p) => p.id === packageId) || null;
  const activePackage =
    candidatePackage && candidatePackage.serviceIds.some((id) => selectedIds.includes(id))
      ? candidatePackage
      : null;
  const needsScan = bookingNeedsScan(notSure, selectedServices.map((s) => s.name));
  // Every service that is inside some package. The Maintenance list shows these too, so a
  // package item that is not labelled "maintenance" (like the check-up) can still be unticked there.
  const packageServiceIds = new Set<number>((options?.packages ?? []).flatMap((p) => p.serviceIds));

  useEffect(() => {
    if (!needsScan) {
      setScanAcknowledged(false);
    }
  }, [needsScan]);

  const loadOptions = () => {
    setOptionsError(false);
    fetch('/api/customer/service-options')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.services) && Array.isArray(data.packages)) {
          setOptions({ services: data.services, packages: data.packages });
        } else {
          setOptionsError(true);
        }
      })
      .catch((err) => {
        console.error('Failed to load service options', err);
        setOptionsError(true);
      });
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const togglePackage = (p: PackageOption) => {
    const allTicked = p.serviceIds.length > 0 && p.serviceIds.every((id) => selectedIds.includes(id));
    if (allTicked) {
      setSelectedIds((prev) => prev.filter((id) => !p.serviceIds.includes(id)));
      setPackageId(null);
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...p.serviceIds])));
      setPackageId(p.id);
    }
    if (fieldErrors.service) setFieldErrors((prev) => ({ ...prev, service: '' }));
  };

  const toggleService = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    if (fieldErrors.service) setFieldErrors((prev) => ({ ...prev, service: '' }));
  };

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

    const noteText = notes.trim();
    if (!notSure && selectedIds.length === 0 && noteText.length < 5) {
      errs.service = optionsError
        ? "Describe what you need in the notes box."
        : "Pick at least one service, choose \"Not sure\", or describe the problem in the notes.";
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

    const reqBody: any = {
      userId: parseInt(userId, 10),
      serviceMode: pickup === "shop" ? "Shop Visit" : "Home Service",
      serviceIds: selectedIds,
      packageId: activePackage ? activePackage.id : null,
      notSure,
      customerNote: notes.trim(),
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
              </BookModalCard>

              <BookModalCard
                icon={ClipboardCheck}
                title="What do you need?"
                subtitle="Pick what applies. The shop confirms the final list and price."
              >
                {fieldErrors.service && (
                  <p className="mb-4 text-xs font-medium text-rose-500">{fieldErrors.service}</p>
                )}

                {/* 1. Three tiles */}
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => {
                      setTile("maintenance");
                      if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition",
                      tile === "maintenance" ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        tile === "maintenance" ? "border-brand" : "border-muted-foreground"
                      )}
                    >
                      {tile === "maintenance" && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-foreground">Regular maintenance</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Nothing is broken. It is time for service.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTile("repair");
                      if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition",
                      tile === "repair" ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        tile === "repair" ? "border-brand" : "border-muted-foreground"
                      )}
                    >
                      {tile === "repair" && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-foreground">Something is wrong</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">A noise, leak, warning light or worn part.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTile("notsure");
                      if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                    }}
                    className={cn(
                      "flex items-start gap-3 rounded-md border p-3 text-left transition",
                      tile === "notsure" ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                        tile === "notsure" ? "border-brand" : "border-muted-foreground"
                      )}
                    >
                      {tile === "notsure" && <span className="h-2 w-2 rounded-full bg-brand" />}
                    </span>
                    <div>
                      <p className="font-semibold text-sm text-foreground">Not sure</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">We will check your car and tell you what it needs.</p>
                    </div>
                  </button>
                </div>

                {/* 2. Loading state */}
                {!options && !optionsError && (
                  <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Loading services...</span>
                  </div>
                )}

                {/* 3. Options error */}
                {optionsError && (
                  <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-950 dark:bg-rose-950/20 dark:text-rose-200">
                    <div className="flex items-center justify-between">
                      <span>We couldn&apos;t load the service list.</span>
                      <button
                        type="button"
                        onClick={loadOptions}
                        className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                      >
                        <RefreshCw className="h-3 w-3" /> Try again
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      You can also describe what you need in the notes box.
                    </p>
                  </div>
                )}

                {/* 4. Tile maintenance */}
                {options && tile === "maintenance" && (
                  <div className="mt-5 space-y-5">
                    {options.packages.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold">Maintenance packages</h4>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Tap a package to tick everything in it. You can untick what you don&apos;t need.
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-3">
                          {options.packages.map((pkg) => {
                            const allTicked =
                              pkg.serviceIds.length > 0 &&
                              pkg.serviceIds.every((id) => selectedIds.includes(id));
                            const someTicked =
                              !allTicked &&
                              pkg.serviceIds.some((id) => selectedIds.includes(id));

                            const intervalParts: string[] = [];
                            if (pkg.intervalKm) {
                              intervalParts.push(`${pkg.intervalKm.toLocaleString("en-PH")} km`);
                            }
                            if (pkg.intervalMonths) {
                              intervalParts.push(`${pkg.intervalMonths} months`);
                            }
                            const intervalText =
                              intervalParts.length > 0 ? `Every ${intervalParts.join(" or ")}` : null;

                            return (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => togglePackage(pkg)}
                                className={cn(
                                  "flex flex-col justify-between rounded-lg border p-3.5 text-left transition",
                                  allTicked
                                    ? "border-brand bg-brand-soft/40"
                                    : someTicked
                                    ? "border-brand/60 bg-brand-soft/20"
                                    : "hover:bg-accent"
                                )}
                              >
                                <div>
                                  <div className="flex items-start justify-between gap-2">
                                    <h5 className="font-semibold text-sm text-foreground">{pkg.name}</h5>
                                    {allTicked ? (
                                      <span className="rounded bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                                        Selected
                                      </span>
                                    ) : someTicked ? (
                                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                        Some selected
                                      </span>
                                    ) : null}
                                  </div>
                                  {pkg.description && (
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                      {pkg.description}
                                    </p>
                                  )}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                                  {intervalText && <span>{intervalText} · </span>}
                                  <span>{pkg.serviceIds.length} services</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="text-sm font-semibold">Maintenance services</h4>
                      <div className="mt-2 divide-y rounded-md border">
                        {options.services
                          .filter((s) => s.type === "maintenance" || packageServiceIds.has(s.id))
                          .map((s) => {
                            const checked = selectedIds.includes(s.id);
                            return (
                              <label
                                key={s.id}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 p-3 transition hover:bg-muted/30",
                                  checked && "bg-brand-soft/20"
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleService(s.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                                />
                                <div className="flex-1">
                                  <span className="text-sm font-medium leading-snug">{s.name}</span>
                                  {s.description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Tile repair */}
                {options && tile === "repair" && (
                  <div className="mt-5 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <h4 className="text-sm font-semibold">Repair services</h4>
                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search services"
                          value={serviceSearch}
                          onChange={(e) => setServiceSearch(e.target.value)}
                          className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-brand focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="divide-y rounded-md border">
                      {options.services
                        .filter(
                          (s) =>
                            (s.type === "repair" || s.type === "diagnostics") &&
                            s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase())
                        )
                        .map((s) => {
                          const checked = selectedIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={cn(
                                "flex cursor-pointer items-start gap-3 p-3 transition hover:bg-muted/30",
                                checked && "bg-brand-soft/20"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleService(s.id)}
                                className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                              />
                              <div className="flex-1">
                                <span className="text-sm font-medium leading-snug">{s.name}</span>
                                {s.description && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      {options.services.filter(
                        (s) =>
                          (s.type === "repair" || s.type === "diagnostics") &&
                          s.name.toLowerCase().includes(serviceSearch.trim().toLowerCase())
                      ).length === 0 && (
                        <p className="p-4 text-center text-xs text-muted-foreground">
                          No services match your search.
                        </p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Not in the list? Describe it in the notes below.
                    </p>
                  </div>
                )}

                {/* 6. Tile notsure */}
                {tile === "notsure" && (
                  <p className="mt-4 rounded-md border bg-muted/20 p-3.5 text-xs text-muted-foreground">
                    Tell us what you notice in the notes below. We will inspect the car and tell you what it needs.
                  </p>
                )}

                {/* 7. Scan fee box */}
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

                {/* 8. Notes box */}
                <div className="mt-4">
                  <label className="text-sm font-medium">
                    {!notSure && selectedIds.length === 0 ? "Describe the problem" : "Notes for the shop (optional)"}
                  </label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                    }}
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
                  <BookSumRow
                    label="Service Needed"
                    value={
                      selectedServices.length === 0 && !notSure
                        ? "—"
                        : notSure && selectedServices.length === 0
                        ? "Not sure"
                        : buildCategoryLabel({
                            packageName: activePackage ? activePackage.name : null,
                            packageServiceNames: activePackage
                              ? options?.services
                                  .filter((s) => activePackage.serviceIds.includes(s.id))
                                  .map((s) => s.name) ?? []
                              : [],
                            selectedNames: selectedServices.map((s) => s.name),
                            notSure: false,
                          })
                    }
                  />
                  {selectedServices.length > 0 && (
                    <div className="flex items-start justify-between border-b pb-2 last:border-0">
                      <span className="text-muted-foreground">Services</span>
                      <div className="text-right max-w-[60%] space-y-1">
                        {selectedServices.map((s) => (
                          <p key={s.id} className="text-xs font-medium text-foreground leading-snug">
                            {s.name}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
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

