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
        <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">Our Professional Services</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
          Elite Care for Your <br />
          <span className="text-brand">Premium Vehicle</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
          Comprehensive solutions tailored to keep your vehicle running at its absolute peak performance. Experience transparency, precision, and world-class craftsmanship.
        </p>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="mb-8 text-center text-xs text-muted-foreground">
          
        </div>
        <div className="grid items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g, gi) => (
            <Link
              key={g.name}
              href={`/services/${g.code.toLowerCase()}`}
              className="group relative block overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-up"
              style={{ animationDelay: `${gi * 0.08}s` }}
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