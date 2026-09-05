'use client'

// Route: /services/[code] — detail page for one service category, resolved from the dynamic [code] segment.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { groups, getGroupByCode } from "@/controllers/servicesController";

/**
 * Scroll-reveal hook using IntersectionObserver.
 * Fires once when the element enters the viewport.
 */
function useScrollReveal<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(node);
        }
      },
      { threshold, rootMargin: "0px 0px -80px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, isVisible] as const;
}

/**
 * Bold agency-style reveal: scale + slide combo.
 * variant "up" = standard scale/translate (default)
 * variant "left" / "right" = horizontal slide, for varied rhythm.
 */
function Reveal({
  children,
  className = "",
  delay = 0,
  variant = "up",
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: "up" | "left" | "right";
}) {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>();

  const hiddenTransform =
    variant === "left" ? "translate-x-10 -rotate-1" :
    variant === "right" ? "-translate-x-10 rotate-1" :
    "translate-y-10";

  return (
    <div
      ref={ref}
      className={`transition-all duration-[900ms] ease-out ${
        isVisible
          ? "opacity-100 translate-y-0 translate-x-0 rotate-0 scale-100"
          : `opacity-0 scale-95 ${hiddenTransform}`
      } ${className}`}
      style={{ transitionDelay: isVisible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

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
        <div className="mx-auto max-w-7xl px-6 py-24 text-center animate-fade-up">
          <h1 className="text-2xl font-bold">Category not found</h1>
          <Link href="/services" className="mt-4 inline-block text-brand font-semibold transition-transform hover:scale-105">
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
        <img
          src={group.photo}
          alt={group.name}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand/95 via-brand/60 to-brand/20" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-white">
          <span
            className="animate-fade-up rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-widest backdrop-blur"
          >
            {group.code}
          </span>
          <h1
            className="mt-4 animate-fade-up text-3xl font-bold md:text-5xl"
            style={{ animationDelay: "0.1s" }}
          >
            {group.name}
          </h1>
          <p className="mt-2 animate-fade-up text-sm text-white/80" style={{ animationDelay: "0.2s" }}>
            {group.items.length} services available
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-14">
        {/* Category switcher */}
        <Reveal>
          <nav className="mb-10 flex flex-wrap items-center justify-center gap-2">
            {groups.map((g) => (
              <Link
                key={g.code}
                href={`/services/${g.code.toLowerCase()}`}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
                  g.code === group.code
                    ? "border-brand bg-brand text-white scale-105"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted hover:scale-105"
                }`}
              >
                {g.name}
              </Link>
            ))}
          </nav>
        </Reveal>

        {/* Service cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {group.items.map((s, i) => {
            const Icon = s.icon;
            return (
              <Reveal key={s.title} delay={i * 100} variant={i % 3 === 0 ? "left" : i % 3 === 2 ? "right" : "up"}>
                <div
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative h-56 w-full overflow-hidden">
                    <img
                      src={s.image ?? group.photo}
                      alt={s.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
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
              </Reveal>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default ServiceCategoryPage;