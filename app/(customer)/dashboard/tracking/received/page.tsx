'use client'

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Car, Clock, ShieldCheck, ClipboardList, Wrench, ChevronRight, Calendar, X, Loader2, AlertCircle } from "lucide-react";
import { StageStepper } from "@/components/dashboard/StageStepper";
import { getReceivedData } from "@/controllers/serviceProgressController";
import Link from "next/link";

function Received() {
  useEffect(() => { document.title = "Vehicle Received — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");

  const [data, setData] = useState<Awaited<ReturnType<typeof getReceivedData>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    setLoading(true);
    getReceivedData(userId, jobOrderId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [jobOrderIdParam]);

  const jobOrder = data?.jobOrder ?? null;
  const services = data?.services ?? [];
  const history = data?.history ?? [];
  const customerConcern = data?.customerConcern ?? null;

  const isHistorical = jobOrder ? jobOrder.status === "completed" || jobOrder.status === "released" : false;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading check-in details…
        </div>
      </div>
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
      <StageStepper active="received" jobOrderId={jobOrder.job_order_id} />

      {isHistorical && (
        <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" /> This job order has already been completed. You're viewing a read-only record.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
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
            <p className="mt-2 text-xs text-muted-foreground">A certified AutoKita technician has been assigned to your vehicle and will begin the pre-diagnostic shortly.</p>
            <Link href={`/dashboard/tracking/inspecting?jobOrderId=${jobOrder.job_order_id}`} className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-brand">
              View Live Queue <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          <button
            onClick={() => setShowHistory(true)}
            className="flex w-full items-center justify-center gap-2 rounded-md border bg-card py-2.5 text-sm font-medium transition-colors hover:border-brand hover:text-brand"
          >
            <Calendar className="h-4 w-4" /> View Service History
          </button>
        </aside>
      </div>

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold">Service History</h3>
                <p className="text-sm text-muted-foreground">{jobOrder.vehicle_year} {jobOrder.vehicle_model} · {jobOrder.plate_number}</p>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded-full border p-1 hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 divide-y">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <div className="font-semibold">{h.service_name ?? "Service"}</div>
                    <div className="text-xs text-muted-foreground">{h.jo_date}</div>
                  </div>
                  <div className="font-medium">₱{h.grand_total}</div>
                </div>
              ))}
              {history.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">No previous service history found.</p>
              )}
            </div>
            <button onClick={() => setShowHistory(false)} className="mt-4 w-full rounded-md border py-2 text-sm hover:bg-accent">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Received;