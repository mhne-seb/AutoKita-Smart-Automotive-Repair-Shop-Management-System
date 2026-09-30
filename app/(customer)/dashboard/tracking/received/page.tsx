'use client'

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Car, Clock, ShieldCheck, ClipboardList, Wrench, AlertCircle, Loader2, Store } from "lucide-react";
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
  const services = data?.services ?? [];
  const customerConcern = data?.customerConcern ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;
  const isArrived = Boolean(jobOrder?.date_arrived);

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
                      <Clock className="h-3 w-3" /> Arrived {jobOrder.date_arrived}
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

          <div>
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" /> Scheduled Services</h3>
              <span className="rounded-full border px-3 py-0.5 text-xs">{services.length} Total Tasks</span>
            </div>
            <div className="mt-3 space-y-3">
              {services.map((s) => (
                <div key={s.id} className="rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-soft text-brand"><Wrench className="h-4 w-4" /></div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold">{s.service_name}</div>
                        <span className="rounded-full border px-2.5 py-0.5 text-[10px]">Pending</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{s.description_of_work}</p>
                      <div className="mt-2 text-xs text-warning">📦 Parts allocation in progress</div>
                    </div>
                  </div>
                </div>
              ))}
              {services.length === 0 && (
                <p className="text-xs text-muted-foreground">No services have been scheduled yet.</p>
              )}
            </div>
          </div>

          {customerConcern && (
            <div>
              <h3 className="flex items-center gap-2 font-semibold"><ClipboardList className="h-4 w-4" /> Service Notes</h3>
              <div className="mt-3 rounded-xl border bg-card p-5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customer Request</div>
                <p className="mt-1 text-sm italic text-muted-foreground">"{customerConcern}"</p>
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