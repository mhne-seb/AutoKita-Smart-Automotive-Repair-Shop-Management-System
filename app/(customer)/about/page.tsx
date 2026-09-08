'use client'

// Route: /about — public "About AutoKita" marketing page.
import { useEffect, useRef, useState } from "react";

import Link from "next/link";
import { Zap, MapPin, ShieldCheck, CheckCircle2, ChevronRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
const heroWorkshop = "/assets/hero-workshop.jpg"; // static asset path

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
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{display}</div>
    </div>
  );
}

const whyChooseUs = [
  { icon: Zap, title: "Lightning Fast Service", desc: "Our optimized workflow and digital intake system reduce wait times by 40% compared to traditional shops. Get in, get out, get moving." },
  { icon: MapPin, title: "Digital Tracking", desc: "Monitor your vehicle's progress in real-time from your dashboard. From inspection to completion, you'll never wonder what's happening." },
  { icon: ShieldCheck, title: "Expert Reliability", desc: "Every technician is ASE certified and every service is backed by our comprehensive warranty. We treat your vehicle like our own." },
];

const digitalEdge = [
  { title: "Predictive Maintenance", desc: "Our system analyzes your vehicle history to suggest care before problems arise." },
  { title: "Seamless Communication", desc: "Direct chat with your mechanic through our AI-integrated platform." },
  { title: "Paperless Management", desc: "All invoices, service logs, and inspections stored securely in the cloud." },
];

function About() {
  useEffect(() => { document.title = "About AutoKita — Revolutionizing Car Care"; }, []);

  const [statsRef, statsVisible] = useScrollReveal<HTMLDivElement>(0.4);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <Reveal variant="left">
            <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand animate-fade-up">Our Story</span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl animate-fade-up" style={{ animationDelay: "0.1s" }}>
              Revolutionizing<br />
              <span className="text-brand">Car Care</span> for<br />
              the Digital Age.
            </h1>
            <div className="mt-6 space-y-4 text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "0.2s" }}>
              <p>
                AutoKita began with a simple observation: the traditional auto repair experience was broken. Customers felt disconnected from the process, and mechanics were buried in paper logs.
              </p>
              <p>
                We set out to build a bridge. By combining master-level mechanical expertise with a cutting-edge management platform, we've transformed the garage into a transparent, tech-enabled environment where you're always in control of your vehicle's health.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <Link href="/book" className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 transition-transform hover:scale-105">Book a Service</Link>
              <Link href="/contact" className="rounded-md border px-5 py-2.5 text-sm font-semibold hover:bg-accent transition-transform hover:scale-105">Contact Support</Link>
            </div>
          </Reveal>
          <Reveal variant="right" delay={150}>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
                <img
                  src={heroWorkshop}
                  alt="AutoKita mechanics working in the shop"
                  className="h-80 w-full object-cover transition-transform duration-500 hover:scale-105"
                />
              </div>
              <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg transition-transform duration-300 hover:-translate-y-1 hover:shadow-xl">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">15,000+</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Services Completed</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y bg-background py-10">
        <div ref={statsRef} className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {[
            { label: "Expert Mechanics", value: "45+" },
            { label: "Avg. Service Time", value: "90m" },
            { label: "User Rating", value: "4.9/5" },
            { label: "Support 24/7", value: "AI Ready" },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 100}>
              <StatCounter value={s.value} label={s.label} isActive={statsVisible} delayMs={i * 100} />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <SectionHeading
            eyebrow="WHY AUTOKITA"
            lead="Why Choose"
            accent="AutoKita."
            subtitle="Traditional skill meets modern efficiency. We've redesigned the service experience from the ground up."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {whyChooseUs.map((f, i) => (
              <Reveal key={f.title} delay={i * 150} variant={i === 0 ? "left" : i === 2 ? "right" : "up"}>
                <div
                  className="group h-full rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:border-brand/40"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <Reveal variant="left">
            <SectionHeading
              eyebrow="THE DIGITAL EDGE"
              lead="The AutoKita"
              accent="Digital Edge."
              align="left"
            />
            <div className="mt-8 space-y-6">
              {digitalEdge.map((f, i) => (
                <Reveal key={f.title} delay={150 + i * 120}>
                  <div className="group flex gap-4 transition-transform duration-300 hover:translate-x-1">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand transition-transform duration-300 group-hover:scale-110" />
                    <div>
                      <h3 className="font-semibold">{f.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
          <Reveal variant="right" delay={150}>
            <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow duration-300 hover:shadow-lg">
              <div className="relative h-64 overflow-hidden rounded-lg">
                <img
                  src={heroWorkshop}
                  alt="AutoKita digital dashboard tracking a vehicle service"
                  className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand/80 via-brand/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <p className="text-xs">"The real-time tracking changed how I view car maintenance. I knew exactly when to pick up my SUV." — Sarah K.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {["bg-warning","bg-brand","bg-teal"].map((c,i) => (
                    <div
                      key={i}
                      className={`h-6 w-6 rounded-full border-2 border-background ${c} transition-transform duration-300 hover:scale-125 hover:z-10`}
                      style={{ transitionDelay: `${i * 40}ms` }}
                    />
                  ))}
                  <div className="flex h-6 items-center rounded-full border-2 border-background bg-muted px-2 text-[10px] font-medium">+3</div>
                </div>
                <a href="#" className="group inline-flex items-center gap-1 text-xs font-medium text-brand">
                  Read Testimonials
                  <ChevronRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </Reveal>
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
                <Link href="/book" className="rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-brand hover:bg-white/90 transition-transform hover:scale-105">Book Now</Link>
                <Link href="/services" className="rounded-md border border-white/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-transform hover:scale-105">Services</Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default About;