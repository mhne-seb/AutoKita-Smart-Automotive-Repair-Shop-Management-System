'use client'

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  CheckCircle2,
  AlertCircle,
  Check,
  ClipboardCheck,
  User,
  X,
  MapPin,
  Search,
  RefreshCw,
  Loader2,
  Car,
  Calendar,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { VehicleInServiceModal } from "@/components/dashboard/VehicleInServiceModal";
import { bookingNeedsScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import { buildCategoryLabel } from "@/lib/bookingServices";
import { formatStamp, cn } from "@/lib/utils";
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from "@/lib/plate";
import { TimeslotPicker } from "@/components/TimeslotPicker";
import { toManilaIso } from "@/lib/bookingSlotsShared";
import { hoursForWeekday, slotStartHour, withMargin, ShopHours } from "@/lib/bookingTiming";

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

function formatHours(h: number): string {
  return Number(h.toFixed(1)).toString()
}

function formatDecimalTime(dec: number): string {
  const totalMinutes = Math.round(dec * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const ap = h >= 12 ? 'PM' : 'AM'
  let dispH = h % 12
  if (dispH === 0) dispH = 12
  const dispM = String(m).padStart(2, '0')
  return `${dispH}:${dispM} ${ap}`
}

type ServiceOption = {
  id: number
  name: string
  type: 'maintenance' | 'repair' | 'diagnostics'
  description: string | null
  baseDurationHours: number | null
}

type PackageOption = {
  id: number
  name: string
  description: string | null
  intervalKm: number | null
  intervalMonths: number | null
  serviceIds: number[]
}

const BOOK_VEHICLE_MAKES = [
  "Toyota", "Honda", "Mitsubishi", "Ford", "Nissan", "Hyundai", "Kia",
  "Suzuki", "Isuzu", "Mazda", "Chevrolet", "Subaru", "Volkswagen",
  "BMW", "Mercedes-Benz", "Peugeot", "Geely", "Chery", "MG",
];
const BOOK_YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));

export function BookingPage({ initialVehicleId }: { initialVehicleId?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [inServicePlate, setInServicePlate] = useState<string | null>(null);

  const [user, setUser] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);

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
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [homeAddress, setHomeAddress] = useState("");

  const [options, setOptions] = useState<{ services: ServiceOption[]; packages: PackageOption[] } | null>(null);
  const [shopHours, setShopHours] = useState<ShopHours>(null);
  const [optionsError, setOptionsError] = useState(false);

  // Three independent cards under "What do you need?"
  const [needMaintenance, setNeedMaintenance] = useState(false);
  const [needRepair, setNeedRepair] = useState(false);
  const [notSure, setNotSure] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [repairSearch, setRepairSearch] = useState('');

  const [notes, setNotes] = useState("");
  const [scanAcknowledged, setScanAcknowledged] = useState(false);
  const [overnightOk, setOvernightOk] = useState(false);

  const loadOptions = () => {
    setOptionsError(false);
    fetch('/api/customer/service-options')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.services) && Array.isArray(data.packages)) {
          setOptions({ services: data.services, packages: data.packages });
          if (data.shopHours) setShopHours(data.shopHours);
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

        if (data.vehicles && data.vehicles.length > 0) {
          setVehicles(data.vehicles);
          if (initialVehicleId) {
            const v = data.vehicles.find((veh: any) => veh.id.toString() === initialVehicleId);
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
  }, [initialVehicleId]);

  const selectedServices = options ? options.services.filter((s) => selectedIds.includes(s.id)) : [];
  const candidatePackage = options?.packages.find((p) => p.id === packageId) || null;
  const activePackage =
    candidatePackage && candidatePackage.serviceIds.some((id) => selectedIds.includes(id))
      ? candidatePackage
      : null;

  const needsScan = bookingNeedsScan(notSure, selectedServices.map((s) => s.name));

  useEffect(() => {
    if (!needsScan) {
      setScanAcknowledged(false);
    }
  }, [needsScan]);

  // Overnight calculation
  let knownHours = 0;
  let hasUnknownHour = false;
  selectedServices.forEach((s) => {
    if (s.baseDurationHours != null && s.baseDurationHours > 0) {
      knownHours += s.baseDurationHours;
    } else {
      hasUnknownHour = true;
    }
  });

  const shopDayHours = hoursForWeekday(shopHours, preferredDate.getDay());
  const startHour = slotStartHour(preferredTime);
  const durationWithMargin = withMargin(knownHours);
  const finishHour = startHour + durationWithMargin;

  const noticeShowing =
    shopDayHours !== null &&
    knownHours > 0 &&
    !Number.isNaN(startHour) &&
    finishHour > shopDayHours.close;

  const takesMoreThanOneDay =
    shopDayHours !== null &&
    knownHours > 0 &&
    durationWithMargin > (shopDayHours.close - shopDayHours.open);

  const fittingSlots =
    shopDayHours !== null && !takesMoreThanOneDay
      ? availableSlots.filter(
          (slot) => slotStartHour(slot) + durationWithMargin <= shopDayHours.close
        )
      : [];
  const recommendedSlot = fittingSlots.length > 0 ? fittingSlots[fittingSlots.length - 1] : null;

  useEffect(() => {
    if (!noticeShowing) {
      setOvernightOk(false);
      if (fieldErrors.overnight) setFieldErrors((p) => ({ ...p, overnight: "" }));
    }
  }, [noticeShowing]);

  const togglePackage = (pkg: PackageOption) => {
    if (packageId === pkg.id) {
      // Turn off
      setSelectedIds((prev) => prev.filter((id) => !pkg.serviceIds.includes(id)));
      setPackageId(null);
    } else {
      const prevPkg = options?.packages.find((p) => p.id === packageId);
      const prevIds = prevPkg ? prevPkg.serviceIds : [];
      setSelectedIds((prev) => {
        const withoutPrev = prev.filter((id) => !prevIds.includes(id));
        return Array.from(new Set([...withoutPrev, ...pkg.serviceIds]));
      });
      setPackageId(pkg.id);
    }
    if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
  };

  const toggleService = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
  };

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

    if (noticeShowing && !overnightOk) {
      errs.overnight = "Choose an earlier time or allow an overnight stay.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error("Please check the form for errors.");
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
      overnightOk: overnightOk && noticeShowing,
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
        setIsBooked(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else if (data.code === 'INVALID_PLATE_FORMAT') {
        setFieldErrors((prev) => ({
          ...prev,
          vehiclePlate: data.message || "Invalid license plate format."
        }));
        toast.error("Invalid license plate format.");
      } else if (data.code === 'PLATE_REGISTERED') {
        setFieldErrors((prev) => ({
          ...prev,
          vehiclePlate: "This vehicle is already registered. Please select it from your saved vehicles."
        }));
        toast.error("Vehicle already registered.");
      } else if (data.code === 'OVERNIGHT_NOT_AGREED') {
        setFieldErrors((prev) => ({
          ...prev,
          overnight: data.message || "Choose an earlier time or allow an overnight stay."
        }));
        toast.error(data.message || "Overnight stay agreement required.");
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

  const allPackageServiceIds = new Set(options?.packages.flatMap((p) => p.serviceIds) || []);
  const maintenanceServices = options
    ? options.services.filter((s) => s.type === "maintenance" || allPackageServiceIds.has(s.id))
    : [];
  const repairServices = options ? options.services.filter((s) => s.type === "repair") : [];
  const diagnosticServices = options ? options.services.filter((s) => s.type === "diagnostics") : [];

  const tickedMaintenance = selectedServices.filter((s) => s.type === "maintenance");
  const tickedRepair = selectedServices.filter((s) => s.type === "repair");
  const tickedDiagnostics = selectedServices.filter((s) => s.type === "diagnostics");

  const totalHoursEstimate =
    selectedServices.length > 0 && knownHours > 0
      ? hasUnknownHour
        ? `At least ${formatHours(knownHours)} hours`
        : `About ${formatHours(knownHours)} hours in total`
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading booking form...
      </div>
    );
  }

  if (isBooked) {
    return (
      <div className="mx-auto max-w-xl px-6 py-12">
        <div className="rounded-xl border bg-card p-6 md:p-8 text-center shadow-lg">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 className="mt-4 text-2xl font-bold">Booking sent</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We will notify you once the shop reviews it.
          </p>

          <div className="mt-6 rounded-lg border bg-muted/20 p-4 text-left text-sm space-y-3">
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Vehicle</span>
              <p className="font-semibold text-foreground">{displayVehicle}</p>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Services</span>
              <div className="mt-1 space-y-1">
                {selectedServices.map((s) => (
                  <p key={s.id} className="text-xs text-foreground">
                    • {s.name}
                  </p>
                ))}
                {notSure && <p className="text-xs text-foreground">• Check my car</p>}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">Date and Time</span>
              <p className="text-xs text-foreground">
                {new Date(toManilaIso(toDateValue(preferredDate), preferredTime)).toLocaleString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                ({pickup === "shop" ? "Shop Visit" : "Home Service"})
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="flex-1 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 transition-opacity"
            >
              Track this booking
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/vehicles')}
              className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors"
            >
              Back to My Vehicles
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Book a service</h1>
        <p className="text-sm text-muted-foreground">
          Register a vehicle or pick an existing one to schedule your visit.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left Column: Booking Summary */}
        <aside className="order-2 lg:order-1 space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand" />
              <h3 className="font-semibold">Booking summary</h3>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <BookSumRow label="Vehicle" value={displayVehicle} />

              {activePackage && (
                <BookSumRow
                  label="Package"
                  value={buildCategoryLabel({
                    packageName: activePackage.name,
                    packageServiceNames: options?.services
                      .filter((s) => activePackage.serviceIds.includes(s.id))
                      .map((s) => s.name) ?? [],
                    selectedNames: selectedServices.map((s) => s.name),
                    notSure: false,
                  })}
                />
              )}

              {/* Grouped Services */}
              {tickedMaintenance.length > 0 && (
                <div className="space-y-1.5 border-b pb-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Maintenance
                  </p>
                  {tickedMaintenance.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                          <span className="text-[11px] text-muted-foreground">{s.baseDurationHours} h</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tickedRepair.length > 0 && (
                <div className="space-y-1.5 border-b pb-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Repair
                  </p>
                  {tickedRepair.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                          <span className="text-[11px] text-muted-foreground">{s.baseDurationHours} h</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(tickedDiagnostics.length > 0 || notSure) && (
                <div className="space-y-1.5 border-b pb-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Diagnostics
                  </p>
                  {tickedDiagnostics.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{s.name}</span>
                      <div className="flex items-center gap-1.5">
                        {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                          <span className="text-[11px] text-muted-foreground">{s.baseDurationHours} h</span>
                        )}
                        <button
                          type="button"
                          onClick={() => toggleService(s.id)}
                          className="text-muted-foreground hover:text-foreground p-0.5"
                          aria-label={`Remove ${s.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {notSure && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">Check my car</span>
                      <button
                        type="button"
                        onClick={() => setNotSure(false)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        aria-label="Remove Check my car"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {totalHoursEstimate && (
                <p className="text-xs font-semibold text-brand">{totalHoursEstimate}</p>
              )}

              {preferredDate && preferredTime && (
                <BookSumRow
                  label="Date & Time"
                  value={new Date(toManilaIso(toDateValue(preferredDate), preferredTime)).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                />
              )}

              <BookSumRow
                label="Service option"
                value={pickup === "shop" ? "Shop Visit" : "Home Service"}
              />

              <div className="border-t pt-2 text-[11px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{userFullName}</p>
                <p>{userContact}</p>
                <p>{userEmail}</p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? "Confirming..." : "Confirm booking"}
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: The Form */}
        <div className="order-1 lg:order-2 space-y-5 min-w-0">
          {/* 1. Vehicle */}
          <BookModalCard icon={Car} title="Vehicle" subtitle="Select an existing vehicle or register a new one.">
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
                <option value="" disabled>Select a vehicle...</option>
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

          {/* 2. What do you need? */}
          <BookModalCard
            icon={ClipboardCheck}
            title="What do you need?"
            subtitle="Pick what applies. The shop confirms the final list and time."
          >
            {fieldErrors.service && (
              <p className="mb-4 text-xs font-medium text-rose-500">{fieldErrors.service}</p>
            )}

            {/* Three cards with tick boxes */}
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setNeedMaintenance((p) => !p);
                  if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 text-left transition",
                  needMaintenance ? "border-brand bg-brand-soft/40" : "hover:bg-accent border-border"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    needMaintenance ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground"
                  )}
                >
                  {needMaintenance && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <div>
                  <p className="font-semibold text-sm text-foreground">Regular maintenance</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Nothing is broken. It is time for service.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNeedRepair((p) => !p);
                  if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 text-left transition",
                  needRepair ? "border-brand bg-brand-soft/40" : "hover:bg-accent border-border"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    needRepair ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground"
                  )}
                >
                  {needRepair && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <div>
                  <p className="font-semibold text-sm text-foreground">Something is wrong</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">A noise, leak, warning light or worn part.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setNotSure((p) => !p);
                  if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3.5 text-left transition",
                  notSure ? "border-brand bg-brand-soft/40" : "hover:bg-accent border-border"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
                    notSure ? "border-brand bg-brand text-brand-foreground" : "border-muted-foreground"
                  )}
                >
                  {notSure && <Check className="h-3 w-3 stroke-[3]" />}
                </span>
                <div>
                  <p className="font-semibold text-sm text-foreground">Not sure</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">We will check your car and tell you what it needs.</p>
                </div>
              </button>
            </div>

            {!options && !optionsError && (
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading services...</span>
              </div>
            )}

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

            {/* Stacked sections in order: maintenance, repair, not sure */}
            {options && needMaintenance && (
              <div className="mt-5 space-y-5 rounded-xl border border-border/70 bg-muted/10 p-4">
                {options.packages.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold">Maintenance packages</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Choose one. It ticks its services below, and you can untick what you do not need.
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      {options.packages.map((pkg) => {
                        const isChosen = packageId === pkg.id;
                        const intervalParts: string[] = [];
                        if (pkg.intervalKm) intervalParts.push(`${pkg.intervalKm.toLocaleString("en-PH")} km`);
                        if (pkg.intervalMonths) intervalParts.push(`${pkg.intervalMonths} months`);
                        const intervalText = intervalParts.length > 0 ? `Every ${intervalParts.join(" or ")}` : null;

                        const pkgServices = options.services.filter((s) => pkg.serviceIds.includes(s.id));
                        const allKnown = pkgServices.every((s) => s.baseDurationHours != null && s.baseDurationHours > 0);
                        const totalPkgHours = pkgServices.reduce((sum, s) => sum + (s.baseDurationHours || 0), 0);
                        const durationText = allKnown
                          ? `${pkg.serviceIds.length} services, about ${formatHours(totalPkgHours)} hours`
                          : `${pkg.serviceIds.length} services`;

                        return (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => togglePackage(pkg)}
                            className={cn(
                              "flex flex-col justify-between rounded-lg border p-3.5 text-left transition",
                              isChosen
                                ? "border-brand bg-brand-soft/40 ring-1 ring-brand"
                                : "border-border hover:bg-accent"
                            )}
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2">
                                <h5 className="font-semibold text-sm text-foreground">{pkg.name}</h5>
                                <span
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                    isChosen ? "border-brand" : "border-muted-foreground"
                                  )}
                                >
                                  {isChosen && <span className="h-2 w-2 rounded-full bg-brand" />}
                                </span>
                              </div>
                              {pkg.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                  {pkg.description}
                                </p>
                              )}
                            </div>
                            <div className="mt-3 text-[11px] text-muted-foreground space-y-0.5">
                              {intervalText && <p>{intervalText}</p>}
                              <p>{durationText}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h4 className="text-sm font-semibold">Maintenance services</h4>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search services"
                        value={maintenanceSearch}
                        onChange={(e) => setMaintenanceSearch(e.target.value)}
                        className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-brand focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-2.5 divide-y rounded-md border bg-background">
                    {maintenanceServices
                      .filter((s) => s.name.toLowerCase().includes(maintenanceSearch.trim().toLowerCase()))
                      .map((s) => {
                        const checked = selectedIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className={cn(
                              "flex cursor-pointer items-start justify-between gap-3 p-3 transition hover:bg-muted/30",
                              checked && "bg-brand-soft/20"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleService(s.id)}
                                className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                              />
                              <div>
                                <span className="text-sm font-medium leading-snug">{s.name}</span>
                                {s.description && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                                )}
                              </div>
                            </div>
                            {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                              <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                                {formatHours(s.baseDurationHours)} h
                              </span>
                            )}
                          </label>
                        );
                      })}
                    {maintenanceServices.filter((s) =>
                      s.name.toLowerCase().includes(maintenanceSearch.trim().toLowerCase())
                    ).length === 0 && (
                      <p className="p-4 text-center text-xs text-muted-foreground">
                        No services match your search.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {options && needRepair && (
              <div className="mt-5 space-y-4 rounded-xl border border-border/70 bg-muted/10 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h4 className="text-sm font-semibold">Repair services</h4>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search services"
                      value={repairSearch}
                      onChange={(e) => setRepairSearch(e.target.value)}
                      className="w-full rounded-md border bg-background py-1.5 pl-8 pr-3 text-xs focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>

                <div className="divide-y rounded-md border bg-background">
                  {repairServices
                    .filter((s) => s.name.toLowerCase().includes(repairSearch.trim().toLowerCase()))
                    .map((s) => {
                      const checked = selectedIds.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={cn(
                            "flex cursor-pointer items-start justify-between gap-3 p-3 transition hover:bg-muted/30",
                            checked && "bg-brand-soft/20"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleService(s.id)}
                              className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                            />
                            <div>
                              <span className="text-sm font-medium leading-snug">{s.name}</span>
                              {s.description && (
                                <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                              )}
                            </div>
                          </div>
                          {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                            <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                              {formatHours(s.baseDurationHours)} h
                            </span>
                          )}
                        </label>
                      );
                    })}
                </div>

                {/* Subheading: Check-ups and diagnostics */}
                {diagnosticServices.length > 0 && (
                  <div className="pt-2">
                    <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Check-ups and diagnostics
                    </h5>
                    <div className="divide-y rounded-md border bg-background">
                      {diagnosticServices
                        .filter((s) => s.name.toLowerCase().includes(repairSearch.trim().toLowerCase()))
                        .map((s) => {
                          const checked = selectedIds.includes(s.id);
                          return (
                            <label
                              key={s.id}
                              className={cn(
                                "flex cursor-pointer items-start justify-between gap-3 p-3 transition hover:bg-muted/30",
                                checked && "bg-brand-soft/20"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleService(s.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-input accent-brand"
                                />
                                <div>
                                  <span className="text-sm font-medium leading-snug">{s.name}</span>
                                  {s.description && (
                                    <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
                                  )}
                                </div>
                              </div>
                              {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                                <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                                  {formatHours(s.baseDurationHours)} h
                                </span>
                              )}
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Not in the list? Describe it in the notes below.
                </p>
              </div>
            )}

            {notSure && (
              <p className="mt-4 rounded-md border bg-muted/20 p-3.5 text-xs text-muted-foreground">
                Tell us what you notice in the notes below. We will inspect the car and tell you what it needs.
              </p>
            )}

            {/* Scan fee box if needed */}
            {needsScan && (
              <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4">
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

            {/* Estimated time bottom line */}
            {selectedServices.length > 0 && knownHours > 0 && (
              <p className="mt-4 text-xs text-muted-foreground border-t pt-3">
                Estimated time: {hasUnknownHour ? `at least ${formatHours(knownHours)} hours` : `about ${formatHours(knownHours)} hours`}. It is an estimate, and the shop confirms it.
              </p>
            )}
          </BookModalCard>

          {/* 3. Date and place */}
          <BookModalCard icon={Wrench} title="Date and place" subtitle="Choose your service option and schedule.">
            <label className="text-sm font-medium">Type of service</label>
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
              <TimeslotPicker
                date={preferredDate}
                time={preferredTime}
                onChangeDate={setPreferredDate}
                onChangeTime={setPreferredTime}
                onAvailableSlots={setAvailableSlots}
              />
            </div>

            {/* Overnight Notice */}
            {noticeShowing && (
              <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                  <div className="flex-1 space-y-2.5">
                    {takesMoreThanOneDay ? (
                      <p className="text-sm font-medium">This job takes more than one day.</p>
                    ) : (
                      <p className="text-sm">
                        <span className="font-semibold">
                          {activePackage ? activePackage.name : "Your selected services"}
                        </span>{" "}
                        takes about {formatHours(knownHours)} hours. Starting at {preferredTime} it may finish around{" "}
                        {formatDecimalTime(finishHour)}, after we close at {formatDecimalTime(shopDayHours!.close)}.
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 pt-1">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                        <input
                          type="checkbox"
                          checked={overnightOk}
                          onChange={(e) => {
                            setOvernightOk(e.target.checked);
                            if (fieldErrors.overnight) setFieldErrors((p) => ({ ...p, overnight: "" }));
                          }}
                          className="h-4 w-4 rounded border-amber-400 accent-amber-600"
                        />
                        <span>It is OK to leave my vehicle overnight</span>
                      </label>

                      {!takesMoreThanOneDay && recommendedSlot && (
                        <button
                          type="button"
                          onClick={() => setPreferredTime(recommendedSlot)}
                          className="rounded-md border border-amber-400 bg-amber-100/60 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                        >
                          Use {recommendedSlot}
                        </button>
                      )}
                    </div>

                    {fieldErrors.overnight && (
                      <p className="text-xs font-medium text-rose-600 pt-1">{fieldErrors.overnight}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </BookModalCard>

          {/* 4. Notes */}
          <BookModalCard icon={ClipboardCheck} title="Notes for the shop" subtitle="Add any specific details or symptoms.">
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
            <div className="mt-1 flex justify-end text-[10px] text-muted-foreground">
              {notes.length}/500
            </div>
          </BookModalCard>
        </div>
      </div>

      {inServicePlate && (
        <VehicleInServiceModal plate={inServicePlate} onClose={() => setInServicePlate(null)} />
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
    <div className="rounded-xl border bg-card p-5 shadow-sm">
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
      type="button"
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
    <div className="flex items-center justify-between border-b pb-2 last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[65%] line-clamp-2">{value || "—"}</span>
    </div>
  );
}
