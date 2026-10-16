'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Wrench,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
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
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { VehicleInServiceModal } from "@/components/dashboard/VehicleInServiceModal";
import { bookingNeedsScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import { formatStamp, cn } from "@/lib/utils";
import { normalizePlateNumber, isValidPlateNumber, PLATE_FORMAT_ERROR_MESSAGE } from "@/lib/plate";
import { VisitDatePicker } from "@/components/VisitDatePicker";
import { toManilaIso, formatVisitWindow } from "@/lib/bookingSlotsShared";
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

// A total in words, never with decimals: 5.5 -> "5 hours and 30 minutes", 1 -> "1 hour", 0.75 -> "45 minutes".
function formatHoursLong(h: number): string {
  const totalMinutes = Math.round(h * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const parts: string[] = []
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`)
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  return parts.length > 0 ? parts.join(' and ') : '0 minutes'
}

// One service's time, exact: "45 min", "1 h", "3 h 45 min". (One decimal of an hour
// would show 0.75 h as "0.8 h".)
function formatDuration(h: number): string {
  const totalMinutes = Math.round(h * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes} min`
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`
}

// Many services carry a placeholder description that only repeats the name
// ("Standard automotive service: Change Oil"). Show a description only when it adds something.
function usefulDescription(name: string, description: string | null): string | null {
  const text = (description ?? '').trim()
  if (!text) return null
  const lower = text.toLowerCase()
  if (lower === name.trim().toLowerCase() || lower.startsWith('standard automotive service')) return null
  return text
}

// A long list shows this many first; the rest is behind "Show all".
const SERVICES_SHOWN_FIRST = 8

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

export function BookingPage({
  initialVehicleId,
  mode = 'page',
  onClose,
  onBooked,
  onDirtyChange,
}: {
  initialVehicleId?: string
  mode?: 'page' | 'modal'
  onClose?: () => void
  onBooked?: () => void
  onDirtyChange?: (dirty: boolean) => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // "Are you sure?" step before the booking is really sent.
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [pickup, setPickup] = useState<"shop" | "home">("shop");
  const [preferredDate, setPreferredDate] = useState<Date>(startOfToday());
  const [preferredTime, setPreferredTime] = useState<string>("");
  const [dateChosen, setDateChosen] = useState(false);
  const [homeAddress, setHomeAddress] = useState("");

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById("booking-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [step]);

  const [options, setOptions] = useState<{ services: ServiceOption[]; packages: PackageOption[] } | null>(null);
  const [shopHours, setShopHours] = useState<ShopHours>(null);
  const [optionsError, setOptionsError] = useState(false);

  // Section 2: Category panels
  const [openCategory, setOpenCategory] = useState<"maintenance" | "repair" | "diagnostics" | null>(null);
  const [notSure, setNotSure] = useState(false);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [packageId, setPackageId] = useState<number | null>(null);
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [repairSearch, setRepairSearch] = useState('');

  const [notes, setNotes] = useState("");
  const [overnightOk, setOvernightOk] = useState(false);

  const handleOpenCategory = (cat: "maintenance" | "repair" | "diagnostics" | null) => {
    if (cat !== null) {
      setMaintenanceSearch("");
      setRepairSearch("");
    }
    setOpenCategory(cat);
  };

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
              // The wizard still starts at step 1 so the customer sees the service type choice.
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

  const packageIds = new Set(activePackage ? activePackage.serviceIds : []);
  const packageTicked = selectedServices.filter((s) => packageIds.has(s.id));
  const otherMaintenance = selectedServices.filter((s) => !packageIds.has(s.id) && s.type === "maintenance");
  const otherRepair = selectedServices.filter((s) => !packageIds.has(s.id) && s.type === "repair");
  const otherDiagnostics = selectedServices.filter((s) => !packageIds.has(s.id) && s.type === "diagnostics");

  const needsScan = bookingNeedsScan(notSure, selectedServices.map((s) => s.name));

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

  const timeChosen = preferredTime !== "";

  const noticeShowing =
    dateChosen &&
    timeChosen &&
    shopDayHours !== null &&
    knownHours > 0 &&
    !Number.isNaN(startHour) &&
    finishHour > shopDayHours.close;

  const takesMoreThanOneDay =
    shopDayHours !== null &&
    knownHours > 0 &&
    durationWithMargin > (shopDayHours.close - shopDayHours.open);


  // What the summary says under "Possible completion time based on your services".
  const completionText: string | null = (() => {
    if (!dateChosen || !timeChosen) return null;
    if (knownHours <= 0) return 'The shop will tell you after checking your car.';
    if (!shopDayHours || Number.isNaN(startHour)) return null;
    const dayText = preferredDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    if (finishHour > shopDayHours.close) {
      return pickup === "home"
        ? 'Est. after our closing time, or the next working day (our mechanic continues at your place).'
        : 'Est. the next working day or later (your vehicle stays overnight).';
    }
    return `Est. ${dayText}, ${formatDecimalTime(finishHour)}${hasUnknownHour ? ' or later' : ''}`;
  })();

  useEffect(() => {
    if (!noticeShowing || pickup === "home") {
      setOvernightOk(false);
      if (fieldErrors.overnight) setFieldErrors((p) => ({ ...p, overnight: "" }));
    }
  }, [noticeShowing, pickup]);

  // Step progress completion
  const vehicleOk =
    (selectedVehicleId !== "" && selectedVehicleId !== "new") ||
    (selectedVehicleId === "new" && vehicleModel.trim() !== "" && isValidPlateNumber(normalizePlateNumber(vehiclePlate)));

  const servicesOk = notSure || selectedIds.length > 0 || notes.trim().length >= 5;

  // Step 1 also holds the service type: a home service needs an address before moving on.
  const placeOk = pickup !== "home" || Boolean(user?.address) || homeAddress.trim() !== "";

  // A home service needs no overnight agreement: the mechanic goes to the customer.
  const dateOk =
    dateChosen &&
    timeChosen &&
    Boolean(preferredDate && preferredTime) &&
    (!noticeShowing || pickup === "home" || overnightOk);

  useEffect(() => {
    if (!onDirtyChange) return
    const dirty =
      !isBooked &&
      (selectedIds.length > 0 || notSure || notes.trim() !== "" || dateChosen || homeAddress.trim() !== "")
    onDirtyChange(dirty)
  }, [onDirtyChange, isBooked, selectedIds, notSure, notes, dateChosen, homeAddress])

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
    const next = selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id];
    setSelectedIds(next);
    // Unticking the last service of the chosen package turns the package off, so its card
    // does not stay "chosen" with every box empty.
    const chosen = options?.packages.find((p) => p.id === packageId);
    if (chosen && !chosen.serviceIds.some((serviceId) => next.includes(serviceId))) {
      setPackageId(null);
    }
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
        : "Add at least one service, or describe the problem in the notes.";
    }

    if (pickup === "home" && !user?.address && !homeAddress.trim()) {
      errs.homeAddress = "Home address is required.";
    }

    // Only a shop visit needs the overnight agreement. A home service has none.
    if (pickup === "shop" && noticeShowing && !overnightOk) {
      errs.overnight = "Choose an earlier time or allow an overnight stay.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      toast.error("Please check the form for errors.");

      if (errs.selectedVehicleId || errs.vehicleModel || errs.vehiclePlate || errs.vehicleMake || errs.vehicleMileage || errs.homeAddress) {
        setStep(0);
      } else if (errs.service) {
        setStep(1);
      } else if (errs.overnight) {
        setStep(2);
      }
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
      diagnosticScanAuthorized: needsScan,
      preferredDatetime: preferredDate && preferredTime ? toManilaIso(toDateValue(preferredDate), preferredTime) : null,
      overnightOk: pickup === "shop" && overnightOk && noticeShowing,
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
        document.getElementById("booking-top")?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  // Choosing "I am not sure" is the customer's agreement: the notice sits right under the choice, and the
  // server still receives diagnosticScanAuthorized = true, which is what attaches the fee on approval.
  const scanNotice = (
    <p className="text-xs leading-relaxed text-muted-foreground">
      To find the problem, we will plug an OBD-II scanner into your car. By choosing this, you agree to pay the scan
      fee of <b className="text-foreground">{formatPeso(DIAGNOSTIC_SCAN_FEE)}</b>,{" "}
      <b className="text-foreground">even if you decide not to push through with the repair</b>. Repairs are priced
      separately, and we&apos;ll ask you first.
    </p>
  );

  // Only for the rare case a scan fee is needed without "I am not sure" (a service that needs the scan).
  const scanFeeBox = needsScan && !notSure ? (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">{scanNotice}</div>
  ) : null;

  // "I am not sure what is wrong" and its OBD-II notice are one card: the notice opens inside it once ticked.
  const notSureCard = (
    <div
      className={cn(
        "rounded-lg border p-3.5 transition",
        notSure ? "border-brand bg-brand-soft/40" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={() => {
          setNotSure((p) => !p);
          if (fieldErrors.service) setFieldErrors((p) => ({ ...p, service: "" }));
        }}
        className="flex w-full items-start gap-3 text-left cursor-pointer"
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
          <p className="font-semibold text-sm text-foreground">I am not sure what is wrong</p>
          <p className="mt-0.5 text-xs text-muted-foreground">We will check your car and tell you what it needs.</p>
        </div>
      </button>
      <div className="mt-3 pl-7">{scanNotice}</div>
    </div>
  );

  const totalHoursEstimate =
    selectedServices.length > 0 && knownHours > 0
      ? hasUnknownHour
        ? `Est. work time: at least ${formatHoursLong(knownHours)}`
        : `Est. work time: about ${formatHoursLong(knownHours)}`
      : null;

  // Counts & hours for "What has been added"
  const maintCount = packageTicked.length + otherMaintenance.length;
  const maintAll = [...packageTicked, ...otherMaintenance];
  const maintAllKnown = maintAll.length > 0 && maintAll.every((s) => s.baseDurationHours != null && s.baseDurationHours > 0);
  const maintHours = maintAllKnown ? maintAll.reduce((sum, s) => sum + (s.baseDurationHours || 0), 0) : 0;
  const maintText = `${activePackage ? `${activePackage.name}, ` : ""}${maintCount === 1 ? "1 item" : `${maintCount} items`}${maintHours > 0 ? `, about ${formatDuration(maintHours)}` : ""}`;

  const repairCount = otherRepair.length;
  const repairAllKnown = repairCount > 0 && otherRepair.every((s) => s.baseDurationHours != null && s.baseDurationHours > 0);
  const repairHours = repairAllKnown ? otherRepair.reduce((sum, s) => sum + (s.baseDurationHours || 0), 0) : 0;
  const repairText = `${repairCount === 1 ? "1 item" : `${repairCount} items`}${repairHours > 0 ? `, about ${formatDuration(repairHours)}` : ""}`;

  const diagCount = otherDiagnostics.length + (notSure ? 1 : 0);
  const diagAllKnown = !notSure && otherDiagnostics.length > 0 && otherDiagnostics.every((s) => s.baseDurationHours != null && s.baseDurationHours > 0);
  const diagHours = diagAllKnown ? otherDiagnostics.reduce((sum, s) => sum + (s.baseDurationHours || 0), 0) : 0;
  const diagText = `${diagCount === 1 ? "1 item" : `${diagCount} items`}${diagHours > 0 ? `, about ${formatDuration(diagHours)}` : ""}`;

  const hasAnyAdded = maintCount > 0 || repairCount > 0 || diagCount > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-32 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading booking form...
      </div>
    );
  }

  if (isBooked) {
    return (
      <div id="booking-top" className="mx-auto max-w-xl px-6 py-12">
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
              <div className="mt-2 space-y-2">
                {packageTicked.length > 0 && activePackage && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground">{activePackage.name}</p>
                    {packageTicked.map((s) => (
                      <p key={s.id} className="text-xs text-foreground">• {s.name}</p>
                    ))}
                  </div>
                )}
                {otherMaintenance.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground">{activePackage ? "Other Maintenance" : "Maintenance"}</p>
                    {otherMaintenance.map((s) => (
                      <p key={s.id} className="text-xs text-foreground">• {s.name}</p>
                    ))}
                  </div>
                )}
                {otherRepair.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground">Repair</p>
                    {otherRepair.map((s) => (
                      <p key={s.id} className="text-xs text-foreground">• {s.name}</p>
                    ))}
                  </div>
                )}
                {(otherDiagnostics.length > 0 || notSure) && (
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground">Diagnostics</p>
                    {otherDiagnostics.map((s) => (
                      <p key={s.id} className="text-xs text-foreground">• {s.name}</p>
                    ))}
                    {notSure && <p className="text-xs text-foreground">• Check my car</p>}
                  </div>
                )}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                {pickup === "home"
                  ? "Your visit date (our mechanic comes to your place):"
                  : "Your visit date (you drop off your vehicle):"}
              </span>
              <p className="text-xs text-foreground">
                {formatVisitWindow(toManilaIso(toDateValue(preferredDate), preferredTime))}{" "}
                ({pickup === "shop" ? "Shop Visit" : "Home Service"})
              </p>
            </div>
            {(selectedServices.length > 0 || notSure) && (
              <div>
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Possible completion time based on your services:
                </span>
                <p className="text-xs text-foreground">
                  {completionText ?? "Pick your visit date and time to see this"}
                </p>
                <EstimateWarning />

              </div>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                if (mode === 'modal') {
                  onBooked?.();
                  onClose?.();
                  router.push('/dashboard');
                } else {
                  router.push('/dashboard');
                }
              }}
              className="flex-1 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 transition-opacity cursor-pointer"
            >
              Track this booking
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode === 'modal') {
                  onBooked?.();
                  onClose?.();
                } else {
                  router.push('/dashboard/vehicles');
                }
              }}
              className="flex-1 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent transition-colors cursor-pointer"
            >
              {mode === 'modal' ? 'Close' : 'Back to My Vehicles'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="booking-top"
      className={mode === 'modal' ? 'mx-auto max-w-[88rem] px-4 py-6 sm:px-6' : 'mx-auto max-w-[88rem] px-6 py-8'}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Book a service</h1>
        <p className="text-sm text-muted-foreground">
          Register a vehicle or pick an existing one to schedule your concern.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[440px_minmax(0,1fr)]">
        {/* Left Column: Booking Summary */}
        <aside
          className={cn(
            "order-2 lg:order-1 space-y-4 lg:sticky lg:self-start",
            mode === 'modal' ? "lg:top-4" : "lg:top-24"
          )}
        >
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand" />
              <h3 className="font-semibold">Booking summary</h3>
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <BookSumRow label="Vehicle" value={displayVehicle} />

              {/* When and where comes first, so the customer sees it without scrolling past the services. */}
              <BookSumRow
                label="Service option"
                value={pickup === "shop" ? "Shop Visit" : "Home Service"}
              />

              <BookSumRow
                stacked
                label={pickup === "home"
                  ? "Your visit date (our mechanic comes to your place):"
                  : "Your visit date (you drop off your vehicle):"}
                value={
                  !dateChosen
                    ? "Not picked yet"
                    : timeChosen
                    ? formatVisitWindow(toManilaIso(toDateValue(preferredDate), preferredTime)) ?? "—"
                    : preferredDate.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })
                }
              />
              {/* Grouped Services */}
              {packageTicked.length > 0 && activePackage && (
                <SummaryGroup title={activePackage.name}>
                  {packageTicked.map((s) => (
                    <SummaryServiceRow
                      key={s.id}
                      name={s.name}
                      hours={s.baseDurationHours}
                      onRemove={() => toggleService(s.id)}
                    />
                  ))}
                </SummaryGroup>
              )}

              {otherMaintenance.length > 0 && (
                <SummaryGroup title={activePackage ? "Other Maintenance" : "Maintenance"}>
                  {otherMaintenance.map((s) => (
                    <SummaryServiceRow
                      key={s.id}
                      name={s.name}
                      hours={s.baseDurationHours}
                      onRemove={() => toggleService(s.id)}
                    />
                  ))}
                </SummaryGroup>
              )}

              {otherRepair.length > 0 && (
                <SummaryGroup title="Repair">
                  {otherRepair.map((s) => (
                    <SummaryServiceRow
                      key={s.id}
                      name={s.name}
                      hours={s.baseDurationHours}
                      onRemove={() => toggleService(s.id)}
                    />
                  ))}
                </SummaryGroup>
              )}

              {(otherDiagnostics.length > 0 || notSure) && (
                <SummaryGroup title="Diagnostics">
                  {otherDiagnostics.map((s) => (
                    <SummaryServiceRow
                      key={s.id}
                      name={s.name}
                      hours={s.baseDurationHours}
                      onRemove={() => toggleService(s.id)}
                    />
                  ))}
                  {notSure && (
                    <SummaryServiceRow
                      name="Check my car"
                      hours={null}
                      onRemove={() => setNotSure(false)}
                    />
                  )}
                </SummaryGroup>
              )}

              {/* Work time, the completion estimate, then the warning, right under the services they describe. */}
              {(totalHoursEstimate || selectedServices.length > 0 || notSure) && (
                <div className="space-y-2">
                  {totalHoursEstimate && <p className="text-xs font-semibold text-brand">{totalHoursEstimate}</p>}
                  {(selectedServices.length > 0 || notSure) && (
                    <BookSumRow
                      stacked
                      label="Possible completion time based on your services:"
                      value={completionText ?? "Pick a visit date and time to see the estimate."}
                    />
                  )}
                  {totalHoursEstimate && <EstimateWarning />}
                </div>
              )}

              <div className="border-t pt-2 text-[11px] text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{userFullName}</p>
                <p>{userContact}</p>
                <p>{userEmail}</p>
              </div>

              {/* The customer's own words, last, so the shop's reading order matches the booking. */}
              <div className="border-t pt-2">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">Notes for the shop</span>
                {notes.trim() ? (
                  <p className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words text-xs text-foreground">
                    {notes.trim()}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No notes added.</p>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Right Column: The Form */}
        <div className="order-1 lg:order-2 space-y-5 min-w-0">
          {/* 1. Pick a vehicle */}
          {step === 0 && (
            <BookModalCard icon={Car} title="1. Pick a vehicle" subtitle="Select an existing vehicle or register a new one.">
              {/* The service type comes first: everything after it follows this choice. */}
              <div className="mb-5 border-b pb-5">
                <label className="text-sm font-medium">Where should we serve your vehicle?</label>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <BookRadioTile icon={MapPin} label="Shop Visit" active={pickup === "shop"} onClick={() => setPickup("shop")} />
                  <BookRadioTile icon={Car} label="Home Service" active={pickup === "home"} onClick={() => setPickup("home")} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {pickup === "home" ? "Our mechanic comes to your address." : "You bring your vehicle to our shop."}
                </p>

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
              </div>

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
          )}

          {/* 2. Pick services */}
          {step === 1 && (
            <BookModalCard
              icon={ClipboardCheck}
              title="2. Pick services"
              subtitle="Add one kind of service at a time. The shop confirms the final list and time."
            >
              {fieldErrors.service && (
                <p className="mb-4 text-xs font-medium text-rose-500">{fieldErrors.service}</p>
              )}

              {!options && !optionsError && (
                <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Loading services...</span>
                </div>
              )}

              {optionsError && (
                <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-950 dark:bg-rose-950/20 dark:text-rose-200">
                  <div className="flex items-center justify-between">
                    <span>We couldn&apos;t load the service list.</span>
                    <button
                      type="button"
                      onClick={loadOptions}
                      className="inline-flex items-center gap-1 font-semibold text-brand hover:underline cursor-pointer"
                    >
                      <RefreshCw className="h-3 w-3" /> Try again
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    You can also describe what you need in the notes box.
                  </p>
                </div>
              )}

              {/* What has been added */}
              <div className="space-y-2">
                {!hasAnyAdded ? (
                  <p className="text-xs text-muted-foreground">Nothing added yet.</p>
                ) : (
                  <>
                    {maintCount > 0 && (
                      <div className="flex items-center justify-between rounded-lg border bg-card px-3.5 py-2.5">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-foreground">Maintenance</p>
                          <p className="text-xs text-muted-foreground break-words">{maintText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenCategory("maintenance")}
                          className="shrink-0 rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                    {repairCount > 0 && (
                      <div className="flex items-center justify-between rounded-lg border bg-card px-3.5 py-2.5">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-foreground">Repair</p>
                          <p className="text-xs text-muted-foreground break-words">{repairText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenCategory("repair")}
                          className="shrink-0 rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                    {diagCount > 0 && (
                      <div className="flex items-center justify-between rounded-lg border bg-card px-3.5 py-2.5">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-semibold text-foreground">Diagnostics</p>
                          <p className="text-xs text-muted-foreground break-words">{diagText}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenCategory("diagnostics")}
                          className="shrink-0 rounded border border-input bg-background px-2.5 py-1 text-xs font-semibold hover:bg-accent cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Scan fee agreement when the Diagnostics panel is closed */}
              {openCategory !== "diagnostics" && notSure && <div className="mt-4">{notSureCard}</div>}
              {openCategory !== "diagnostics" && scanFeeBox && <div className="mt-4">{scanFeeBox}</div>}

              {/* When no category is open */}
              {openCategory === null ? (
                <div className="mt-5 space-y-3 pt-3 border-t">
                  <p className="text-xs font-medium text-foreground">
                    {!hasAnyAdded ? "What would you like to add?" : "Anything else?"}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleOpenCategory("maintenance")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold hover:bg-accent cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Maintenance
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCategory("repair")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold hover:bg-accent cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Repair
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenCategory("diagnostics")}
                      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold hover:bg-accent cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Diagnostics
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Maintenance: time for service. Repair: something is wrong. Diagnostics: find out what is wrong.
                  </p>
                </div>
              ) : (
                /* When a category is open */
                <div className="mt-5 rounded-xl border-2 border-brand p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <h4 className="font-semibold text-base capitalize">{openCategory}</h4>
                  </div>

                  {/* Maintenance Panel */}
                  {openCategory === "maintenance" && options && (
                    <div className="space-y-5">
                      <p className="text-xs text-muted-foreground">
                        Choose a package if you like. Untick anything you do not need.
                      </p>

                      {options.packages.length > 0 && (
                        <div className="grid gap-3 sm:grid-cols-3">
                          {options.packages.map((pkg) => {
                            const isChosen = packageId === pkg.id;
                            const intervalParts: string[] = [];
                            if (pkg.intervalKm) intervalParts.push(`${pkg.intervalKm.toLocaleString("en-PH")} km`);
                            if (pkg.intervalMonths) intervalParts.push(`${pkg.intervalMonths} months`);
                            const intervalText = intervalParts.length > 0 ? `Every ${intervalParts.join(" or ")}` : null;

                            const pkgServices = pkg.serviceIds
                              .map((id) => options.services.find((s) => s.id === id))
                              .filter((s): s is ServiceOption => Boolean(s));
                            const allKnown = pkgServices.length > 0 && pkgServices.every((s) => s.baseDurationHours != null && s.baseDurationHours > 0);
                            const totalPkgHours = pkgServices.reduce((sum, s) => sum + (s.baseDurationHours || 0), 0);
                            const durationText = allKnown
                              ? `${pkg.serviceIds.length} services, about ${formatHoursLong(totalPkgHours)}`
                              : `${pkg.serviceIds.length} services`;

                            return (
                              <div
                                key={pkg.id}
                                className={cn(
                                  "flex flex-col justify-between rounded-lg border p-3.5 transition",
                                  isChosen
                                    ? "border-brand bg-brand-soft/40 ring-1 ring-brand"
                                    : "border-border hover:bg-accent/40"
                                )}
                              >
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => togglePackage(pkg)}
                                    className="flex w-full items-start justify-between gap-2 text-left cursor-pointer"
                                  >
                                    <h5 className="font-semibold text-sm text-foreground">{pkg.name}</h5>
                                    <span
                                      className={cn(
                                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                                        isChosen ? "border-brand" : "border-muted-foreground"
                                      )}
                                    >
                                      {isChosen && <span className="h-2 w-2 rounded-full bg-brand" />}
                                    </span>
                                  </button>
                                  {pkg.description && (
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                      {pkg.description}
                                    </p>
                                  )}
                                  <div className="mt-2 text-[11px] text-muted-foreground space-y-0.5">
                                    {intervalText && <p>{intervalText}</p>}
                                    <p>{durationText}</p>
                                  </div>
                                </div>

                                <div className="mt-3 border-t pt-2.5 space-y-1">
                                  {pkgServices.map((s) => {
                                    if (isChosen) {
                                      const isChecked = selectedIds.includes(s.id);
                                      return (
                                        <label
                                          key={s.id}
                                          className="flex items-start gap-2 cursor-pointer text-xs py-0.5 text-foreground hover:text-brand"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={() => toggleService(s.id)}
                                            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input accent-brand"
                                          />
                                          {/* Long names wrap; the customer asked to see what is in each package. */}
                                          <span className="min-w-0 break-words leading-snug">{s.name}</span>
                                        </label>
                                      );
                                    }
                                    return (
                                      <p key={s.id} className="break-words py-0.5 text-[11px] leading-snug text-muted-foreground">
                                        • {s.name}
                                      </p>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div className="space-y-3 pt-2">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <h4 className="text-sm font-semibold">
                            {activePackage ? "Add other maintenance services" : "Or pick services one by one"}
                            {otherMaintenance.length > 0 && (
                              <span className="ml-2 text-xs font-normal text-muted-foreground">{otherMaintenance.length} selected</span>
                            )}
                          </h4>
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

                        <ServiceChecklist
                          services={options.services.filter((s) => s.type === "maintenance" && !packageIds.has(s.id))}
                          search={maintenanceSearch}
                          selectedIds={selectedIds}
                          onToggle={toggleService}
                        />
                      </div>
                    </div>
                  )}

                  {/* Repair Panel */}
                  {openCategory === "repair" && options && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-sm font-semibold">
                          Repair services
                          {otherRepair.length > 0 && (
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{otherRepair.length} selected</span>
                          )}
                        </h4>
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

                      <ServiceChecklist
                        services={options.services.filter((s) => s.type === "repair")}
                        search={repairSearch}
                        selectedIds={selectedIds}
                        onToggle={toggleService}
                      />

                      <p className="text-xs text-muted-foreground">
                        Not in the list? Describe it in the notes below.
                      </p>
                    </div>
                  )}

                  {/* Diagnostics Panel */}
                  {openCategory === "diagnostics" && options && (
                    <div className="space-y-4">
                      {notSureCard}
                    </div>
                  )}

                  <div className="flex justify-end pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => handleOpenCategory(null)}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:opacity-90 cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Estimated time bottom line */}
              {selectedServices.length > 0 && knownHours > 0 && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs font-medium text-foreground">
                    Estimated time: {hasUnknownHour ? `at least ${formatHoursLong(knownHours)}` : `about ${formatHoursLong(knownHours)}`}
                  </p>
                  <EstimateWarning />
                </div>
              )}

              {/* Notes for the shop */}
              <div className="mt-5 border-t pt-4">
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
              </div>
            </BookModalCard>
          )}

          {/* 3. Pick visit date */}
          {step === 2 && (
            <BookModalCard
              icon={Wrench}
              title={pickup === "home" ? "3. Home service visit" : "3. Vehicle drop-off"}
              subtitle={
                pickup === "home"
                  ? "Choose the day and time our mechanic will come to your address."
                  : "Choose the day and time you will bring your vehicle to the shop."
              }
            >
              <div>
                <VisitDatePicker
                  date={preferredDate}
                  time={preferredTime}
                  dateChosen={dateChosen}
                  shopHours={shopHours}
                  dateHeading={pickup === "home" ? "Home visit date" : "Drop-off date"}
                  timeHeading={pickup === "home" ? "Preferred time of service" : "Drop-off time"}
                  onChangeDate={(d) => {
                    setPreferredDate(d);
                    setDateChosen(true);
                    setPreferredTime("");
                  }}
                  onChangeTime={setPreferredTime}
                />
              </div>

              {/* Overnight Notice */}
              {noticeShowing && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                    <div className="flex-1 space-y-2.5">
                      {takesMoreThanOneDay ? (
                        <p className="text-sm font-medium">
                          {pickup === "home"
                            ? "This job takes more than one day. Our mechanic will come back the next working day until it is done."
                            : "This job takes more than one day."}
                        </p>
                      ) : pickup === "home" ? (
                        <p className="text-sm">
                          <span className="font-semibold">
                            {activePackage ? activePackage.name : "Your selected services"}
                          </span>{" "}
                          takes about {formatHoursLong(knownHours)}. Starting at {preferredTime}, our mechanic may finish
                          around {formatDecimalTime(finishHour)}, after our usual closing time of{" "}
                          {formatDecimalTime(shopDayHours!.close)}.
                        </p>
                      ) : (
                        <p className="text-sm">
                          <span className="font-semibold">
                            {activePackage ? activePackage.name : "Your selected services"}
                          </span>{" "}
                          takes about {formatHoursLong(knownHours)}. Starting at {preferredTime} it may finish around{" "}
                          {formatDecimalTime(finishHour)}, after we close at {formatDecimalTime(shopDayHours!.close)}.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 pt-1">
                        {/* Shop visit: the customer agrees to leave the vehicle overnight.
                            Home service: nothing is left at the shop, so there is no agreement. */}
                        {pickup === "shop" && (
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
          )}

          {/* Wizard Navigation Footer */}
          <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
            <div>
              {step > 0 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
                  className="cursor-pointer rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent"
                >
                  Back
                </button>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {step < 2 ? (
                <button
                  type="button"
                  disabled={step === 0 ? !(vehicleOk && placeOk) : !servicesOk}
                  onClick={() => {
                    if (step === 0) {
                      if (!vehicleOk) {
                        setFieldErrors((p) => ({
                          ...p,
                          selectedVehicleId:
                            p.selectedVehicleId || "Pick or register a vehicle.",
                        }));
                        return;
                      }
                      if (!placeOk) {
                        setFieldErrors((p) => ({ ...p, homeAddress: p.homeAddress || "Home address is required." }));
                        return;
                      }
                      setStep(1);
                    } else if (step === 1) {
                      if (!servicesOk) {
                        setFieldErrors((p) => ({
                          ...p,
                          service:
                            p.service ||
                            "Pick at least one service, or tick 'I am not sure what is wrong', or describe your concern in the notes.",
                        }));
                        return;
                      }
                      setStep(2);
                    }
                  }}
                  className="cursor-pointer rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmOpen(true)}
                  disabled={isSubmitting || !dateOk}
                  className="cursor-pointer rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Confirming..." : "Confirm booking"}
                </button>
              )}
              {step === 0 && !(vehicleOk && placeOk) && (
                <p className="text-[11px] text-muted-foreground">
                  {!vehicleOk ? "Pick a vehicle to continue." : "Enter your home address to continue."}
                </p>
              )}
              {step === 1 && !servicesOk && (
                <p className="text-[11px] text-muted-foreground">
                  Pick a service or describe the problem to continue.
                </p>
              )}
              {step === 2 && !dateOk && (
                <p className="text-[11px] text-muted-foreground">Pick a date and a time to confirm.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div role="dialog" aria-modal="true" aria-label="Confirm this booking" className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-foreground">Confirm this booking?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Please check your details. The shop will review your booking and contact you.
            </p>

            <dl className="mt-4 space-y-2 rounded-lg bg-accent/50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Vehicle</dt>
                <dd className="text-right font-medium text-foreground">{displayVehicle}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Service option</dt>
                <dd className="text-right font-medium text-foreground">{pickup === "shop" ? "Shop Visit" : "Home Service"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Visit date</dt>
                <dd className="text-right font-medium text-foreground">
                  {dateChosen && timeChosen
                    ? formatVisitWindow(toManilaIso(toDateValue(preferredDate), preferredTime))
                    : "—"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false);
                  handleConfirm();
                }}
                className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
              >
                Yes, confirm booking
              </button>
            </div>
          </div>
        </div>
      )}

      {inServicePlate && (
        <VehicleInServiceModal plate={inServicePlate} onClose={() => setInServicePlate(null)} />
      )}
    </div>
  );
}

// The estimate is only a guess. It is shown as a red warning card so the customer cannot miss it.
function EstimateWarning() {
  return (
    <div
      role="note"
      className="mt-2 flex items-start gap-2 rounded-lg border border-rose-300/70 bg-rose-500/10 p-2.5 text-rose-900 dark:border-rose-900/60 dark:bg-rose-500/15 dark:text-rose-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
      <p className="text-[11px] font-medium leading-snug">
        This is only an estimate and assumes no additional issues are found. The shop will tell you the confirmed
        finish time after checking your car.
      </p>
    </div>
  );
}

function SummaryGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 border-b pb-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
        <span className="pr-5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Est. time</span>
      </div>
      {children}
    </div>
  );
}

function SummaryServiceRow({
  name,
  hours,
  onRemove,
}: {
  name: string;
  hours: number | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 text-xs">
      <span className="min-w-0 break-words font-medium text-foreground">{name}</span>
      <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
        {hours != null && hours > 0 && (
          <span className="text-[11px] text-muted-foreground">{formatDuration(hours)}</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
          aria-label={`Remove ${name}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
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

// One checklist for all three categories, so they behave the same: two columns on wide
// screens, the first few services shown, and the rest behind "Show all".
function ServiceChecklist({
  services,
  search,
  selectedIds,
  onToggle,
}: {
  services: ServiceOption[];
  search: string;
  selectedIds: number[];
  onToggle: (id: number) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const term = search.trim().toLowerCase();
  const matching = term ? services.filter((s) => s.name.toLowerCase().includes(term)) : services;
  // While collapsed, a ticked service stays visible even if it is past the first few,
  // so nothing the customer chose is ever out of sight.
  const visible =
    term || showAll
      ? matching
      : matching.filter((s, index) => index < SERVICES_SHOWN_FIRST || selectedIds.includes(s.id));

  if (matching.length === 0) {
    return (
      <p className="rounded-md border p-4 text-center text-xs text-muted-foreground">
        {term ? "No services match your search." : "No other services to add here."}
      </p>
    );
  }

  return (
    <div>
      {/* auto-rows-fr: every card gets the same height, even when one name wraps. */}
      <div className="grid auto-rows-fr gap-2 sm:grid-cols-2">
        {visible.map((s) => {
          const checked = selectedIds.includes(s.id);
          const description = usefulDescription(s.name, s.description);
          return (
            <label
              key={s.id}
              className={cn(
                // Slim rows: a little taller on phones (py-2.5) so they stay easy to tap.
                "flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2.5 transition hover:bg-muted/30 sm:py-2",
                checked ? "border-brand bg-brand-soft/20" : "bg-background"
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(s.id)}
                className="mt-px h-4 w-4 shrink-0 rounded border-input accent-brand"
              />
              <div className="min-w-0 flex-1">
                <span className="break-words text-[13px] font-medium leading-snug">{s.name}</span>
                {description && <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>}
              </div>
              {s.baseDurationHours != null && s.baseDurationHours > 0 && (
                <span className="whitespace-nowrap pt-px text-[11px] text-muted-foreground">
                  {formatDuration(s.baseDurationHours)}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {/* Searching already looks through the whole list, so the link is only for browsing. */}
      {!term && matching.length > SERVICES_SHOWN_FIRST && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 cursor-pointer text-xs font-semibold text-brand hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${matching.length} services`}
        </button>
      )}
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
      className={`flex items-center gap-3 rounded-md border p-3 text-sm transition cursor-pointer ${
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

// `stacked` puts the value under a long label instead of squeezing both on one line.
function BookSumRow({ label, value, stacked = false }: { label: string; value: string; stacked?: boolean }) {
  if (stacked) {
    return (
      <div className="border-b pb-2 last:border-0 text-xs">
        <span className="block text-muted-foreground">{label}</span>
        <span className="mt-0.5 block font-medium text-foreground">{value || "—"}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between border-b pb-2 last:border-0 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[65%] line-clamp-2">{value || "—"}</span>
    </div>
  );
}
