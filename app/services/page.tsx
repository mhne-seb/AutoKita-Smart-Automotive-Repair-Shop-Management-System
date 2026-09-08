// Route: /services — public services catalog (grouped by category), reads from the mock services controller.
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { groups } from "@/controllers/servicesController";

export const metadata: Metadata = {
  title: "Services — Elite Care for Your Premium Vehicle | AutoKita",
  description: "Complete automotive services: maintenance, diagnostics, engine & transmission, electrical, tires & brakes.",
};

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-16 text-center">
        {/* Section heading: dash + eyebrow label, gradient accent word — matches Home/About/Contact styling. */}
        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 opacity-[0.5]"
            style={{
              backgroundImage: "radial-gradient(circle, rgba(11,23,48,0.14) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
            }}
          />
          <div className="inline-flex items-center justify-center gap-2 animate-fade-up">
            <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: "#0b1730" }} />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              OUR SERVICES
            </span>
          </div>
          <h1
            className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight md:text-5xl animate-fade-up"
            style={{ color: "#0b1730", animationDelay: "0.1s" }}
          >
            Elite Care for Your <br />
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: "linear-gradient(90deg, #0b1730 0%, #1d3a68 50%, #3b6cb4 100%)",
                textShadow: "0 1px 24px rgba(11,23,48,0.12)",
              }}
            >
              Premium Vehicle
            </span>
          </h1>
          <p
            className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground animate-fade-up"
            style={{ animationDelay: "0.2s" }}
          >
            Comprehensive solutions tailored to keep your vehicle running at its absolute peak performance. Experience transparency, precision, and world-class craftsmanship.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, gi) => (
            <Link
              key={g.name}
              href={`/services/${g.code.toLowerCase()}`}
              className="group relative block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-up"
              style={{ animationDelay: `${0.3 + gi * 0.08}s` }}
            >
              <div className="relative h-40 overflow-hidden">
                <img
                  src={g.photo}
                  alt={g.name}
                  className="h-full w-full scale-100 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand/90 via-brand/40 to-brand/10" />
                <div className="shine-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-semibold text-brand">
                  {g.name}
                </span>
                <div className="absolute bottom-3 left-3 text-white">
                  <div className="text-lg font-bold">{g.name}</div>
                  <div className="text-[11px] text-white/80">{g.items.length} services available</div>
                </div>
              </div>
              <div className="flex items-center justify-between p-5">
                <span className="text-sm text-muted-foreground">View all {g.items.length} services</span>
                <span className="flex items-center gap-1 text-sm font-semibold text-brand transition group-hover:gap-2">
                  Explore <ChevronRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}