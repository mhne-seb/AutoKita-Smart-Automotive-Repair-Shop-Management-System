'use client'

// Route: /about — public "About AutoKita" marketing page.
import { useEffect } from "react";

import Link from "next/link";
import { Zap, MapPin, ShieldCheck, CheckCircle2, ChevronRight } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
const heroWorkshop = "/assets/hero-workshop.jpg"; // static asset path

function About() {
  useEffect(() => { document.title = "About AutoKita — Revolutionizing Car Care"; }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">Our Story</span>
            <h1 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">
              Revolutionizing<br />
              <span className="text-brand">Car Care</span> for<br />
              the Digital Age.
            </h1>
            <div className="mt-6 space-y-4 text-sm text-muted-foreground">
              <p>
                AutoKita began with a simple observation: the traditional auto repair experience was broken. Customers felt disconnected from the process, and mechanics were buried in paper logs.
              </p>
              <p>
                We set out to build a bridge. By combining master-level mechanical expertise with a cutting-edge management platform, we've transformed the garage into a transparent, tech-enabled environment where you're always in control of your vehicle's health.
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/book" className="rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:opacity-90 transition-transform hover:scale-105">Book a Service</Link>
              <Link href="/contact" className="rounded-md border px-5 py-2.5 text-sm font-semibold hover:bg-accent">Contact Support</Link>
            </div>
          </div>
          <div className="relative">
            <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
              <img
                src={heroWorkshop}
                alt="AutoKita mechanics working in the shop"
                className="h-80 w-full object-cover transition-transform duration-500 hover:scale-105"
              />
            </div>
            <div className="absolute -bottom-6 left-6 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">15,000+</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Services Completed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y bg-background py-10">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
          {[
            { label: "Expert Mechanics", value: "45+" },
            { label: "Avg. Service Time", value: "90m" },
            { label: "User Rating", value: "4.9/5" },
            { label: "Support 24/7", value: "AI Ready" },
          ].map((s) => (
            <div key={s.label}>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-2xl font-bold">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <h2 className="text-3xl font-bold md:text-4xl">Why Choose AutoKita</h2>
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            Traditional skill meets modern efficiency. We've redesigned the service experience from the ground up.
          </p>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { icon: Zap, title: "Lightning Fast Service", desc: "Our optimized workflow and digital intake system reduce wait times by 40% compared to traditional shops. Get in, get out, get moving." },
              { icon: MapPin, title: "Digital Tracking", desc: "Monitor your vehicle's progress in real-time from your dashboard. From inspection to completion, you'll never wonder what's happening." },
              { icon: ShieldCheck, title: "Expert Reliability", desc: "Every technician is ASE certified and every service is backed by our comprehensive warranty. We treat your vehicle like our own." },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border bg-card p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:border-brand/40"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110">
                  <f.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-background py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h2 className="text-3xl font-bold md:text-4xl">The AutoKita Digital Edge</h2>
            <div className="mt-8 space-y-6">
              {[
                { title: "Predictive Maintenance", desc: "Our system analyzes your vehicle history to suggest care before problems arise." },
                { title: "Seamless Communication", desc: "Direct chat with your mechanic through our AI-integrated platform." },
                { title: "Paperless Management", desc: "All invoices, service logs, and inspections stored securely in the cloud." },
              ].map((f) => (
                <div key={f.title} className="group flex gap-4 transition-transform duration-300 hover:translate-x-1">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-brand" />
                  <div>
                    <h3 className="font-semibold">{f.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
                {["bg-warning","bg-brand","bg-teal"].map((c,i) => <div key={i} className={`h-6 w-6 rounded-full border-2 border-background ${c}`} />)}
                <div className="flex h-6 items-center rounded-full border-2 border-background bg-muted px-2 text-[10px] font-medium">+3</div>
              </div>
              <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-brand">Read Testimonials <ChevronRight className="h-3 w-3" /></a>
            </div>
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
              <Link href="/services" className="rounded-md border border-white/50 bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Services</Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default About;
