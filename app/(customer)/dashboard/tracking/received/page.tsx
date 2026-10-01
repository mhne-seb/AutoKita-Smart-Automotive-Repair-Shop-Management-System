'use client'

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Clock, ShieldCheck, AlertCircle, Store } from "lucide-react";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { getReceivedData } from "@/controllers/serviceProgressController";
import { ShopLoading } from "@/components/ShopLoading";

function Received() {
  useEffect(() => { document.title = "Vehicle Received — AutoKita"; }, []);

  const router = useRouter();
  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<Awaited<ReturnType<typeof getReceivedData>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getReceivedData(userId, jobOrderId)
      .then((res: any) => {
        if (res?._status === 401 || res?._status === 403) {
          sessionStorage.removeItem("autokita_customer");
          sessionStorage.removeItem("autokita_user_id");
          sessionStorage.removeItem("autokita_user_name");
          router.replace('/login');
          return;
        }
        setData(res);
      })
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const jobOrder = data?.jobOrder ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;
  const isArrived = Boolean(jobOrder?.date_arrived);
  // "October 1, 2026 at 3:21 AM" — the moment the shop checked the vehicle in.
  const arrivedAt = (() => {
    if (!jobOrder?.date_arrived) return "";
    const d = new Date(jobOrder.date_arrived);
    return Number.isNaN(d.getTime())
      ? String(jobOrder.date_arrived)
      : d.toLocaleString("en-PH", { month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  })();

  if (loading) {
    return (
      <ShopLoading message="Loading your check-in" />
    );
  }

  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          You don't have any vehicle currently checked in.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active={stageForStatus(jobOrder.status, jobOrder.date_arrived)} viewing="received" jobOrderId={jobOrder.job_order_id} />

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This job order has already been completed. You're viewing a read-only record.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {isArrived ? (
            <div className="rounded-2xl bg-brand-soft/60 p-6">
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-brand-foreground"><Car className="h-6 w-6" /></div>
                <div>
                  <h2 className="text-2xl font-bold">Your Vehicle is Checked In</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vehicle: {jobOrder.vehicle_year} {jobOrder.vehicle_model} ({jobOrder.plate_number})
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs">
                      <Clock className="h-3 w-3" /> Checked in {arrivedAt}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs">
                      <ShieldCheck className="h-3 w-3" /> Security Verified
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-6 shadow-xs">
              <div className="flex items-start gap-5">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-600 text-white shadow-sm">
                  <Store className="h-6 w-6" />
                </div>
                <div className="space-y-3">
                  <div>
                    <h2 className="text-2xl font-bold text-amber-950">Booking Confirmed — Awaiting Vehicle Drop-off</h2>
                    <p className="mt-1 text-sm text-amber-900/80">
                      Vehicle: {jobOrder.vehicle_year} {jobOrder.vehicle_model} ({jobOrder.plate_number})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-900">
                      <Store className="h-3.5 w-3.5 text-amber-600" /> Awaiting Arrival at Shop
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-xs text-amber-800">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Booking Confirmed
                    </span>
                  </div>
                  <div className="rounded-xl border border-amber-200 bg-white/90 p-4 text-xs text-amber-900 leading-relaxed">
                    <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                      <Store className="h-4 w-4 text-amber-600" /> Next Step: Drop off your vehicle
                    </p>
                    <p className="mt-1">
                      Your booking has been approved by our team! Please bring your vehicle to AutoKita Repair Shop. Once our shop staff receives and securely stores your vehicle in our shop, check-in will be confirmed and the pre-diagnostic inspection will begin.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-teal" /> Your Service Team</div>
            <p className="mt-2 text-xs text-muted-foreground">
              {isArrived
                ? "A certified AutoKita technician has been assigned to your vehicle and will begin the pre-diagnostic shortly."
                : "A certified AutoKita technician has been reserved for your vehicle. Drop off your vehicle at the shop to initiate check-in and inspection."}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Received;