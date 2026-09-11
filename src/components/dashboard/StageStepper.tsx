import Link from "next/link";
import { Package, Search, FileText, Wrench, CheckCircle2, Check, type LucideIcon } from "lucide-react";

const BRAND_GRADIENT = "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)";

const STAGES: { key: string; label: string; icon: LucideIcon; to: string }[] = [
  { key: "received", label: "RECEIVED", icon: Package, to: "/dashboard/tracking/received" },
  { key: "inspecting", label: "INSPECTING", icon: Search, to: "/dashboard/tracking/inspecting" },
  { key: "quotation", label: "QUOTATION", icon: FileText, to: "/dashboard/tracking/quotation" },
  { key: "in-progress", label: "IN PROGRESS", icon: Wrench, to: "/dashboard/tracking/in-progress" },
  { key: "completed", label: "COMPLETED", icon: CheckCircle2, to: "/dashboard/tracking/completed" },
];

export function StageStepper({
  active,
  jobOrderId,
  stageTimes,
}: {
  active: (typeof STAGES)[number]["key"];
  jobOrderId: number;
  // Optional timestamp per stage (e.g. { received: "02/04/2026 11:32" }).
  // A stage with no entry here simply shows no time line — pass whatever
  // your job order data has wired up so far.
  stageTimes?: Partial<Record<(typeof STAGES)[number]["key"], string>>;
}) {
  const activeIdx = STAGES.findIndex((s) => s.key === active);
  // The last stage (COMPLETED) has nothing after it — once it's reached,
  // treat it as a finished/done step rather than an in-progress "current"
  // one, so it stops pulsing and gets the green check like the others.
  const isFinalStage = activeIdx === STAGES.length - 1;
  // Fraction of the track to fill — from the center of the first dot to the
  // center of the current one, so the gradient line always ends exactly under it.
  const fillPct = (activeIdx / (STAGES.length - 1)) * 100;

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-card px-8 py-7 shadow-sm">
      <div className="relative flex items-start">
        {/* Continuous track, sitting behind the icon row */}
        <div
          className="absolute left-0 right-0 top-5 h-1 rounded-full bg-muted-foreground/25"
          style={{ marginLeft: `${100 / STAGES.length / 2}%`, marginRight: `${100 / STAGES.length / 2}%` }}
        >
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${fillPct}%`, backgroundImage: BRAND_GRADIENT }}
          />
        </div>

        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < activeIdx || (isFinalStage && i === activeIdx);
          const isCurrent = i === activeIdx && !isFinalStage;
          const isActive = isDone || isCurrent;
          const time = stageTimes?.[s.key];

          return (
            <div key={s.key} className="relative z-10 flex flex-1 flex-col items-center">
              <Link
                href={`${s.to}?jobOrderId=${jobOrderId}`}
                className="group flex flex-col items-center gap-2 transition-transform duration-200 hover:-translate-y-0.5"
              >
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                  )}
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                      isCurrent
                        ? "scale-110 border-transparent bg-brand text-white"
                        : isDone
                        ? "border-transparent bg-brand text-white shadow-sm"
                        : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                    {isDone && (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-success text-white">
                        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`whitespace-nowrap text-[10px] font-bold uppercase leading-none tracking-wider transition-colors duration-300 ${
                    isCurrent
                      ? "text-brand"
                      : isDone
                      ? "text-foreground/70 group-hover:text-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
                {time && (
                  <span className="whitespace-nowrap text-[9px] font-medium text-muted-foreground/70">
                    {time}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}