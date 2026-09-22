"use client";

// Customer "Testing" stage — read-only view of the road test(s) on their
// vehicle. Every job is driven before release; a failed attempt sends the
// ticked services back to the floor at no extra cost, a passed one completes
// the job. Polls while the vehicle is on the road so the result shows up on
// its own.

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Gauge, CheckCircle2, XCircle, Clock, AlertCircle, Wrench, ShieldCheck, ArrowRight } from "lucide-react";
import { StageStepper, stageForStatus } from "@/components/dashboard/StageStepper";
import { Lightbox } from "@/components/Lightbox";
import { getTestingData } from "@/controllers/serviceProgressController";

type TestingData = Awaited<ReturnType<typeof getTestingData>>;

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function Testing() {
  useEffect(() => { document.title = "Testing — AutoKita"; }, []);

  const searchParams = useSearchParams();
  const jobOrderIdParam = searchParams.get("jobOrderId");
  const [data, setData] = useState<TestingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoView, setPhotoView] = useState<{ url: string; label: string } | null>(null);

  const load = () => {
    const userId = Number(sessionStorage.getItem("autokita_user_id"));
    const jobOrderId = jobOrderIdParam ? Number(jobOrderIdParam) : undefined;
    return getTestingData(userId, jobOrderId).then(setData);
  };
  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobOrderIdParam]);

  // Live while the car is out (or about to go out): the verdict appears
  // without a reload, same 5 s poll as the other stages.
  const jobOrder = data?.jobOrder ?? null;
  const live = Boolean(jobOrder) && jobOrder!.status !== "completed" && jobOrder!.status !== "released";
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => { void load(); }, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, jobOrderIdParam]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!jobOrder) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-center">
        <Gauge className="mx-auto mb-4 h-12 w-12 text-brand/50" />
        <p className="text-sm text-muted-foreground">No active service to show.</p>
      </div>
    );
  }

  const history = data?.history ?? [];
  const current = data?.current ?? null;
  const passed = history.find((a) => a.result === "pass") ?? null;
  const notYetStarted = !current && !passed;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <StageStepper active={stageForStatus(jobOrder.status)} viewing="testing" jobOrderId={jobOrder.job_order_id} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          {/* ---- Where things stand ---- */}
          {passed ? (
            <div className="rounded-xl border border-success/40 bg-card p-6">
              <p className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="h-6 w-6 text-success" /> Road test passed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your {jobOrder.vehicle_year} {jobOrder.vehicle_model} ({jobOrder.plate_number}) was driven by {passed.testerName} on {fmt(passed.endedAt)} and the repairs held up. The service is complete.
              </p>
              {passed.notes && <p className="mt-3 rounded-lg bg-muted/30 p-3 text-sm">{passed.notes}</p>}
              <Link href={`/dashboard/tracking/completed?jobOrderId=${jobOrder.job_order_id}`} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
                View final bill <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : current ? (
            <div className="rounded-xl border border-brand/40 bg-card p-6">
              <p className="flex items-center gap-2 text-lg font-bold"><Gauge className="h-6 w-6 animate-pulse text-brand" /> Your vehicle is out on a road test</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Attempt {current.attemptNo} · {current.testerName} · started {fmt(current.startedAt)}. The mechanic is confirming the repairs hold up on the road. This page updates on its own.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-6">
              <p className="flex items-center gap-2 text-lg font-bold"><Clock className="h-6 w-6 text-muted-foreground" /> {data?.allServicesDone ? "Waiting for the road test to start" : "Services still in progress"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {data?.allServicesDone
                  ? "All services are finished. The shop will drive your vehicle to check the repairs before it's released."
                  : "The road test happens once every service is finished."}
              </p>
              {!data?.allServicesDone && (
                <Link href={`/dashboard/tracking/in-progress?jobOrderId=${jobOrder.job_order_id}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
                  <Wrench className="h-4 w-4" /> See service progress
                </Link>
              )}
            </div>
          )}

          {/* ---- Attempts ---- */}
          {history.length > 0 && (
            <div className="rounded-xl border bg-card p-6">
              <div className="border-l-4 border-brand pl-3">
                <h2 className="text-xl font-bold">Road Test Attempts</h2>
              </div>
              <div className="mt-4 space-y-3">
                {history.map((a) => (
                  <div key={a.id} className={`rounded-lg border p-4 ${a.result === "pass" ? "border-success/40" : a.result === "fail" ? "border-destructive/40" : "border-brand/40"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold">Attempt {a.attemptNo} <span className="font-normal text-muted-foreground">· {a.testerName}</span></p>
                      <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${a.result === "pass" ? "bg-success/15 text-success" : a.result === "fail" ? "bg-destructive/10 text-destructive" : "bg-brand/10 text-brand"}`}>
                        {a.result === "pass" ? <><CheckCircle2 className="h-3.5 w-3.5" /> Passed</> : a.result === "fail" ? <><XCircle className="h-3.5 w-3.5" /> Needed more work</> : <><Clock className="h-3.5 w-3.5" /> In progress</>}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{fmt(a.startedAt)}{a.endedAt ? ` → ${fmt(a.endedAt)}` : ""}</p>
                    {a.notes && <p className="mt-2 text-sm">{a.notes}</p>}
                    {a.result === "fail" && (
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {a.reworkTaskTitles.length > 0 && <p><span className="font-semibold text-foreground">Redone at no charge:</span> {a.reworkTaskTitles.join(", ")}</p>}
                        {a.failedPartNames.length > 0 && <p className="flex items-start gap-1"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /><span><span className="font-semibold text-foreground">Replaced under warranty:</span> {a.failedPartNames.join(", ")}</span></p>}
                      </div>
                    )}
                    {a.photoUrl && (
                      <button type="button" onClick={() => setPhotoView({ url: a.photoUrl!, label: `Road test attempt ${a.attemptNo}` })} className="mt-2 block overflow-hidden rounded-md border">
                        <img src={a.photoUrl} alt="" className="h-20 w-28 object-cover transition-transform hover:scale-105" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Gauge className="h-4 w-4 text-teal" /> What is the road test?</div>
            <p className="mt-2 text-xs text-muted-foreground">
              Before any vehicle is released, a mechanic drives it to confirm the repairs hold up under real conditions. If something isn't right, the affected services are redone and any failed part is replaced under warranty — at no extra cost to you.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><AlertCircle className="h-4 w-4 text-teal" /> Vehicle</div>
            <p className="mt-2 text-sm">{jobOrder.vehicle_year} {jobOrder.vehicle_model}</p>
            <p className="text-xs text-muted-foreground">{jobOrder.plate_number} · JO-{jobOrder.job_order_id}</p>
          </div>
        </div>
      </div>

      {photoView && <Lightbox url={photoView.url} label={photoView.label} onClose={() => setPhotoView(null)} />}
    </div>
  );
}

export default Testing;
