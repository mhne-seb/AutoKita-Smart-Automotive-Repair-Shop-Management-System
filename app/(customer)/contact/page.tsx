'use client'

import { useState, useEffect} from "react";
import { MessageSquare, Send, MapPin, Navigation, Phone, Mail, Clock } from "lucide-react";
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

function Contact() {
  useEffect(() => { document.title = "Contact AutoKita — Support Center"; }, []);

  const [inquiry, setInquiry] = useState("General");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);

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

    setSubmitted(true);
    setName("");
    setEmail("");
    setMessage("");
    setInquiry("General");
    setErrors({});
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center">
          <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium">Support Center</span>
          <h1 className="mt-5 text-4xl font-bold md:text-5xl">Contact Our Experts</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground">
            Whether it's a routine checkup or a complex request, our team is ready to help you get back on the road safely.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-start">
          <form className="rounded-xl border bg-card p-8 shadow-sm" onSubmit={handleSubmit} noValidate>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-brand">
                <MessageSquare className="h-4 w-4" />
              </div>
              <h2 className="text-lg font-semibold">Send us a Message</h2>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Fill out the form below and one of our service coordinators will reach out to you within 2 business hours.
            </p>

            {submitted && (
              <div className="mt-4 rounded-md border border-success/30 bg-success/10 px-4 py-2.5 text-sm text-success">
                Thank you! Your message has been sent. We'll get back to you shortly.
              </div>
            )}

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
                    className={`rounded-md border px-4 py-1.5 text-sm ${
                      inquiry === i ? "border-brand bg-brand-soft text-brand" : "hover:bg-accent"
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
                className={`mt-2 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm focus:outline-none ${
                  errors.message ? "border-destructive focus:border-destructive" : "focus:border-brand"
                }`}
              />
              {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message}</p>}
            </div>
            <button
              type="submit"
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-brand py-3 text-sm font-semibold text-brand-foreground hover:opacity-90"
            >
              Send Message <Send className="h-4 w-4" />
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              By submitting this form, you agree to our Privacy Policy and Terms of Service.
            </p>
          </form>

          <div className="space-y-5">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-brand" /> Our Location
              </div>
              <div className="relative overflow-hidden rounded-xl border bg-muted/40">
                <div className="h-[440px] w-full">
                  <iframe
                    title="AutoKita Location Map"
                    src={MAPS_EMBED_SRC}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>

                {
                  
                }
                <div className="pointer-events-none absolute left-2 top-2 h-9 w-9 rounded-md bg-muted/40" />

                <a
                  href={MAPS_DIRECTIONS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-3 flex items-center gap-1.5 rounded-md bg-card px-3 py-1.5 text-xs font-medium shadow-md hover:bg-accent"
                >
                  <Navigation className="h-3 w-3" /> Open in Maps
                </a>

                <div className="pointer-events-none absolute inset-x-3 bottom-83">
                  <div className="pointer-events-auto flex items-center gap-3 rounded-lg border bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur">
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
                      <span className="h-1.5 w-1.5 rounded-full bg-success" /> Open
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Phone className="h-4 w-4 text-brand" /> Direct Channels
              </div>
              <div className="space-y-3 rounded-xl border bg-card p-5">
                <Channel icon={Phone} label="Emergency Service" value="+1 (555) 911-CARE" note="Available 24/7 for roadside assistance" />
                <Channel icon={Mail} label="Customer Support" value="support@autokita.com" note="Expected response: 1-2 hours" />
                <Channel icon={Clock} label="Workshop Hours" value="Mon - Sat: 8:00 AM - 6:00 PM" note="Sundays: Appointment Only" />
              </div>
            </div>
          </div>
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
        className={`mt-2 w-full rounded-md border bg-muted/40 px-3 py-2 text-sm focus:outline-none ${
          error ? "border-destructive focus:border-destructive" : "focus:border-brand"
        }`}
      />
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Channel({ icon: Icon, label, value, note }: { icon: any; label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-md bg-muted/30 p-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
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
