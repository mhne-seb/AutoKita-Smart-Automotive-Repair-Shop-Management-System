'use client'

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect} from "react";
import {
  Calendar, User, MapPin, Car, Wrench, ChevronRight, ChevronLeft, ChevronDown, Check, X,
  Mail, Phone, Hash, FileText, ClipboardCheck, AlertCircle,
} from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Footer } from "@/components/site/Footer";
import { useScrolled } from "@/hooks/use-scrolled";

const TIMES = ["08:00 AM", "09:30 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];
const DAYS_PER_PAGE = 5;

const STEPS = ["SCHEDULE", "CUSTOMER", "VEHICLE", "REVIEW"];

const OTHERS = "Others";

/* --- PH address data (cascading Province -> City -> Barangay) --- */
/* NOTE: the Philippines has ~42,000 barangays across ~1,600 cities/municipalities,
   so a fully exhaustive barangay list for every city isn't realistic to hardcode.
   Cities/municipalities per province below are complete for the provinces we serve.
   Barangays are filled in for the areas we most commonly service (Rizal + parts of
   Metro Manila) — any city without a hardcoded barangay list will simply show
   "Others" so the customer can type it in manually instead of guessing wrong. */

const PROVINCES = ["Metro Manila", "Rizal", "Cavite", "Laguna", "Bulacan", "Batangas", "Cebu", "Davao del Sur"];

const CITIES_BY_PROVINCE: Record<string, string[]> = {
  "Metro Manila": [
    "Manila", "Quezon City", "Makati", "Pasig", "Taguig", "Mandaluyong", "San Juan",
    "Marikina", "Pasay", "Parañaque", "Las Piñas", "Muntinlupa", "Caloocan",
    "Malabon", "Navotas", "Valenzuela", "Pateros",
  ],
  "Rizal": [
    "Antipolo", "Cainta", "Taytay", "Angono", "Binangonan", "Cardona", "Jalajala",
    "Morong", "Pililla", "Rodriguez (Montalban)", "San Mateo", "Tanay", "Teresa", "Baras",
  ],
  "Cavite": [
    "Bacoor", "Imus", "Dasmariñas", "General Trias", "Trece Martires", "Tagaytay",
    "Cavite City", "Tanza", "Naic", "Silang", "Carmona", "General Mariano Alvarez",
    "Kawit", "Noveleta", "Rosario",
  ],
  "Laguna": [
    "Calamba", "Santa Rosa", "San Pedro", "Biñan", "Cabuyao", "Los Baños",
    "San Pablo", "Santa Cruz", "Pagsanjan", "Pila",
  ],
  "Bulacan": [
    "Malolos", "Meycauayan", "San Jose del Monte", "Baliwag", "Marilao", "Bocaue",
    "Plaridel", "Guiguinto", "Pandi", "Santa Maria",
  ],
  "Batangas": [
    "Batangas City", "Lipa", "Tanauan", "Santo Tomas", "Bauan", "Nasugbu",
    "Lemery", "San Juan", "Taal",
  ],
  "Cebu": [
    "Cebu City", "Mandaue", "Lapu-Lapu", "Talisay", "Toledo", "Danao", "Carcar", "Naga",
  ],
  "Davao del Sur": [
    "Davao City", "Digos", "Bansalan", "Hagonoy", "Kiblawan", "Magsaysay",
    "Malalag", "Matanao", "Padada", "Santa Cruz", "Sulop",
  ],
};

const BARANGAYS_BY_CITY: Record<string, string[]> = {
  "Antipolo": [
    "Bagong Nayon", "Beverly Hills", "Calawis", "Cupang", "Dalig", "Dela Paz",
    "Inarawan", "Mambugan", "Mayamot", "Muntindilaw", "San Isidro", "San Jose",
    "San Juan", "San Luis", "San Roque", "Santa Cruz",
  ],
  "Cainta": [
    "San Andres", "San Isidro", "San Juan", "San Roque", "Santa Rosa", "Santo Domingo", "Santo Niño",
  ],
  "Taytay": [
    "San Juan", "San Isidro", "Santa Ana", "Dolores", "Muzon", "San Andres",
  ],
  "San Mateo": [
    "Ampid I", "Ampid II", "Banaba", "Dulong Bayan", "Guitnang Bayan I", "Malanday", "Santa Ana",
  ],
  "Angono": [
    "San Isidro", "San Roque", "Santo Niño", "Poblacion Ibaba", "Poblacion Itaas",
  ],
  "Binangonan": [
    "Layunan", "Libid", "Pantok", "Poblacion", "Tatala",
  ],
  "Quezon City": [
    "Bagong Pag-asa", "Batasan Hills", "Commonwealth", "Cubao", "Diliman",
    "Fairview", "Holy Spirit", "Kamuning", "Novaliches Proper", "Payatas",
    "Project 6", "Tandang Sora", "UP Campus",
  ],
  "Manila": [
    "Binondo", "Ermita", "Intramuros", "Malate", "Paco", "Pandacan", "Quiapo",
    "Sampaloc", "San Andres", "Santa Ana", "Santa Cruz", "Tondo",
  ],
  "Makati": [
    "Bel-Air", "Bangkal", "Guadalupe Nuevo", "Magallanes", "Poblacion",
    "San Antonio", "San Lorenzo", "Urdaneta",
  ],
  "Pasig": [
    "Kapitolyo", "Kapasigan", "Malinao", "Manggahan", "Maybunga", "Pinagbuhatan",
    "San Antonio", "San Joaquin", "Santolan", "Ugong",
  ],
};

const YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i));
const TRANSMISSIONS = ["Automatic", "Manual", "CVT", "Semi-Automatic"];
const CATEGORIES = [
  "Oil Change", "Brake Service", "Engine Diagnostics", "Tire Replacement",
  "Aircon Repair", "General Maintenance", "Car Wash & Detailing",
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

type Form = {
  date: Date; time: string;
  name: string; phone: string; email: string;
  province: string; provinceOther: string;
  city: string; cityOther: string;
  barangay: string; barangayOther: string;
  model: string;
  year: string; yearOther: string;
  transmission: string; transmissionOther: string;
  mileage: string; plate: string;
  pickup: "shop" | "home";
  category: string; categoryOther: string;
  concern: string;
};

function isStepValid(step: number, f: Form): boolean {
  switch (step) {
    case 0:
      // date/time always have a default selection, nothing to block here
      return !!f.date && !!f.time;
    case 1:
      return (
        isFilled(f.name) &&
        isValidPhone(f.phone) &&
        isValidEmail(f.email) &&
        isSelectValid(f.province, f.provinceOther) &&
        isSelectValid(f.city, f.cityOther) &&
        isSelectValid(f.barangay, f.barangayOther)
      );
    case 2:
      return (
        isFilled(f.model) &&
        isSelectValid(f.year, f.yearOther) &&
        isSelectValid(f.transmission, f.transmissionOther) &&
        isFilled(f.mileage) &&
        isFilled(f.plate) &&
        isSelectValid(f.category, f.categoryOther) &&
        isFilled(f.concern)
      );
    default:
      return true;
  }
}

function BookPage() {
  useEffect(() => { document.title = "Book a Service — AutoKita"; }, []);

  const router = useRouter();
  const scrolled = useScrolled(20);
  const [step, setStep] = useState(0); 
  const [showReview, setShowReview] = useState(false);
  const [attemptedNext, setAttemptedNext] = useState(false);

  // How many days forward from today the visible window starts (paged by DAYS_PER_PAGE)
  const [dayOffset, setDayOffset] = useState(0);

  const [f, setF] = useState<Form>({
    date: startOfToday(),
    time: TIMES.find((t) => !isPastSlot(startOfToday(), t)) ?? TIMES[0],
    name: "", phone: "", email: "",
    province: "", provinceOther: "",
    city: "", cityOther: "",
    barangay: "", barangayOther: "",
    model: "",
    year: "", yearOther: "",
    transmission: "", transmissionOther: "",
    mileage: "", plate: "",
    pickup: "shop",
    category: "", categoryOther: "",
    concern: "",
  });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const selectProvince = (v: string) => {
    // changing province invalidates whatever city/barangay was picked before
    setF((p) => ({
      ...p,
      province: v,
      provinceOther: v === OTHERS ? p.provinceOther : "",
      city: "", cityOther: "",
      barangay: "", barangayOther: "",
    }));
  };

  const selectCity = (v: string) => {
    // changing city invalidates whatever barangay was picked before
    setF((p) => ({
      ...p,
      city: v,
      cityOther: v === OTHERS ? p.cityOther : "",
      barangay: "", barangayOther: "",
    }));
  };

  const next = () => {
    if (!isStepValid(step, f)) {
      setAttemptedNext(true);
      return;
    }
    setAttemptedNext(false);
    setStep((s) => Math.min(3, s + 1));
  };
  const back = () => {
    setAttemptedNext(false);
    setStep((s) => Math.max(0, s - 1));
  };

  const visibleDays = Array.from({ length: DAYS_PER_PAGE }, (_, i) => addDays(startOfToday(), dayOffset + i));

  const selectDate = (d: Date) => {
    set("date", d);
    // If the currently selected time is already past for the newly picked date, bump to next available
    if (isPastSlot(d, f.time)) {
      const firstAvailable = TIMES.find((t) => !isPastSlot(d, t));
      if (firstAvailable) set("time", firstAvailable);
    }
  };

  const cityOptions = f.province && f.province !== OTHERS ? CITIES_BY_PROVINCE[f.province] ?? [] : [];
  const barangayOptions = f.city && f.city !== OTHERS ? BARANGAYS_BY_CITY[f.city] ?? [] : [];

  const currentStepValid = isStepValid(step, f);
  const showError = attemptedNext && !currentStepValid;

  return (
    <div className="min-h-screen bg-background">
      <header className={`fixed top-0 left-0 right-0 z-50 glass-nav ${scrolled ? "glass-nav-scrolled" : ""}`}>
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="text-foreground"><Logo /></Link>
          <nav className="hidden gap-8 text-sm md:flex">
            <Link href="/" className="text-muted-foreground">Home</Link>
            <Link href="/about" className="text-muted-foreground">About</Link>
            <Link href="/contact" className="text-muted-foreground">Contact</Link>
            <Link href="/services" className="text-muted-foreground">Services</Link>
          </nav>
          <Link href="/login" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">Log in</Link>
        </div>
      </header>
      <div className="h-16" />

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
                <div className="mb-3 flex items-center justify-between">
                  <button
                    onClick={() => setDayOffset((o) => Math.max(0, o - DAYS_PER_PAGE))}
                    disabled={dayOffset === 0}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Prev
                  </button>
                  <button
                    onClick={() => setDayOffset((o) => o + DAYS_PER_PAGE)}
                    className="flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
                  >
                    Next <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {visibleDays.map((day) => {
                    const sel = isSameDay(day, f.date);
                    const today = isToday(day);
                    const label = formatDayLabel(day);
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => selectDate(day)}
                        className={`relative rounded-lg border p-3 text-center transition ${
                          sel ? "border-brand bg-brand text-brand-foreground scale-105 shadow-lg" : "hover:bg-accent"
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
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {TIMES.map((t) => {
                    const sel = f.time === t;
                    const past = isPastSlot(f.date, t);
                    return (
                      <button
                        key={t}
                        onClick={() => !past && set("time", t)}
                        disabled={past}
                        title={past ? "This time has already passed for today" : undefined}
                        className={`rounded-md border py-2.5 text-sm transition ${
                          past
                            ? "cursor-not-allowed border-dashed text-muted-foreground/40"
                            : sel
                            ? "border-brand bg-brand text-brand-foreground"
                            : "hover:border-brand hover:bg-brand-soft"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </Section>
            </>
          )}

          {step === 1 && (
            <>
              <Section icon={User} title="Customer Details" subtitle="Tell us how to reach you.">
                <div className="space-y-4 rounded-lg border p-5">
                  <IField
                    icon={User} label="Full Name" required value={f.name} onChange={(v) => set("name", v)}
                    placeholder="Enter name"
                    error={showError && !isFilled(f.name) ? "Full name is required" : undefined}
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <IField
                      icon={Phone} label="Contact Number" required value={f.phone} onChange={(v) => set("phone", v)}
                      placeholder="e.g., 09951234567"
                      error={showError && !isValidPhone(f.phone) ? "Enter a valid PH mobile number" : undefined}
                    />
                    <IField
                      icon={Mail} label="Email Address" required value={f.email} onChange={(v) => set("email", v)}
                      placeholder="you@email.com"
                      error={showError && !isValidEmail(f.email) ? "Enter a valid email address" : undefined}
                    />
                  </div>
                </div>
              </Section>
              <Section icon={MapPin} title="Location Information" subtitle="Where should we serve you?">
                <div className="rounded-lg border p-5">
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
                      disabled={!f.province || f.province === OTHERS}
                      otherValue={f.cityOther} onOtherChange={(v) => set("cityOther", v)}
                      error={showError && !isSelectValid(f.city, f.cityOther) ? "City is required" : undefined}
                    />
                    <SelectField
                      icon={MapPin} label="Barangay" required value={f.barangay}
                      onChange={(v) => set("barangay", v)} options={barangayOptions}
                      placeholder={f.city ? "Select barangay" : "Select city first"}
                      disabled={!f.city || f.city === OTHERS}
                      otherValue={f.barangayOther} onOtherChange={(v) => set("barangayOther", v)}
                      error={showError && !isSelectValid(f.barangay, f.barangayOther) ? "Barangay is required" : undefined}
                    />
                  </div>
                  {f.city && barangayOptions.length === 0 && f.city !== OTHERS && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      We don't have a barangay list for {f.city} yet — choose "Others" and type it in.
                    </p>
                  )}
                </div>
              </Section>
            </>
          )}

          {step === 2 && (
            <>
              <Section icon={Car} title="Vehicle Details" subtitle="Help our team prepare the right tools.">
                <div className="grid gap-4 md:grid-cols-2">
                  <IField
                    icon={Car} label="Vehicle Model" required value={f.model} onChange={(v) => set("model", v)}
                    placeholder="e.g., Toyota Camry 2022"
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
                    icon={Hash} label="License Plate" required value={f.plate} onChange={(v) => set("plate", v)}
                    placeholder="e.g., ABC-1234"
                    error={showError && !isFilled(f.plate) ? "License plate is required" : undefined}
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
                    onChange={(v) => set("category", v)} options={CATEGORIES}
                    placeholder="Select a service"
                    otherValue={f.categoryOther} onOtherChange={(v) => set("categoryOther", v)}
                    error={showError && !isSelectValid(f.category, f.categoryOther) ? "Service category is required" : undefined}
                  />
                </div>
                <div className="mt-5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                    <FileText className="h-3 w-3" /> Concern <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={f.concern}
                    onChange={(e) => set("concern", e.target.value)}
                    className={`mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none ${
                      showError && !isFilled(f.concern) ? "border-red-400 focus:border-red-400" : "focus:border-brand"
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
                <AlertCircle className="h-3.5 w-3.5" /> Please complete all required fields before continuing.
              </p>
            )}
            <div className="flex items-center justify-between">
              <button
                onClick={back}
                disabled={step === 0}
                className="flex items-center gap-2 rounded-md border px-5 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
              {step < 3 ? (
                <button
                  onClick={next}
                  className={`flex items-center gap-2 rounded-md px-6 py-2.5 text-sm font-semibold transition ${
                    currentStepValid
                      ? "bg-brand text-brand-foreground hover:opacity-90"
                      : "cursor-not-allowed bg-muted text-muted-foreground"
                  }`}
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowReview(true)}
                  className="flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90"
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
            <div className="flex items-center justify-between border-b bg-brand px-6 py-4 text-white">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                <h3 className="font-semibold">Please Review Your Booking</h3>
              </div>
              <button onClick={() => setShowReview(false)} className="rounded p-1 hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
              <ReviewGrid f={f} />
            </div>
            <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-4">
              <button
                onClick={() => setShowReview(false)}
                className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
              >
                Edit
              </button>
              <button
                onClick={() => router.push("/booking-confirmed")}
                className="flex items-center gap-2 rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
              >
                <Check className="h-4 w-4" /> Confirm Booking
              </button>
            </div>
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
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  active
                    ? "border-brand bg-brand text-brand-foreground scale-110 shadow-md shadow-brand/30"
                    : done
                    ? "border-brand/60 bg-brand-soft text-brand"
                    : "border-border bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div
                className={`text-[10px] font-semibold tracking-wide transition-colors ${
                  active ? "text-brand" : done ? "text-foreground" : "text-muted-foreground"
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
  icon: Icon, label, value, onChange, placeholder, required, error,
}: {
  icon: any; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  required?: boolean; error?: string;
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
          className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${
            error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
          }`}
        />
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
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
          className={`w-full appearance-none rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none disabled:opacity-60 ${
            error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
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

function ReviewGrid({ f, compact }: { f: Form; compact?: boolean }) {
  const province = f.province === OTHERS ? f.provinceOther : f.province;
  const city = f.city === OTHERS ? f.cityOther : f.city;
  const barangay = f.barangay === OTHERS ? f.barangayOther : f.barangay;
  const year = f.year === OTHERS ? f.yearOther : f.year;
  const transmission = f.transmission === OTHERS ? f.transmissionOther : f.transmission;
  const category = f.category === OTHERS ? f.categoryOther : f.category;

  const rows: [any, string, string][] = [
    [Calendar, "Date & Time", `${formatFullDate(f.date)} · ${f.time}`],
    [User, "Customer", f.name || "—"],
    [Phone, "Contact", f.phone || "—"],
    [Mail, "Email", f.email || "—"],
    [MapPin, "Location", [barangay, city, province].filter(Boolean).join(", ") || "—"],
    [Car, "Vehicle", [f.model, year].filter(Boolean).join(" · ") || "—"],
    [Settings2Icon, "Transmission", transmission || "—"],
    [Hash, "License Plate", f.plate || "—"],
    [Wrench, "Service", category || "—"],
    [MapPin, "Pick Up", f.pickup === "shop" ? "Shop Visit" : "Home Service"],
    [FileText, "Concern", f.concern || "—"],
  ];
  return (
    <div className={`grid gap-3 ${compact ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
      {rows.map(([Icon, label, val]) => (
        <div key={label} className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
            <div className="truncate text-sm font-medium">{val}</div>
          </div>
        </div>
      ))}
    </div>
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
