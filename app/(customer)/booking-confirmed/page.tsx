'use client'

// Route: /booking-confirmed — confirmation screen shown right after a customer submits a booking on /book.
import { useEffect } from "react";

import Link from "next/link";
import { Check, ClipboardList, Wrench, Car, Calendar, Clock, MapPin, ShieldCheck, ChevronRight } from "lucide-react";
import { Logo } from "@/components/site/Logo";
const bg = "/assets/confirmation-bg.jpg"; 

function Confirmed() {
  useEffect(() => { document.title = "Service Scheduled — AutoKita"; }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/"><Logo /></Link>
          <Link href="/login" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground">Log in</Link>
        </div>
      </header>

      <section className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <img src={bg} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-brand/70" />
        <div className="relative mx-auto max-w-3xl px-6 py-16 text-center text-white">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-success">
            <Check className="h-8 w-8 text-success" strokeWidth={3} />
          </div>
          <h1 className="mt-6 text-4xl font-bold md:text-5xl">Service Scheduled!</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/85">
            Thank you for trusting AutoKita. Your booking request is currently under review. Please wait shortly as we will contact you soon regarding your booking confirmation.
          </p>
          <div className="mx-auto mt-6 inline-flex rounded-full bg-white/95 px-4 py-1.5 text-xs font-medium text-foreground">
            Booking ID: #AC-88294-2024
          </div>

          <div className="mt-8 rounded-xl bg-background p-6 text-left text-foreground shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-brand" />
                <h2 className="font-semibold">Booking Summary</h2>
              </div>
              <span className="rounded-full bg-brand-soft px-3 py-0.5 text-xs font-medium text-brand">Confirmed</span>
            </div>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Item icon={Wrench} label="SERVICE TYPE" value="Full Synthetic Oil Change & Multi-Point Inspection" />
              <Item icon={Car} label="VEHICLE DETAILS" value="2022 Tesla Model 3 (ABC-1234)" />
              <Item icon={Calendar} label="DATE" value="Monday, November 18, 2024" />
              <Item icon={Clock} label="PICK UP OPTION" value="Shop Visit" />
              <Item icon={MapPin} label="SERVICE LOCATION" value="AutoKita Plaza - Manila, PH" />
              <Item icon={ShieldCheck} label="WARRANTY COVERAGE" value="Standard 12-Month / 12,000 Mi" />
            </div>
            <Link href="/" className="mt-6 flex items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90">
              Back to Home <ChevronRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              You can reschedule or cancel this appointment up to 24 hours before the scheduled time via your dashboard.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Item({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}

export default Confirmed;
