'use client'

// Route: /services/[code] — detail page for one service category, resolved from the dynamic [code] segment.
import { useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { groups, getGroupByCode } from "@/controllers/servicesController";

function ServiceCategoryPage() {
  const { code } = useParams<{ code: string }>();
  const group = getGroupByCode(code);

  useEffect(() => {
    document.title = group ? `${group.name} — AutoKita` : "Services — AutoKita";
  }, [group]);

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-7xl px-6 py-24 text-center">
          <h1 className="text-2xl font-bold">Category not found</h1>
          <Link href="/services" className="mt-4 inline-block text-brand font-semibold">
            Back to Services
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      {/* Category hero */}
      <section className="relative h-64 overflow-hidden md:h-80">
        <img src={group.photo} alt={group.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand/95 via-brand/60 to-brand/20" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur">
            {group.code}
          </span>
          <h1 className="mt-4 text-3xl font-bold md:text-5xl">{group.name}</h1>
          <p className="mt-2 text-sm text-white/80">{group.items.length} services available</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        {/* Category switcher */}
        <nav className="mb-10 flex flex-wrap items-center justify-center gap-2">
          {groups.map((g) => (
            <Link
              key={g.code}
              href={`/services/${g.code.toLowerCase()}`}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                g.code === group.code
                  ? "border-brand bg-brand text-white"
                  : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              {g.name}
            </Link>
          ))}
        </nav>

        {/* Service cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {group.items.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="relative h-56 w-full overflow-hidden">
                  <img
                    src={s.image ?? group.photo}
                    alt={s.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft">
                      <Icon className="h-5 w-5 text-brand" strokeWidth={2} />
                    </div>
                    <h3 className="pt-1.5 text-lg font-bold leading-snug text-foreground">
                      {s.title}
                    </h3>
                  </div>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ServiceCategoryPage;

