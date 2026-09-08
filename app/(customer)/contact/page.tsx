'use client'

import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, MapPin, Navigation, Phone, Mail, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

const INQUIRIES = ["General", "Booking", "Diagnostic", "Billing"];

const ADDRESS = "971-B Domingo Santiago St, Sampaloc, Manila, 1008 Metro Manila, Philippines";
const MAPS_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&z=16&output=embed`;
const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`;

type FormErrors = {
  name?: string;
  email?: string;
  message?: string;
};

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
        } ${isCenter ? "justify-center" : ""}`}
      >
        <span className="h-[3px] w-6 rounded-full" style={{ backgroundColor: "#0b1730" }} />
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </span>
      </div>

      <h1
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
      </h1>

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

function Contact() {
  useEffect(() => { document.title = "Contact AutoKita — Support Center"; }, []);

  const [inquiry, setInquiry] = useState("General");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  function validate(): FormErrors {
    const next: FormErrors = {};

    if (!name.trim()) {
      next.name = "Full name is required.";
    }

    if (!email.trim()) {
      next.email = "Email address is required.";
    } else if (!emailRegex.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }

    if (!message.trim()) {
      next.message = "Please tell us how we can help.";
    }

    return next;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next = validate();
    setErrors(next);

    if (Object.keys(next).length > 0) {
      setSubmitted(false);
      return;
    }

    setSubmitting(true);
    // Simulate a brief send so the user gets clear "in progress" feedback
    // rather than an instant flash of the success state.
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      setName("");
      setEmail("");
      setMessage("");
      setInquiry("General");
      setErrors({});
    }, 900);
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <SectionHeading
          eyebrow="SUPPORT CENTER"
          lead="Contact Our"
          accent="Experts."
          subtitle="Whether it's a routine checkup or a complex request, our team is ready to help you get back on the road safely."
        />

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <Reveal variant="left">
            <form
              className="rounded-xl border bg-card p-8 shadow-sm transition-shadow duration-300 hover:shadow-md"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <h2 className="text-lg font-semibold">Send us a Message</h2>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Fill out the form below and one of our service coordinators will reach out to you within 2 business hours.
              </p>

              <div
                className={`grid overflow-hidden transition-all duration-300 ease-out ${
                  submitted ? "mt-4 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="min-h-0">
                  <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                    Thank you! Your message has been sent. We'll get back to you shortly.
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field
                  label="Full Name"
                  placeholder="Juan Reyes"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  error={errors.name}
                  required
                />
                <Field
                  label="Email Address"
                  placeholder="juan@example.com"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  error={errors.email}
                  required
                />
              </div>
              <div className="mt-5">
                <label className="text-xs font-medium">Inquiry Type</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INQUIRIES.map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setInquiry(i)}
                      className={`rounded-md border px-4 py-1.5 text-sm transition-all duration-200 ${
                        inquiry === i
                          ? "border-brand bg-brand-soft text-brand scale-[1.03]"
                          : "hover:bg-accent hover:scale-[1.03]"
                      }`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-5">
                <label className="text-xs font-medium">
                  Message <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={5}
                  placeholder="How can we help with your vehicle today? Please include your plate number if inquiring about an active service."
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    if (errors.message) setErrors((prev) => ({ ...prev, message: undefined }));
                  }}
                  className={`mt-2 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 ${
                    errors.message ? "border-destructive focus:border-destructive" : "focus:border-brand"
                  }`}
                />
                {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground transition-all hover:opacity-90 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {submitting ? (
                  <>
                    Sending <Loader2 className="h-4 w-4 animate-spin" />
                  </>
                ) : (
                  <>
                    Send Message <Send className="h-4 w-4" />
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                By submitting this form, you agree to our Privacy Policy and Terms of Service.
              </p>
            </form>
          </Reveal>

          <Reveal variant="right" delay={150} className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-brand" /> Our Location
              </div>
              <div className="relative overflow-hidden rounded-xl border bg-muted/40 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <div className="relative h-[440px] w-full">
                  {/* Skeleton shown while the map iframe is loading */}
                  {!mapLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted/60">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <iframe
                    title="AutoKita Location Map"
                    src={MAPS_EMBED_SRC}
                    className={`h-full w-full border-0 transition-opacity duration-500 ${mapLoaded ? "opacity-100" : "opacity-0"}`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                    onLoad={() => setMapLoaded(true)}
                  />
                </div>

                <a
                  href={MAPS_DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-xs font-medium shadow-md transition-transform duration-200 hover:bg-accent hover:scale-105"
                >
                  <Navigation className="h-3 w-3" /> Open in Maps
                </a>

                <div className="pointer-events-none absolute inset-x-3 bottom-3">
                  <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur transition-transform duration-300 hover:-translate-y-1">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold">Our Central Workshop</div>
                      <div className="truncate text-xs text-muted-foreground">
                        971-B Domingo Santiago St., Sampaloc, Manila, 1008
                      </div>
                    </div>
                    <span className="flex flex-shrink-0 items-center gap-1.5 text-[11px] font-medium text-success">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> Open
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Phone className="h-4 w-4 text-brand" /> Direct Channels
              </div>
              <div className="space-y-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                <Channel icon={Phone} label="Emergency Service" value="+1 (555) 911-CARE" note="Available 24/7 for roadside assistance" />
                <Channel icon={Mail} label="Customer Support" value="support@autokita.com" note="Expected response: 1-2 hours" />
                <Channel icon={Clock} label="Workshop Hours" value="Mon - Sat: 8:00 AM - 6:00 PM" note="Sundays: Appointment Only" />
              </div>
            </div>
          </Reveal>
        </div>
      </section>
      <Footer />
    </div>
  );
}

function Field({
  label,
  error,
  required,
  ...props
}: { label: string; error?: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="text-xs font-medium">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        {...props}
        className={`mt-2 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 ${
          error ? "border-destructive focus:border-destructive" : "focus:border-brand"
        }`}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Channel({ icon: Icon, label, value, note }: { icon: any; label: string; value: string; note: string }) {
  return (
    <div className="group flex items-start gap-3 rounded-md bg-muted/30 p-3 transition-colors duration-200 hover:bg-muted/60">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
        <div className="text-xs text-muted-foreground">{note}</div>
      </div>
    </div>
  );
}

export default Contact;