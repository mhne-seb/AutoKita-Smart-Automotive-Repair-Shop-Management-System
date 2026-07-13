'use client'

// Route: / — public marketing home page (hero, service highlights, testimonials).
import { useState, useEffect } from "react";
import Link from "next/link";
import { Wrench, Cog, Search, Clock, Zap, ShieldCheck, ChevronRight, Star } from "lucide-react";
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

const services = [
  { icon: Wrench, title: "Oil Change", desc: "Premium synthetic oil changes using high-grade filters to extend engine life and efficiency." },
  { icon: Cog, title: "Engine Check", desc: "Deep diagnostic scanning and mechanical inspections to identify hidden issues early." },
  { icon: Search, title: "Diagnostics", desc: "Computerized system checks covering electrical, fuel, and transmission components." },
  { icon: Clock, title: "Maintenance", desc: "Periodic multi-point inspections and preventative maintenance for long-term reliability." },
];

const steps = [
  { icon: Zap, num: "STEP 01", title: "Easy Online Booking", desc: "Select your service, pick a preferred time, and confirm in seconds." },
  { icon: ShieldCheck, num: "STEP 02", title: "Expert Service", desc: "Our certified technicians work on your car with precision and care." },
  { icon: Search, num: "STEP 03", title: "Real-time Tracking", desc: "Monitor progress from your dashboard and get notified on completion." },
];

const testimonials = [
  { name: "Sarah Ignacio", role: "Tesla Model 3 Owner", quote: "The transparency here is unmatched. I loved being able to track exactly what stage my engine check was at.", color: "bg-warning/20 text-warning" },
  { name: "Michael Chen", role: "BMW X5 Owner", quote: "Fast, efficient, and very professional. The AI chatbot helped me book an appointment in under a minute.", color: "bg-brand-soft text-brand" },
  { name: "Roberto Jr.", role: "Ford F-150 Owner", quote: "Finally a mechanic I can trust. The dashboard summary made it so easy to understand what was fixed and why.", color: "bg-destructive/15 text-destructive" },
];

function Home() {
  useEffect(() => { document.title = "AutoKita — Expert Care for Your Vehicle"; }, []);

  const bgIndex = useRotatingBackground(heroImages, 5000);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative">
        <Header variant="transparent" />
        <section className="relative h-[640px] overflow-hidden bg-brand">
          {/* Rotating background images with crossfade */}
          {heroImages.map((img, i) => (
            <div
              key={img}
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
              style={{
                backgroundImage: `url(${img})`,
                opacity: i === bgIndex ? 1 : 0,
              }}
            />
          ))}

          {/* Dark gradient so text stays readable, but photo still shows through */}
          <div className="absolute inset-0 bg-gradient-to-r from-brand/80 via-brand/45 to-brand/10" />

          {/* soft glow */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-teal/20 blur-3xl" />

          <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-6 pt-16 text-white">
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
            <div className="mt-12 flex gap-10 text-white animate-fade-up" style={{ animationDelay: "0.4s" }}>
              <div><div className="text-2xl font-bold">15k+</div><div className="text-xs uppercase tracking-wide text-white/70">Services Done</div></div>
              <div className="border-l border-white/20 pl-10"><div className="text-2xl font-bold">4.9/5</div><div className="text-xs uppercase tracking-wide text-white/70">User Rating</div></div>
              <div className="border-l border-white/20 pl-10"><div className="text-2xl font-bold">100%</div><div className="text-xs uppercase tracking-wide text-white/70">Transparency</div></div>
            </div>
          </div>
        </section>

      </div>

      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold md:text-4xl">Our Professional Services</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Comprehensive solutions tailored to keep your vehicle running at its absolute peak performance.
            </p>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <div
                key={s.title}
                className="group rounded-xl border bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:border-brand/40"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-5 font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                <Link href="/services" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand">
                  Learn More <ChevronRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/services" className="inline-flex items-center gap-1 rounded-md border px-5 py-2 text-sm font-medium hover:bg-accent">
              View All Services <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-bold md:text-4xl">How It Works</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Getting your car serviced has never been easier or more transparent.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map((s) => (
              <div
                key={s.num}
                className="group text-center transition-all duration-300 hover:-translate-y-2"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.num}</div>
                <h3 className="mt-1 font-semibold">{s.title}</h3>
                <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold md:text-4xl">Loved by 10,000+ Owners</h2>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                Don't just take our word for it. Here's what our customers have to say about their AutoKita experience.
              </p>
            </div>
            <button className="rounded-md border px-4 py-2 text-sm hover:bg-accent">Read All Reviews</button>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg"
              >
                <div className="flex gap-0.5 text-muted-foreground/40">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5" />)}
                </div>
                <p className="mt-4 text-sm text-foreground/80">"{t.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold ${t.color}`}>
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background pb-20">
        <div className="mx-auto max-w-7xl px-6">
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
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default Home;
