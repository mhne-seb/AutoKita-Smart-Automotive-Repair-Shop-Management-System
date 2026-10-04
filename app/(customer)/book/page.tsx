'use client'

import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Calendar, User, MapPin, Car, Wrench, ChevronRight, ChevronLeft, ChevronDown, Check, X,
  Mail, Phone, Hash, FileText, ClipboardCheck, AlertCircle, Clock, ShieldCheck,
} from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import phAddress from "@/data/ph-address.json";
import { requiresDiagnosticScan, DIAGNOSTIC_SCAN_FEE, formatPeso } from "@/data/diagnosticScan";
import { normalizePlateNumber, isValidPlateNumber } from "@/lib/plate";
import { toManilaIso } from "@/lib/bookingSlotsShared";

const TIMES = ["08:00 AM", "09:30 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];
const DAYS_TO_SHOW = 30;

const STEPS = ["SCHEDULE", "CUSTOMER", "VEHICLE", "REVIEW"];

const OTHERS = "Others";

const PROVINCES: string[] = phAddress.provinces;
const CITIES_BY_PROVINCE: Record<string, string[]> = phAddress.citiesByProvince;

const YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));
const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Semi-Automatic"];
const CATEGORIES = [
  "Oil Change", "Brake Service", "Engine Diagnostics", "Tire Replacement",
  "Aircon Repair", "General Maintenance", "Car Wash & Detailing",
];
const VEHICLE_MAKES = [
  "Toyota", "Honda", "Mitsubishi", "Ford", "Nissan", "Hyundai", "Kia",
  "Suzuki", "Isuzu", "Mazda", "Chevrolet", "Subaru", "Volkswagen",
  "BMW", "Mercedes-Benz", "Peugeot", "Geely", "Chery", "MG",
];

/* --- date helpers (real-time, based on the user's current device clock) --- */

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(base: Date, n: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function isToday(d: Date) {
  return isSameDay(d, new Date());
}

// Parses "08:00 AM" -> { h, m } in 24h
function parseTime(t: string) {
  const match = t.match(/(\d+):(\d+)\s?(AM|PM)/i);
  if (!match) return { h: 0, m: 0 };
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ap = match[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, m };
}

// True if this time slot has already passed for the given date (only matters for today)
function isPastSlot(date: Date, time: string) {
  if (!isToday(date)) return false;
  const { h, m } = parseTime(time);
  const slot = new Date(date);
  slot.setHours(h, m, 0, 0);
  return slot.getTime() < Date.now();
}

function normalizeTimeSlot(t: string): string {
  const match = t.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return t.trim();
  let h = parseInt(match[1], 10);
  const m = match[2].padStart(2, "0");
  const ap = (match[3] || "AM").toUpperCase();
  return `${String(h).padStart(2, "0")}:${m} ${ap}`;
}

// True if this time slot is already occupied by a ticket/job order for the given date
function isOccupiedSlot(date: Date, time: string, occupiedByDate: Record<string, string[]> = {}) {
  if (!date || !time) return false;
  const dateKey = toDateValue(date);
  const occupiedTimes = occupiedByDate[dateKey] || [];
  if (occupiedTimes.length === 0) return false;

  const normalizedTarget = normalizeTimeSlot(time);
  if (occupiedTimes.map(normalizeTimeSlot).includes(normalizedTarget)) {
    return true;
  }

  // Also check if entered custom time is within 30 minutes of any booked slot
  const { h: targetH, m: targetM } = parseTime(time);
  const targetTotalMinutes = targetH * 60 + targetM;

  for (const occ of occupiedTimes) {
    const { h: occH, m: occM } = parseTime(occ);
    const occTotalMinutes = occH * 60 + occM;
    if (Math.abs(targetTotalMinutes - occTotalMinutes) < 30) {
      return true;
    }
  }

  return false;
}

function formatDayLabel(d: Date) {
  return {
    d: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
    n: d.getDate(),
    m: d.toLocaleDateString("en-US", { month: "short" }),
  };
}

function formatFullDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function toDateValue(d: Date) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function fromDateValue(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  const out = new Date(y, m - 1, d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ap}`;
}

function to24h(t: string) {
  const match = t.match(/(\d+):(\d+)\s?(AM|PM)/i);
  if (!match) return "";
  let h = parseInt(match[1], 10);
  const ap = match[3].toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${match[2]}`;
}
/* --- validation helpers --- */

function isFilled(v: string) {
  return v.trim().length > 0;
}

// A "select w/ Others" field is valid if something is chosen, and if that
// something is "Others", the free-text companion field must also be filled.
function isSelectValid(value: string, otherValue: string) {
  if (!isFilled(value)) return false;
  if (value === OTHERS) return isFilled(otherValue);
  return true;
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidPhone(v: string) {
  // Accepts PH mobile formats like 09XXXXXXXXX or +639XXXXXXXXX
  return /^(\+?63|0)9\d{9}$/.test(v.replace(/[\s-]/g, ""));
}

// Generates a friendly booking reference, e.g. AC-48213-2026
function makeBookingId() {
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `AC-${rand}-${new Date().getFullYear()}`;
}

type Form = {
  date: Date; time: string;
  firstName: string; lastName: string; nickname: string;
  phone: string; email: string;
  province: string; provinceOther: string;
  city: string; cityOther: string;
  barangay: string;
  street: string;
  make: string; makeOther: string;
  model: string;
  year: string; yearOther: string;
  transmission: string; transmissionOther: string;
  mileage: string; plate: string;
  pickup: "shop" | "home";
  category: string; categoryOther: string;
  concern: string;
  // Customer's explicit agreement to the OBD-II scan fee, when the chosen
  // category requires the scanner. Never inferred — always a real click.
  scanAcknowledged: boolean;
};

function isStepValid(step: number, f: Form, occupiedByDate: Record<string, string[]> = {}): boolean {
  switch (step) {
    case 0:
      return (
        !!f.date &&
        !!f.time &&
        !isPastSlot(f.date, f.time) &&
        !isOccupiedSlot(f.date, f.time, occupiedByDate)
      );
    case 1:
      return (
        isFilled(f.firstName) &&
        isFilled(f.lastName) &&
        isValidPhone(f.phone) &&
        isValidEmail(f.email) &&
        isFilled(f.street) &&
        isSelectValid(f.province, f.provinceOther) &&
        isSelectValid(f.city, f.cityOther) &&
        isFilled(f.barangay)
      );
    case 2:
      return (
        isSelectValid(f.make, f.makeOther) &&
        isFilled(f.model) &&
        isSelectValid(f.year, f.yearOther) &&
        isSelectValid(f.transmission, f.transmissionOther) &&
        isFilled(f.mileage) &&
        isValidPlateNumber(f.plate) &&
        isSelectValid(f.category, f.categoryOther) &&
        isFilled(f.concern) &&
        // The scan fee has to be agreed to before the ticket can be submitted,
        // so the shop is never charging for something nobody said yes to.
        (!requiresDiagnosticScan(f.category) || f.scanAcknowledged)
      );
    default:
      return true;
  }
}

function BookPage() {
  useEffect(() => { document.title = "Book a Service — AutoKita"; }, []);

  const router = useRouter();
  const [step, setStep] = useState(0);
  const [showReview, setShowReview] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [plateTaken, setPlateTaken] = useState(false);
  const [checkingPlate, setCheckingPlate] = useState(false);

  // Set once the customer confirms — swaps the modal from "review" to "submitted" state.
  // We deliberately do NOT navigate to a separate route: the confirmation lives right here.
  const [submitted, setSubmitted] = useState(false);
  const [accountEmailed, setAccountEmailed] = useState(false);
  const [bookingId, setBookingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [occupiedByDate, setOccupiedByDate] = useState<Record<string, string[]>>({});
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [f, setF] = useState<Form>({
    date: startOfToday(),
    time: TIMES.find((t) => !isPastSlot(startOfToday(), t)) ?? TIMES[0],
    firstName: "", lastName: "", nickname: "",
    phone: "", email: "",
    street: "",
    province: "", provinceOther: "",
    city: "", cityOther: "",
    barangay: "",
    make: "", makeOther: "",
    model: "",
    year: "", yearOther: "",
    transmission: "", transmissionOther: "",
    mileage: "", plate: "",
    pickup: "shop",
    category: "", categoryOther: "",
    concern: "",
    scanAcknowledged: false,
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const selectProvince = (v: string) => {
    // changing province invalidates whatever city/barangay was picked before
    setF((p) => ({
      ...p,
      province: v,
      provinceOther: v === OTHERS ? p.provinceOther : "",
      city: "", cityOther: "",
      barangay: "",
    }));
  };

  const selectCity = (v: string) => {
    // changing city invalidates whatever barangay was picked before
    setF((p) => ({
      ...p,
      city: v,
      cityOther: v === OTHERS ? p.cityOther : "",
    }));
  };

  const fetchOccupiedSlots = async () => {
    try {
      setLoadingSlots(true);
      const res = await fetch("/api/customer/booking/occupied-slots");
      const data = await res.json();
      if (data.success && data.occupiedByDate) {
        setOccupiedByDate(data.occupiedByDate);
        setF((prev) => {
          if (isOccupiedSlot(prev.date, prev.time, data.occupiedByDate) || isPastSlot(prev.date, prev.time)) {
            const firstAvailable = TIMES.find(
              (t) => !isPastSlot(prev.date, t) && !isOccupiedSlot(prev.date, t, data.occupiedByDate)
            );
            if (firstAvailable) {
              return { ...prev, time: firstAvailable };
            }
          }
          return prev;
        });
      }
    } catch (err) {
      console.error("Failed to load occupied slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    fetchOccupiedSlots();
  }, []);

  const next = async () => {
    if (!isStepValid(step, f, occupiedByDate)) {
      setAttemptedNext(true);
      return;
    }

    //leaving the customer step:block the customer if this eamil already has an account. they must log in first instead of booking as a guest.
    if (step === 1) {
      setCheckingEmail(true);
      try {
        const res = await fetch(
          `/api/customer/check-email?email=${encodeURIComponent(f.email)}`
        );

        const data = await res.json();
        if (data.exists) {
          setEmailTaken(true);
          setAttemptedNext(true);
          setCheckingEmail(false);
          return;
        }
      } catch { }
      setCheckingEmail(false);
    }

    // Leaving the Vehicle step: block if this plate is invalid or already registered.
    if (step === 2) {
      if (!isValidPlateNumber(f.plate)) {
        setAttemptedNext(true);
        return;
      }
      setCheckingPlate(true);
      try {
        const res = await fetch(
          `/api/customer/check-plate?plate=${encodeURIComponent(f.plate)}`
        );
        const data = await res.json();
        if (data.exists) {
          setPlateTaken(true);
          setAttemptedNext(true);
          setCheckingPlate(false);
          return;
        }
      } catch { }
      setCheckingPlate(false);
    }

    setEmailTaken(false);
    setPlateTaken(false);
    setAttemptedNext(false);
    setStep((s) => Math.min(3, s + 1));
  };
  const back = () => {
    setAttemptedNext(false);
    setStep((s) => Math.max(0, s - 1));
  };

  const visibleDays = Array.from({ length: DAYS_TO_SHOW }, (_, i) => addDays(startOfToday(), i));

  const selectDate = (d: Date) => {
    set("date", d);
    // If the currently selected time is already past OR occupied for the newly picked date, bump to next available
    if (isPastSlot(d, f.time) || isOccupiedSlot(d, f.time, occupiedByDate)) {
      const firstAvailable = TIMES.find((t) => !isPastSlot(d, t) && !isOccupiedSlot(d, t, occupiedByDate));
      if (firstAvailable) set("time", firstAvailable);
    }
  };

  const cityOptions = f.province && f.province !== OTHERS ? CITIES_BY_PROVINCE[f.province] ?? [] : [];

  const currentStepValid = isStepValid(step, f, occupiedByDate);
  const showError = attemptedNext && !currentStepValid;

  // Called from the review modal's "Confirm Booking" button.
  // Stays on /book — swaps the modal content to the "under review" confirmation instead of routing away.
  const confirmBooking = async () => {
    setSubmitting(true);

    try {
      const slot = `${f.date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })} ${f.time}`;
      const category = f.category === OTHERS ? f.categoryOther : f.category;
      const address = [
        f.street,
        f.barangay,
        f.city === OTHERS ? f.cityOther : f.city,
        f.province === OTHERS ? f.provinceOther : f.province,
      ].filter(Boolean).join(", ");

      let preferredDatetime: string | null = null;
      if (f.date instanceof Date && !isNaN(f.date.getTime()) && f.time) {
        preferredDatetime = toManilaIso(toDateValue(f.date), f.time);
      }

      const res = await fetch("/api/customer/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: {
            firstName: f.firstName,
            lastName: f.lastName,
            nickname: f.nickname,
            email: f.email,
            phone: f.phone,
            address,
          },
          newVehicleDetails: {
            make: f.make === OTHERS ? f.makeOther : f.make,
            model: f.model,
            year: f.year === OTHERS ? f.yearOther : f.year,
            plate: normalizePlateNumber(f.plate),
            type: f.transmission === OTHERS ? f.transmissionOther : f.transmission,
            mileage: f.mileage,
          },
          serviceMode: f.pickup === "home" ? "Home Service" : "Walk In",
          homeAddress: address,
          preferredDatetime,
          customerConcern: `Requested: ${slot} | Service: ${category} | ${f.concern || "No specific concerns"}`,
          // Only true when the category needs the scanner AND the box was ticked;
          // the server records it as a consent event against the ticket.
          diagnosticScanAuthorized: requiresDiagnosticScan(f.category) && f.scanAcknowledged,
        }),
      });

      const result = await res.json();

      if (result.success) {
        setBookingId(`AC-${result.ticket.id}-${new Date().getFullYear()}`);
        setAccountEmailed(!!result.accountEmailed);
        setSubmitted(true);
        if (result.userId || result.ticket?.user_id) {
          const uid = String(result.userId || result.ticket.user_id);
          sessionStorage.setItem('autokita_customer', 'true');
          sessionStorage.setItem('autokita_user_id', uid);
          sessionStorage.setItem('autokita_user_name', f.nickname || f.firstName || 'Customer');
        }
      } else if (result.code === "SLOT_TAKEN") {
        setShowReview(false);
        setStep(0);
        setAttemptedNext(true);
        toast.error(result.message || "This time slot is already booked. Please choose an available time.");
        fetchOccupiedSlots();
      } else if (result.code === "EMAIL_REGISTERED") {
        setShowReview(false);
        setStep(1);
        setEmailTaken(true);
        setAttemptedNext(true);
        toast.error("This email already has an account. Please log in to book.")
      } else if (result.code === "PLATE_REGISTERED") {
        setShowReview(false);
        setStep(2);
        setPlateTaken(true);
        setAttemptedNext(true);
        toast.error("This vehicle is already registered. Please log in to book service for it.");
      } else if (result.code === "INVALID_PLATE_FORMAT") {
        setShowReview(false);
        setStep(2);
        setAttemptedNext(true);
        toast.error(result.message || "Invalid license plate format.");
      }
      else {
        console.error("Booking failed:", result.debug || result.message);
        toast.error(result.message || "Could not submit your booking. Please try again.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Could not reach the server. Check your connection and try again.");
    }
    setSubmitting(false);
  };

  // Resets everything so the customer can book another service without leaving the page.
  const startNewBooking = () => {
    setShowReview(false);
    setSubmitted(false);
    setAccountEmailed(false);
    setAttemptedNext(false);
    setStep(0);
    fetchOccupiedSlots();
    setF({
      date: startOfToday(),
      time: TIMES.find((t) => !isPastSlot(startOfToday(), t)) ?? TIMES[0],
      firstName: "", lastName: "", nickname: "",
      phone: "", email: "",
      street: "",
      province: "", provinceOther: "",
      city: "", cityOther: "",
      barangay: "",
      make: "", makeOther: "",
      model: "",
      year: "", yearOther: "",
      transmission: "", transmissionOther: "",
      mileage: "", plate: "",
      pickup: "shop",
      category: "", categoryOther: "",
      concern: "",
      scanAcknowledged: false,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="mx-auto max-w-4xl px-6 py-12">
        <div className="text-center">
          <h1 className="text-3xl font-bold md:text-4xl">Book a Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">Follow the steps below to schedule your visit.</p>
        </div>

        {/* --- Animated car progress tracker --- */}
        <div className="mt-10">
          <CarProgressTracker step={step} />
        </div>

        <div key={step} className="mt-12 animate-fade-up">
          {step === 0 && (
            <>
              <Section icon={Calendar} title="Schedule Visit" subtitle="Pick a convenient day and time.">
                {/* Pick any date — calendar popup or type it */}
                <div className="mb-3">
                  <label className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Pick a date
                  </label>
                  <input
                    type="date"
                    min={toDateValue(startOfToday())}
                    value={toDateValue(f.date)}
                    onChange={(e) => e.target.value && selectDate(fromDateValue(e.target.value))}
                    className="mt-1.5 block rounded-md border bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                  />
                </div>

                {/* Quick day strip — scrolls sideways, shows every day */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {visibleDays.map((day) => {
                    const sel = isSameDay(day, f.date);
                    const today = isToday(day);
                    const label = formatDayLabel(day);
                    const dayKey = toDateValue(day);
                    const dayOccupied = occupiedByDate[dayKey] || [];
                    const allBooked = TIMES.every((t) => isPastSlot(day, t) || isOccupiedSlot(day, t, occupiedByDate));
                    const hasOccupied = dayOccupied.length > 0;
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        onClick={() => selectDate(day)}
                        className={`relative w-[4.5rem] flex-shrink-0 rounded-lg border p-3 text-center transition ${sel ? "border-brand bg-brand text-brand-foreground shadow-lg" : "hover:bg-accent"
                          }`}
                      >
                        {today && (
                          <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${sel ? "bg-white" : "bg-brand"}`} />
                        )}
                        <div className={`text-[10px] font-semibold uppercase ${sel ? "text-white/80" : "text-muted-foreground"}`}>
                          {today ? "TODAY" : label.d}
                        </div>
                        <div className="mt-1 text-2xl font-bold">{label.n}</div>
                        <div className={`text-[10px] ${sel ? "text-white/80" : "text-muted-foreground"}`}>{label.m}</div>
                        {allBooked ? (
                          <span className={`mt-1 block text-[9px] font-bold uppercase tracking-wider ${sel ? "text-rose-200" : "text-rose-500"}`}>
                            Full
                          </span>
                        ) : hasOccupied ? (
                          <span className={`mt-1 block text-[9px] font-medium ${sel ? "text-white/70" : "text-muted-foreground"}`}>
                            {TIMES.filter((t) => !isPastSlot(day, t) && !isOccupiedSlot(day, t, occupiedByDate)).length} left
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {/* Preset time slots */}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TIMES.map((t) => {
                    const sel = f.time === t;
                    const past = isPastSlot(f.date, t);
                    const occupied = isOccupiedSlot(f.date, t, occupiedByDate);
                    const disabled = past || occupied;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => !disabled && set("time", t)}
                        disabled={disabled}
                        title={
                          past
                            ? "This time has already passed for today"
                            : occupied
                            ? "This time slot is already booked"
                            : undefined
                        }
                        className={`relative flex flex-col items-center justify-center rounded-md border py-2.5 px-3 text-sm font-medium transition ${
                          disabled
                            ? occupied
                              ? "cursor-not-allowed border-rose-200 bg-rose-50/70 text-rose-400 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-500"
                              : "cursor-not-allowed border-dashed text-muted-foreground/40"
                            : sel
                            ? "border-brand bg-brand text-brand-foreground shadow-sm"
                            : "hover:border-brand hover:bg-brand-soft"
                        }`}
                      >
                        <span className={occupied ? "line-through opacity-75" : ""}>{t}</span>
                        {occupied && (
                          <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Booked
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Day full notice if all times are taken or past */}
                {TIMES.every((t) => isPastSlot(f.date, t) || isOccupiedSlot(f.date, t, occupiedByDate)) && (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>All preset time slots for this date are fully booked or have passed. Please select another date.</span>
                  </div>
                )}


              </Section>
            </>
          )}

          {step === 1 && (
            <>
              <Section icon={User} title="Customer Details" subtitle="Tell us how to reach you.">
                <div className="space-y-4 rounded-lg border p-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <IField
                      icon={User} label="First Name" required value={f.firstName} onChange={(v) => set("firstName", v)}
                      placeholder="e.g., Juan"
                      error={showError && !isFilled(f.firstName) ? "First name is required" : undefined}
                    />
                    <IField
                      icon={User} label="Last Name" required value={f.lastName} onChange={(v) => set("lastName", v)}
                      placeholder="e.g., Dela Cruz"
                      error={showError && !isFilled(f.lastName) ? "Last name is required" : undefined}
                    />
                  </div>
                  <IField
                    icon={User} label="Nickname" value={f.nickname} onChange={(v) => set("nickname", v)}
                    placeholder="Optional — defaults to your first name"
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <IField
                      icon={Phone} label="Contact Number" required value={f.phone} onChange={(v) => set("phone", v)}
                      placeholder="e.g., 09951234567"
                      error={showError && !isValidPhone(f.phone) ? "Enter a valid PH mobile number" : undefined}
                    />
                    <IField
                      icon={Mail} label="Email Address" required value={f.email} onChange={(v) => { set("email", v); setEmailTaken(false); }}
                      placeholder="you@email.com"
                      hint="Use an email you can open. We send your temporary password and verification codes here."
                      error={showError && !isValidEmail(f.email) ? "Enter a valid email address" : emailTaken ? "This email already has an account. Please log in first" : undefined}
                    />
                  </div>
                </div>
              </Section>
              <Section icon={MapPin} title="Location Information" subtitle="Where should we serve you?">
                <div className="space-y-4 rounded-lg border p-5">
                  <IField
                    icon={MapPin} label="House No. / Street / Subdivision" required value={f.street}
                    onChange={(v) => set("street", v)}
                    placeholder="e.g., 123 Mabini St., Green Village"
                    error={showError && !isFilled(f.street) ? "Street address is required" : undefined}
                  />
                  <div className="grid gap-4 md:grid-cols-3">
                    <SelectField
                      icon={MapPin} label="Province" required value={f.province}
                      onChange={selectProvince} options={PROVINCES}
                      placeholder="Select province"
                      otherValue={f.provinceOther} onOtherChange={(v) => set("provinceOther", v)}
                      error={showError && !isSelectValid(f.province, f.provinceOther) ? "Province is required" : undefined}
                    />
                    <SelectField
                      icon={MapPin} label="City" required value={f.city}
                      onChange={selectCity} options={cityOptions}
                      placeholder={f.province ? "Select city" : "Select province first"}
                      // Stays open for "Others" provinces too: there's no city list for
                      // them, so "Others (type your own)" is the only choice.
                      disabled={!f.province}
                      otherValue={f.cityOther} onOtherChange={(v) => set("cityOther", v)}
                      error={showError && !isSelectValid(f.city, f.cityOther) ? "City is required" : undefined}
                    />
                    <IField
                      icon={MapPin} label="Barangay" required value={f.barangay}
                      onChange={(v) => set("barangay", v)}
                      placeholder="Type your barangay"
                      error={showError && !isFilled(f.barangay) ? "Barangay is required" : undefined}
                    />
                  </div>
                </div>
              </Section>
            </>
          )}

          {step === 2 && (
            <>
              <Section icon={Car} title="Vehicle Details" subtitle="Help our team prepare the right tools.">
                <div className="grid gap-4 md:grid-cols-2">
                  <SelectField
                    icon={Car} label="Vehicle Make (Brand)" required value={f.make}
                    onChange={(v) => set("make", v)} options={VEHICLE_MAKES}
                    placeholder="Select brand"
                    otherValue={f.makeOther} onOtherChange={(v) => set("makeOther", v)}
                    error={showError && !isSelectValid(f.make, f.makeOther) ? "Vehicle make is required" : undefined}
                  />
                  <IField
                    icon={Car} label="Vehicle Model" required value={f.model} onChange={(v) => set("model", v)}
                    placeholder="e.g., Vios, Civic, Montero"
                    error={showError && !isFilled(f.model) ? "Vehicle model is required" : undefined}
                  />
                  <SelectField
                    icon={Calendar} label="Year" required value={f.year}
                    onChange={(v) => set("year", v)} options={YEARS}
                    placeholder="Select year"
                    otherValue={f.yearOther} onOtherChange={(v) => set("yearOther", v)}
                    error={showError && !isSelectValid(f.year, f.yearOther) ? "Year is required" : undefined}
                  />
                  <SelectField
                    icon={Settings2Icon} label="Transmission" required value={f.transmission}
                    onChange={(v) => set("transmission", v)} options={TRANSMISSIONS}
                    placeholder="Select transmission"
                    otherValue={f.transmissionOther} onOtherChange={(v) => set("transmissionOther", v)}
                    error={showError && !isSelectValid(f.transmission, f.transmissionOther) ? "Transmission is required" : undefined}
                  />
                  <IField
                    icon={Hash} label="Mileage" required value={f.mileage} onChange={(v) => set("mileage", v)}
                    placeholder="e.g., 45,000 km"
                    error={showError && !isFilled(f.mileage) ? "Mileage is required" : undefined}
                  />
                  <IField
                    icon={Hash} label="License Plate" required value={f.plate}
                    onChange={(v) => { set("plate", v); setPlateTaken(false); }}
                    placeholder="e.g., ABC-1234 or AB-1234"
                    error={
                      showError && !isFilled(f.plate)
                        ? "License plate is required"
                        : showError && !isValidPlateNumber(f.plate)
                          ? "Invalid plate format (e.g., ABC-1234, AB-1234, or AB-12345)"
                          : plateTaken
                            ? "This vehicle is already registered. Please log in to book service for it."
                            : undefined
                    }
                  />
                </div>
              </Section>

              <Section icon={Wrench} title="Service Preferences" subtitle="What do you need done?">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Pick Up Option</label>
                <div className="mt-2 grid gap-3 md:grid-cols-2">
                  <RadioTile icon={MapPin} label="Shop Visit" active={f.pickup === "shop"} onClick={() => set("pickup", "shop")} />
                  <RadioTile icon={Car} label="Home Service" active={f.pickup === "home"} onClick={() => set("pickup", "home")} />
                </div>
                <div className="mt-5">
                  <SelectField
                    icon={Wrench} label="Service Category" required value={f.category}
                    onChange={(v) => { set("category", v); set("scanAcknowledged", false); }} options={CATEGORIES}
                    placeholder="Select a service"
                    otherValue={f.categoryOther} onOtherChange={(v) => set("categoryOther", v)}
                    error={showError && !isSelectValid(f.category, f.categoryOther) ? "Service category is required" : undefined}
                  />
                </div>

                {/* Scanner-fee disclosure — shown the moment a scanner category
                    is chosen, and the ticket can't be submitted until it's
                    agreed to. This is the documented consent, not a tooltip. */}
                {requiresDiagnosticScan(f.category) && (
                  <div
                    className={`mt-4 rounded-xl border p-4 ${
                      showError && !f.scanAcknowledged ? "border-red-400 bg-red-50/40" : "border-amber-300 bg-amber-50"
                    }`}
                  >
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
                            checked={f.scanAcknowledged}
                            onChange={(e) => set("scanAcknowledged", e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-amber-400 accent-amber-600"
                          />
                          <span>
                            I agree to pay the {formatPeso(DIAGNOSTIC_SCAN_FEE)} scan fee.
                          </span>
                        </label>
                        {showError && !f.scanAcknowledged && (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-red-500">
                            <AlertCircle className="h-3 w-3" /> Please agree to the scan fee to continue
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <FileText className="h-3 w-3" /> Concern <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={f.concern}
                    onChange={(e) => set("concern", e.target.value)}
                    className={`mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${showError && !isFilled(f.concern) ? "border-red-400 focus:border-red-400" : "focus:border-brand"
                      }`}
                    placeholder="Describe the issue…"
                  />
                  {showError && !isFilled(f.concern) && (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
                      <AlertCircle className="h-3 w-3" /> Please describe the concern
                    </p>
                  )}
                </div>
              </Section>
            </>
          )}

          {step === 3 && (
            <Section icon={ClipboardCheck} title="Quick Review" subtitle="Confirm the summary before you submit.">
              <ReviewGrid f={f} compact />
              <p className="mt-4 text-xs text-muted-foreground">
                Click <b>Submit for Review</b> to see the full confirmation panel.
              </p>
            </Section>
          )}

          <div className="mt-10 border-t pt-6">
            {showError && (
              <p className="mb-4 flex items-center gap-1.5 text-xs font-medium text-red-500">
                <AlertCircle className="h-3.5 w-3.5" />
                {step === 0 && isOccupiedSlot(f.date, f.time, occupiedByDate)
                  ? "The selected time slot is already booked. Please pick an available time."
                  : step === 0 && isPastSlot(f.date, f.time)
                  ? "The selected time has already passed. Please pick an upcoming time."
                  : "Please complete all required fields before continuing."}
              </p>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={back}
                disabled={step === 0}
                className={`flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium transition-all duration-200 ${
                  step === 0
                    ? "cursor-not-allowed opacity-40"
                    : "cursor-pointer hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm active:translate-y-0"
                }`}
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < 3 ? (
                <button
                  onClick={next}
                  disabled={checkingEmail || checkingPlate}
                  className={`flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    checkingEmail || checkingPlate
                      ? "cursor-not-allowed bg-muted text-muted-foreground"
                      : "cursor-pointer bg-brand text-brand-foreground hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-md active:translate-y-0"
                  }`}
                >
                  {checkingEmail || checkingPlate ? "Checking..." : "Next"} <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowReview(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-md active:translate-y-0"
                >
                  Submit for Review <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {showReview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 animate-fade-up">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-background shadow-2xl">
            {!submitted ? (
              <>
                <div className="flex items-center justify-between border-b bg-brand px-6 py-4 text-white">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5" />
                    <h3 className="font-semibold">Please Review Your Booking</h3>
                  </div>
                  <button onClick={() => setShowReview(false)} className="rounded p-1 hover:bg-white/10">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="max-h-[65vh] overflow-y-auto bg-muted/20 px-6 py-5">
                  <ReviewGrid f={f} />
                </div>
                <div className="flex items-center justify-end gap-2 border-t bg-background px-6 py-4">
                  <button
                    onClick={() => setShowReview(false)}
                    className="cursor-pointer rounded-md border px-4 py-2 text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm active:translate-y-0"
                  >
                    Edit
                  </button>
                  <button
                    onClick={confirmBooking}
                    disabled={submitting}
                    className={`flex items-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition-all duration-200 ${
                      submitting
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-md active:translate-y-0"
                    }`}
                  >
                    <Check className="h-4 w-4" /> {submitting ? "Submitting..." : "Confirm Booking"}
                  </button>
                </div>
              </>
            ) : (
              <BookingSubmittedPanel
                f={f}
                bookingId={bookingId}
                accountEmailed={accountEmailed}
                onClose={() => setShowReview(false)}
                onBackHome={() => router.push("/")}
                onNewBooking={startNewBooking}
              />
            )}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

/* --- pieces --- */

const STEP_ICONS = [Calendar, User, Car, ClipboardCheck];

function CarProgressTracker({ step }: { step: number }) {
  const pct = (step / (STEPS.length - 1)) * 100;

  return (
    <div className="relative mx-auto max-w-xl px-4 pt-10 pb-2">
      <style>{`
        @keyframes car-idle {
          0%, 100% { transform: translate(-50%, 0) rotate(0deg); }
          50% { transform: translate(-50%, -3px) rotate(-1.5deg); }
        }
        @keyframes car-shadow-pulse {
          0%, 100% { transform: translateX(-50%) scaleX(1); opacity: 0.25; }
          50% { transform: translateX(-50%) scaleX(0.8); opacity: 0.15; }
        }
        @keyframes smoke-puff {
          0% { opacity: 0.55; transform: translate(-50%, 0) scale(0.5); }
          60% { opacity: 0.35; }
          100% { opacity: 0; transform: translate(-140%, -20px) scale(1.6); }
        }
        @keyframes road-move {
          0% { background-position: 0 0; }
          100% { background-position: -32px 0; }
        }
        .road-track {
          background-image: repeating-linear-gradient(
            90deg,
            hsl(var(--muted-foreground) / 0.35) 0px,
            hsl(var(--muted-foreground) / 0.35) 10px,
            transparent 10px,
            transparent 20px
          );
          animation: road-move 1s linear infinite;
        }
        .car-idle-wrap { animation: car-idle 1.6s ease-in-out infinite; }
        .car-shadow { animation: car-shadow-pulse 1.6s ease-in-out infinite; }
        .smoke-dot {
          position: absolute;
          bottom: 4px;
          right: -1px;
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: hsl(var(--muted-foreground) / 0.7);
          animation: smoke-puff 1.3s ease-out infinite;
        }
        .smoke-dot.d2 { animation-delay: 0.4s; width: 7px; height: 7px; }
        .smoke-dot.d3 { animation-delay: 0.8s; width: 6px; height: 6px; }
      `}</style>

      {/* road */}
      <div className="relative h-2.5">
        <div className="absolute inset-0 overflow-hidden rounded-full bg-muted/60 shadow-inner">
          <div className="road-track absolute inset-0 opacity-60" />
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-brand/70 to-brand shadow-[0_0_10px_hsl(var(--brand)/0.5)] transition-all duration-700 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* car + shadow + smoke, positioned relative to the track, NOT clipped */}
        <div
          className="absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pct}%` }}
        >
          {/* shadow */}
          <div className="car-shadow absolute left-1/2 top-[26px] h-2 w-7 -translate-x-1/2 rounded-full bg-black/40 blur-[2px]" />

          <div className="car-idle-wrap relative -translate-y-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-background bg-gradient-to-br from-brand to-brand/80 text-brand-foreground shadow-xl shadow-brand/30">
              <Car className="h-5 w-5" />
            </div>
            <span className="smoke-dot" />
            <span className="smoke-dot d2" />
            <span className="smoke-dot d3" />
          </div>
        </div>
      </div>

      {/* step labels with icon badges */}
      <div className="relative z-10 mt-8 flex items-start justify-between">
        {STEPS.map((label, i) => {
          const Icon = STEP_ICONS[i];
          const active = i === step;
          const done = i < step;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${active
                  ? "border-brand bg-brand text-brand-foreground scale-110 shadow-md shadow-brand/30"
                  : done
                    ? "border-brand/60 bg-brand-soft text-brand"
                    : "border-border bg-muted text-muted-foreground"
                  }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div
                className={`text-[10px] font-semibold tracking-wide transition-colors ${active ? "text-brand" : done ? "text-foreground" : "text-muted-foreground"
                  }`}
              >
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function IField({
  icon: Icon, label, value, onChange, placeholder, required, error, hint,
}: {
  icon: any; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; error?: string; hint?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
            }`}
        />
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
      {!error && hint && (
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function SelectField({
  icon: Icon, label, value, onChange, options, placeholder, otherValue, onOtherChange,
  required, error, disabled,
}: {
  icon: any; label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
  otherValue: string; onOtherChange: (v: string) => void;
  required?: boolean; error?: string; disabled?: boolean;
}) {
  const isOther = value === OTHERS;
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative mt-1.5">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full appearance-none rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none disabled:opacity-60 ${error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
            }`}
        >
          <option value="" disabled>{placeholder || "Select an option"}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
          <option value={OTHERS}>Others (type your own)</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {isOther && (
        <input
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={`Please specify ${label.toLowerCase()}`}
          autoFocus
          className="mt-2 w-full rounded-md border border-brand/50 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      )}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      )}
    </div>
  );
}

function RadioTile({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 rounded-md border p-3 text-sm transition ${active ? "border-brand bg-brand-soft/40" : "hover:bg-accent"
        }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${active ? "border-brand" : "border-muted-foreground"}`}>
        {active && <span className="h-2 w-2 rounded-full bg-brand" />}
      </span>
      <Icon className="h-4 w-4 text-brand" /> {label}
    </button>
  );
}

/* --- Review (redesigned) ---
   Groups the booking into labeled sections (Schedule / Customer / Vehicle / Service)
   instead of one flat wall of identical boxes, so the reader can scan by category.
   `compact` (used in the inline "Quick Review" step) collapses each section down to
   one summary line; the full version (used in the modal) shows every field. */

type ReviewItem = { icon: any; label: string; value: string };
type ReviewSection = { title: string; icon: any; items: ReviewItem[] };

function buildReviewSections(f: Form): ReviewSection[] {
  const province = f.province === OTHERS ? f.provinceOther : f.province;
  const city = f.city === OTHERS ? f.cityOther : f.city;
  const barangay = f.barangay;
  const make = f.make === OTHERS ? f.makeOther : f.make;
  const year = f.year === OTHERS ? f.yearOther : f.year;
  const transmission = f.transmission === OTHERS ? f.transmissionOther : f.transmission;
  const category = f.category === OTHERS ? f.categoryOther : f.category;

  return [
    {
      title: "Schedule",
      icon: Calendar,
      items: [
        { icon: Calendar, label: "Date & Time", value: `${formatFullDate(f.date)} · ${f.time}` },
      ],
    },
    {
      title: "Customer",
      icon: User,
      items: [
        { icon: User, label: "Name", value: [f.firstName, f.lastName].filter(Boolean).join(" ") || "—" },
        { icon: User, label: "Nickname", value: f.nickname || f.firstName || "-" },
        { icon: Phone, label: "Contact Number", value: f.phone || "—" },
        { icon: Mail, label: "Email Address", value: f.email || "—" },
        { icon: MapPin, label: "Address", value: [f.street, barangay, city, province].filter(Boolean).join(", ") || "—" },
      ],
    },
    {
      title: "Vehicle",
      icon: Car,
      items: [
        { icon: Car, label: "Make & Model", value: [make, f.model].filter(Boolean).join(" ") || "—" },
        { icon: Calendar, label: "Year", value: year || "—" },
        { icon: Settings2Icon, label: "Transmission", value: transmission || "—" },
        { icon: Hash, label: "Mileage", value: f.mileage || "—" },
        { icon: Hash, label: "License Plate", value: f.plate || "—" },
      ],
    },
    {
      title: "Service",
      icon: Wrench,
      items: [
        { icon: Wrench, label: "Category", value: category || "—" },
        { icon: MapPin, label: "Pick Up", value: f.pickup === "shop" ? "Shop Visit" : "Home Service" },
        { icon: FileText, label: "Concern", value: f.concern || "—" },
        // Restated on the review screen so the fee is the last thing they see
        // before Confirm, not something buried two steps back.
        ...(requiresDiagnosticScan(f.category)
          ? [{
              icon: ShieldCheck,
              label: "Diagnostic Scan",
              value: `${formatPeso(DIAGNOSTIC_SCAN_FEE)} fee — agreed (charged even if repairs are declined)`,
            }]
          : []),
      ],
    },
  ];
}

function ReviewGrid({ f, compact }: { f: Form; compact?: boolean }) {
  const sections = buildReviewSections(f);

  if (compact) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((sec) => (
          <div key={sec.title} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                <sec.icon className="h-3.5 w-3.5" />
              </div>
              <h4 className="text-xs font-semibold text-foreground">{sec.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground">
              {sec.items.map((i) => i.value).filter((v) => v && v !== "—").join(" · ") || "—"}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sections.map((sec) => (
        <div key={sec.title} className="overflow-hidden rounded-lg border bg-background">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
              <sec.icon className="h-3.5 w-3.5" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">{sec.title}</h4>
          </div>
          <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {sec.items.map((item) => (
              <div key={item.label} className="flex items-start gap-3 p-3.5">
                <item.icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">{item.label}</div>
                  <div className="break-words text-sm font-medium">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* --- Booking submitted (replaces the old /booking-confirmed redirect) ---
   Swapped into the same modal shell once the customer confirms. No route change,
   so the customer's place in the flow — and the data they just entered — never leaves the page. */

function BookingSubmittedPanel({
  f, bookingId, accountEmailed, onClose, onBackHome, onNewBooking,
}: {
  f: Form; bookingId: string; accountEmailed: boolean; onClose: () => void; onBackHome: () => void; onNewBooking: () => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between border-b bg-brand px-6 py-4 text-white">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          <h3 className="font-semibold">Booking Request Submitted</h3>
        </div>
        <button onClick={onClose} className="rounded p-1 hover:bg-white/10">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[65vh] overflow-y-auto px-6 py-6">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-emerald-500">
            <Check className="h-7 w-7 text-emerald-500" strokeWidth={3} />
          </div>
          <h4 className="mt-4 text-xl font-bold">Your booking schedule request is under review</h4>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            We've received your details. Our team will contact you shortly to confirm your appointment.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-1.5 text-xs font-semibold text-brand">
            <Hash className="h-3.5 w-3.5" /> Booking Reference: #{bookingId}
          </div>

          {accountEmailed && (
            <div className="mx-auto mt-3 flex max-w-md flex-col items-center gap-1 text-xs text-muted-foreground">
              <p className="flex items-center justify-center gap-1.5">
                <Mail className="h-3.5 w-3.5 flex-shrink-0 text-brand" />
                We've emailed a temporary password to{" "}
                <span className="font-medium text-foreground">{f.email}</span> so you can track this booking.
              </p>
              <p>Can't find it? Check your Spam or Promotions folder.</p>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-brand" />
              <h5 className="text-sm font-semibold">Booking Summary</h5>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-medium text-amber-700">
              <Clock className="h-3 w-3" /> Pending Review
            </span>
          </div>
          <ReviewGrid f={f} />
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
          Our team will contact you, and you'll see the update in your account once your booking is approved. You can cancel the booking from your dashboard until the shop starts work.
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t bg-background px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={onNewBooking}
          className="cursor-pointer rounded-md border px-4 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent hover:shadow-sm active:translate-y-0"
        >
          Book Another Service
        </button>
        <button
          onClick={onBackHome}
          className="flex cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand/90 hover:shadow-md active:translate-y-0"
        >
          Back to Home <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}

function Settings2Icon(props: any) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 7h-9M14 17H5M14 17a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0z" />
    </svg>
  );
}

export default BookPage;