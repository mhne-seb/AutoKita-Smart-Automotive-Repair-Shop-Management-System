import Link from "next/link";
import { Package, Search, FileText, Wrench, CheckCircle2, type LucideIcon } from "lucide-react";

const STAGES: { key: string; label: string; icon: LucideIcon; to: string }[] = [
  { key: "received", label: "RECEIVED", icon: Package, to: "/dashboard/tracking/received" },
  { key: "inspecting", label: "INSPECTING", icon: Search, to: "/dashboard/tracking/inspecting" },
  { key: "quotation", label: "QUOTATION", icon: FileText, to: "/dashboard/tracking/quotation" },
  { key: "in-progress", label: "IN PROGRESS", icon: Wrench, to: "/dashboard/tracking/in-progress" },
  { key: "completed", label: "COMPLETED", icon: CheckCircle2, to: "/dashboard/tracking/completed" },
];

export function StageStepper({ active }: { active: (typeof STAGES)[number]["key"] }) {
  const activeIdx = STAGES.findIndex((s) => s.key === active);

  return (
    <div className="mx-auto max-w-4xl rounded-2xl border bg-card px-8 py-6">
      <div className="flex items-start">
        {STAGES.map((s, i) => {
          const Icon = s.icon;
          const isDone = i < activeIdx;
          const isCurrent = i === activeIdx;
          const isActive = isDone || isCurrent;

          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <Link href={s.to} className="flex flex-col items-center gap-1.5">
                <div className="relative flex h-10 w-10 items-center justify-center">
                  {isCurrent && (
                    <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
                  )}
                  <div
                    className={`relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform duration-300 ${
                      isActive
                        ? "border-brand bg-brand text-white"
                        : "border-muted bg-muted/50 text-muted-foreground"
                    } ${isCurrent ? "scale-110" : ""}`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={2.5} />
                  </div>
                </div>
                <span
                  className={`whitespace-nowrap text-[10px] font-bold uppercase leading-none tracking-wider transition-colors duration-300 ${
                    isActive ? "text-brand" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </Link>

              {i < STAGES.length - 1 && (
                <div
                  className={`-mt-5 h-0.5 flex-1 transition-colors duration-300 ${
                    isDone ? "bg-brand" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}