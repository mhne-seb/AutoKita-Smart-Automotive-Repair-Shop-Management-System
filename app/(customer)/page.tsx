'use client'

// Route: / — public marketing home page (hero, service highlights, testimonials).
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Wrench, Cog, ShieldCheck, ChevronRight, ArrowRight, Star, Quote, CalendarCheck, Radar } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
const heroWorkshop = "/assets/hero-workshop.jpg"; 
const heroEngine = "/assets/engine.jpg"; 
const heroDiagnostic = "/assets/diagnostic.jpg"; 
const heroMaintenance = "/assets/maintenance.jpg"; 
const heroElectrical = "/assets/electrical.jpg"; 
const heroTires = "/assets/tires.jpg"; 

const heroImages = [heroWorkshop, heroMaintenance, heroElectrical, heroTires];

function useRotatingBackground(images: string[], intervalMs = 5000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [images.length, intervalMs]);

  return index;
}

/** Tracks scrollY (clamped to a max) for parallax offsets. */
function useParallax(max = 200) {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      setOffset(Math.min(window.scrollY, max));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [max]);

  return offset;
}

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
 * Bold agency-style reveal: scale + slide combo (no blur).
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

/**
 * Endsofttech-inspired section heading: small dash+eyebrow label, bold heading
 * with a navy-to-steel-blue gradient accent word, faint dot-grid backdrop, staggered reveal.
 */
function SectionHeading({
  eyebrow,
  lead,
  accent,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  lead: string;
  accent: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  const [ref, isVisible] = useScrollReveal<HTMLDivElement>(0.3);
  const isCenter = align === "center";

  return (
    <div ref={ref} className={`relative ${isCenter ? "text-center" : "text-left"}`}>
      {/* faint dot-grid backdrop */}
      <div
        className="pointer-events-none absolute -inset-x-6 -inset-y-8 -z-10 opacity-[0.5]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(11,23,48,0.14) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
          maskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 80%)",
        }}
      />

      <div
        className={`inline-flex items-center gap-2 transition-all duration-700 ${
          isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
        }`}
      >
        <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: "#0b1730" }} />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </span>
      </div>

      <h2
        className={`mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
        style={{ color: "#0b1730", transitionDelay: isVisible ? "120ms" : "0ms" }}
      >
        {lead}{" "}
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(90deg, #0b1730 0%, #1d3a68 50%, #3b6cb4 100%)",
            textShadow: "0 1px 24px rgba(11,23,48,0.12)",
          }}
        >
          {accent}
        </span>
      </h2>

      {subtitle && (
        <p
          className={`mt-3 max-w-xl text-sm text-muted-foreground transition-all duration-700 ${
            isCenter ? "mx-auto" : ""
          } ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
          style={{ transitionDelay: isVisible ? "240ms" : "0ms" }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

/** Animated count-up for stat numbers. Parses leading numeric value out of a display string. */
function useCountUp(target: string, isActive: boolean, durationMs = 1400) {
  const [display, setDisplay] = useState(target.replace(/[0-9.]+/, "0"));
  const started = useRef(false);

  useEffect(() => {
    if (!isActive || started.current) return;
    started.current = true;

    const match = target.match(/[0-9]+(\.[0-9]+)?/);
    if (!match) {
      setDisplay(target);
      return;
    }
    const numeric = parseFloat(match[0]);
    const decimals = match[0].includes(".") ? match[0].split(".")[1].length : 0;
    const prefix = target.slice(0, match.index);
    const suffix = target.slice((match.index ?? 0) + match[0].length);

    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      const value = numeric * eased;
      setDisplay(`${prefix}${value.toFixed(decimals)}${suffix}`);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isActive, target, durationMs]);

  return display;
}

function StatCounter({ value, label, isActive, delayMs = 0 }: { value: string; label: string; isActive: boolean; delayMs?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => setReady(true), delayMs);
    return () => clearTimeout(t);
  }, [isActive, delayMs]);
  const display = useCountUp(value, ready);

  return (
    <div>
      <div className="text-2xl font-bold tabular-nums">{display}</div>
      <div className="text-xs uppercase tracking-wide text-white/70">{label}</div>
    </div>
  );
}

const expandingServices = [
  {
    num: "01",
    label: "Oil Change",
    badge: "OIL CHANGE",
    title: "Oil Change",
    desc: "Premium synthetic oil changes using high-grade filters to extend engine life and efficiency.",
    feature: "PREMIUM SYNTHETIC OIL",
    img: "/assets/engine/e1.png",
  },
  {
    num: "02",
    label: "Maintenance",
    badge: "MAINTENANCE",
    title: "Maintenance",
    desc: "Periodic multi-point inspections and preventative maintenance for long-term reliability.",
    feature: "ALWAYS PROTECTED",
    img: "/assets/maintenance/m1.jpg",
  },
  {
    num: "03",
    label: "Diagnostics",
    badge: "DIAGNOSTICS",
    title: "Diagnostics",
    desc: "Computerized system checks covering electrical, fuel, and transmission components.",
    feature: "FULL SYSTEM SCAN",
    img: "/assets/diagnostic/c4.jpg",
  },
  {
    num: "04",
    label: "Engine & Transmission",
    badge: "ENGINE & TRANSMISSION",
    title: "Engine & Transmission",
    desc: "Deep diagnostic scanning and mechanical inspections to identify hidden issues early.",
    feature: "CERTIFIED TECHNICIANS",
    img: "/assets/engine/e2.jpg",
  },
  {
    num: "05",
    label: "Electrical & AC",
    badge: "ELECTRICAL & AC",
    title: "Electrical & AC",
    desc: "Battery, wiring, and climate system checks to keep every circuit and vent running right.",
    feature: "FULL CIRCUIT CHECK",
    img: "/assets/electrical.jpg",
  },
  {
    num: "06",
    label: "Tires & Brakes",
    badge: "TIRES & BRAKES",
    title: "Tires & Brakes",
    desc: "Tread, alignment, and brake system inspections so you stop safely every time.",
    feature: "SAFETY FIRST",
    img: "/assets/tire/t1.jpg",
  },
];

/**
 * Endsofttech-style expanding panel strip: hover (or click/focus) a panel to widen it and
 * reveal its content. Navy palette throughout. Auto-cycles through panels when idle so the
 * strip feels alive on first load, and pauses the moment the user interacts. Desktop/tablet only —
 * see MobileServicesAccordion for the small-screen equivalent.
 */
function ExpandingServices() {
  const [active, setActive] = useState(2);
  const [isPaused, setIsPaused] = useState(false);
  const activeWidth = 32;
  const restWidth = (100 - activeWidth) / (expandingServices.length - 1);

  // Auto-advance through the panels while the user isn't interacting.
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setActive((prev) => (prev + 1) % expandingServices.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [isPaused]);

  return (
    <div>
      <div
        className="flex h-[560px] w-full overflow-hidden md:h-[640px]"
        onMouseLeave={() => setIsPaused(false)}
      >
        {expandingServices.map((s, i) => {
          const isActive = i === active;
          return (
            <div
              key={s.title}
              tabIndex={0}
              role="button"
              aria-label={`Show ${s.title} details`}
              aria-current={isActive}
              onMouseEnter={() => {
                setActive(i);
                setIsPaused(true);
              }}
              onFocus={() => {
                setActive(i);
                setIsPaused(true);
              }}
              onClick={() => {
                setActive(i);
                setIsPaused(true);
              }}
              className="group relative h-full cursor-pointer overflow-hidden transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] focus:outline-none"
              style={{ width: `${isActive ? activeWidth : restWidth}%` }}
            >
              {/* background image — fitted, no zoom-crop on load, gentle zoom only on hover */}
              <img
                src={s.img}
                alt={s.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />

              {/* navy tint overlay */}
              <div
                className="absolute inset-0 transition-opacity duration-500"
                style={{
                  backgroundColor: "#0b1730",
                  opacity: isActive ? 0.35 : 0.7,
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#050b18]/80 via-[#0b1730]/10 to-transparent" />
              {isActive && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to right, rgba(248,250,252,0.97), rgba(248,250,252,0.85) 55%, rgba(248,250,252,0.25))",
                  }}
                />
              )}

              {/* number, bottom-left, faint */}
              <div className="absolute bottom-4 left-4 select-none text-5xl font-bold text-white/25 md:text-6xl">
                {s.num}
              </div>

              {/* vertical label — visible only when collapsed */}
              <div
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  isActive ? "pointer-events-none opacity-0" : "opacity-100"
                }`}
              >
                <span
                  className="whitespace-nowrap text-sm font-medium tracking-widest text-white/90"
                  style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                >
                  {s.label}
                </span>
              </div>

              {/* expanded content */}
              <div
                className={`absolute inset-0 flex flex-col justify-center gap-4 px-6 transition-all duration-500 ${
                  isActive ? "opacity-100 translate-x-0 delay-150" : "pointer-events-none opacity-0 -translate-x-4"
                }`}
              >
                <span
                  className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
                  style={{ backgroundColor: "#0b17301a", color: "#0b1730" }}
                >
                  {s.badge}
                </span>
                <h3 className="max-w-xs text-2xl font-bold text-[#0b1730] md:text-3xl">{s.title}</h3>
                <p className="max-w-xs text-sm text-slate-700">{s.desc}</p>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <ShieldCheck className="h-4 w-4" style={{ color: "#0b1730" }} />
                  {s.feature}
                </div>
                <Link
                  href="/services"
                  className="mt-1 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: "#0b1730" }}
                >
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* progress dots — doubles as manual navigation and a "story progress" cue */}
      <div className="mt-5 flex items-center justify-center gap-2">
        {expandingServices.map((s, i) => (
          <button
            key={s.title}
            onClick={() => {
              setActive(i);
              setIsPaused(true);
            }}
            aria-label={`Jump to ${s.title}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === active ? "w-7 bg-[#0b1730]" : "w-1.5 bg-[#0b17301a] hover:bg-[#0b173040]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Vertical accordion equivalent of ExpandingServices for small screens, where hover
 * has no meaning. Tapping a row expands it in place with its photo, description, and CTA.
 */
function MobileServicesAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(2);

  return (
    <div className="flex flex-col gap-3">
      {expandingServices.map((s, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={s.title}
            className="overflow-hidden rounded-2xl border transition-colors duration-300"
            style={{ borderColor: isOpen ? "#0b173033" : undefined }}
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 p-4 text-left"
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-[#0b1730]/20">{s.num}</span>
                <span className="font-semibold" style={{ color: "#0b1730" }}>{s.title}</span>
              </div>
              <ChevronRight
                className={`h-4 w-4 flex-shrink-0 transition-transform duration-300 ${isOpen ? "rotate-90" : ""}`}
                style={{ color: "#0b1730" }}
              />
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="relative h-40 w-full overflow-hidden">
                  <img src={s.img} alt={s.title} className="h-full w-full object-cover" />
                  <div className="absolute inset-0" style={{ backgroundColor: "#0b1730", opacity: 0.35 }} />
                </div>
                <div className="space-y-3 p-4">
                  <p className="text-sm text-slate-700">{s.desc}</p>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <ShieldCheck className="h-4 w-4" style={{ color: "#0b1730" }} />
                    {s.feature}
                  </div>
                  <Link
                    href="/services"
                    className="inline-flex w-fit items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold text-white"
                    style={{ backgroundColor: "#0b1730" }}
                  >
                    Explore <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
/* Simple flat icon badge — soft ring + solid circle, subtle pulse ring   */
/* animation. Replaces the old layered/gradient "realistic" icon set.     */
/* ---------------------------------------------------------------------- */
function StepIconBadge({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="relative flex h-[72px] w-[72px] items-center justify-center">
      {/* soft outer ring */}
      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "#0b17300f" }} />
      {/* animated pulse ring */}
      <div
        className="absolute inset-0 rounded-full animate-ping"
        style={{ backgroundColor: "#0b173022", animationDuration: "2.5s" }}
      />
      {/* solid inner circle with icon */}
      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white transition-transform duration-300 group-hover:scale-110"
        style={{ backgroundColor: "#0b1730" }}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  );
}

const steps = [
  { Icon: CalendarCheck, num: "STEP 01", title: "Easy Online Booking", desc: "Select your service, pick a preferred time, and confirm in seconds." },
  { Icon: Wrench, num: "STEP 02", title: "Expert Service", desc: "Our certified technicians work on your car with precision and care." },
  { Icon: Radar, num: "STEP 03", title: "Real-time Tracking", desc: "Monitor progress from your dashboard and get notified on completion." },
];

const testimonials = [
  { name: "Sarah Ignacio", role: "Tesla Model 3 Owner", quote: "The transparency here is unmatched. I loved being able to track exactly what stage my engine check was at.", color: "bg-warning/20 text-warning", rating: 5 },
  { name: "Michael Chen", role: "BMW X5 Owner", quote: "Fast, efficient, and very professional. The AI chatbot helped me book an appointment in under a minute.", color: "bg-brand-soft text-brand", rating: 5 },
  { name: "Roberto Jr.", role: "Ford F-150 Owner", quote: "Finally a mechanic I can trust. The dashboard summary made it so easy to understand what was fixed and why.", color: "bg-destructive/15 text-destructive", rating: 4 },
];

function Home() {
  useEffect(() => { document.title = "AutoKita — Expert Care for Your Vehicle"; }, []);

  const bgIndex = useRotatingBackground(heroImages, 5000);
  const parallaxOffset = useParallax(300);
  const [statsRef, statsVisible] = useScrollReveal<HTMLDivElement>(0.4);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <Header variant="transparent" />
        <section className="relative h-[640px] overflow-hidden bg-brand">
          {/* Rotating background images with crossfade + parallax drift */}
          {heroImages.map((img, i) => (
            <div
              key={img}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out will-change-transform"
              style={{
                backgroundImage: `url(${img})`,
                opacity: i === bgIndex ? 1 : 0,
                transform: `translateY(${parallaxOffset * 0.35}px) scale(1.1)`,
              }}
            />
          ))}

          {/* Dark gradient so text stays readable, but photo still shows through */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand/80 via-brand/45 to-brand/10" />

          {/* soft glow — drifts opposite the parallax for depth */}
          <div
            className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
            style={{ transform: `translateY(${parallaxOffset * 0.15}px)` }}
          />
          <div
            className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-teal/20 blur-3xl"
            style={{ transform: `translateY(${-parallaxOffset * 0.1}px)` }}
          />

          <div
            className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-6 pt-16 text-white"
            style={{ transform: `translateY(${parallaxOffset * 0.2}px)`, opacity: 1 - parallaxOffset / 500 }}
          >
            <span className="mb-6 inline-flex w-fit items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs backdrop-blur animate-fade-up">
              Certified Technicians & Genuine Parts
            </span>
            <h1 className="max-w-2xl text-5xl font-bold leading-tight md:text-6xl animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Expert Care for<br />Your Vehicle
            </h1>
            <p className="mt-5 max-w-lg text-sm text-white/80 md:text-base animate-fade-up" style={{ animationDelay: "0.2s" }}>
              Experience next-generation automotive service with real-time tracking, transparent pricing, and professional care you can trust.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <Link href="/book" className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-white/90 hover:scale-105 transition-transform">
                Book Service Now
              </Link>
              <Link href="/services" className="rounded-md border border-white/40 bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">
                Our Services
              </Link>
            </div>
            <div ref={statsRef} className="mt-12 flex gap-10 text-white animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <StatCounter value="15k+" label="Services Done" isActive={statsVisible} delayMs={0} />
              <div className="border-l border-white/20 pl-10">
                <StatCounter value="4.9/5" label="User Rating" isActive={statsVisible} delayMs={150} />
              </div>
              <div className="border-l border-white/20 pl-10">
                <StatCounter value="100%" label="Transparency" isActive={statsVisible} delayMs={300} />
              </div>
            </div>
          </div>
        </section>

      </div>

      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="OUR SERVICES"
            lead="Our Professional"
            accent="Services."
            subtitle="Comprehensive solutions tailored to keep your vehicle running at its absolute peak performance."
          />
        </div>
        <Reveal className="mt-12 w-full" delay={100}>
          <div className="hidden md:block">
            <ExpandingServices />
          </div>
          <div className="px-6 md:hidden">
            <MobileServicesAccordion />
          </div>
        </Reveal>
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mt-10 text-center" delay={200}>
            <Link href="/services" className="inline-flex items-center gap-1 rounded-md border px-5 py-2 text-sm font-medium hover:bg-accent">
              View All Services <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="THE PROCESS"
            lead="How It"
            accent="Works."
            subtitle="Getting your car serviced has never been easier or more transparent."
          />
          <div className="relative mt-16 grid gap-8 md:grid-cols-3">
            {/* connector line behind the cards, desktop only */}
            <div
              className="absolute left-[16.5%] right-[16.5%] top-9 hidden h-px md:block"
              style={{ background: "linear-gradient(90deg, transparent, #0b173033, #0b173033, transparent)" }}
            />
            {steps.map((s, i) => (
              <Reveal key={s.num} delay={i * 150} variant={i === 0 ? "left" : i === 2 ? "right" : "up"}>
                <div className="group relative flex h-full flex-col items-center rounded-2xl border border-transparent bg-card px-6 pb-8 pt-12 text-center shadow-sm transition-all duration-300 hover:-translate-y-2 hover:border-[#0b17301a] hover:shadow-xl">
                  <div className="absolute -top-9">
                    <StepIconBadge Icon={s.Icon} />
                  </div>
                  <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.num}</div>
                  <h3 className="mt-1 text-lg font-semibold" style={{ color: "#0b1730" }}>{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <SectionHeading
              eyebrow="TESTIMONIALS"
              lead="Loved by 10,000+"
              accent="Owners."
              align="left"
            />
            <Reveal delay={150}>
              <button className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Read All Reviews</button>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <Reveal key={t.name} delay={i * 130}>
                <div className="group relative h-full overflow-hidden rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-xl">
                  <Quote className="absolute -right-1 -top-1 h-14 w-14 text-muted-foreground/[0.06] transition-transform duration-300 group-hover:scale-110" />

                  <div className="relative flex gap-0.5">
                    {[...Array(5)].map((_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${
                          idx < t.rating ? "fill-warning text-warning" : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="relative mt-4 text-sm text-foreground/80">"{t.quote}"</p>
                  <div className="relative mt-6 flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-transform duration-300 group-hover:scale-110 ${t.color}`}>
                      {t.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background pb-20">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl bg-brand px-10 py-14 text-brand-foreground">
              <svg className="absolute right-6 top-1/2 h-56 w-56 -translate-y-1/2 text-white/10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.7 19.3l-6.4-6.4 1.4-1.4c.4-.4.4-1 0-1.4l-2.8-2.8-1.4 1.4-2.1-2.1c1.2-2 .9-4.6-.8-6.3-1.7-1.7-4.3-2-6.3-.8l3.5 3.5-2.1 2.1L2.2 1.6C1 3.6 1.3 6.2 3 7.9c1.7 1.7 4.3 2 6.3.8l2.1 2.1-1.4 1.4L21.3 22.7c.4.4 1 .4 1.4 0 .4-.4.4-1 0-1.4z" />
              </svg>
              <h2 className="max-w-lg text-3xl font-bold md:text-4xl">Ready to Give Your Vehicle the Care it Deserves?</h2>
              <p className="mt-4 max-w-lg text-sm text-white/80">
                Join thousands of happy customers and book your first service today. Get a free multi-point inspection with your first oil change!
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/book" className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-white/90">Book Now</Link>
                <Link href="/contact" className="rounded-md border border-white/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Contact Support</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Home;