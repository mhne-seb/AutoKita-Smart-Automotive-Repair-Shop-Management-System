'use client'

// Route: /dashboard/profile — Customer account/profile settings page.

import { useState, useEffect} from "react";
import {
  User,
  Upload,
  Smartphone,
  Mail,
  KeyRound,
  Info,
  Eye,
  EyeOff,
  Camera,
  Lock,
  ShieldCheck,
} from "lucide-react";

function Profile() {
  useEffect(() => { document.title = "Profile Settings — AutoKita"; }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your profile, password, and account security.
        </p>
      </div>

      {/* Profile + Password side by side on larger screens */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={User} title="Profile" desc="Your public profile information visible to teammates." stacked>
          <div className="mb-6 flex items-center gap-4">
            <div className="group relative h-16 w-16 shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal text-white">
                <User className="h-7 w-7" />
              </div>
              <button
                aria-label="Upload photo"
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
            </div>
            <div>
              <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> Upload photo
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG. Max 5MB.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" defaultValue="Juan" />
            <Field label="Last name" defaultValue="Dela Cruz" />
            <Field label="Username" defaultValue="@juan.dlcruz" wide />
            <Field label="Email address" defaultValue="juand.cruz@example.com" wide />
          </div>
          <div className="mt-6 flex justify-end">
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
              Save changes
            </button>
          </div>
        </Section>

        <Section icon={Lock} title="Password" desc="Update your password to keep your account secure." stacked>
          <div className="space-y-4">
            <PasswordField label="Current password" defaultValue="password" />
            <div>
              <PasswordField label="New password" defaultValue="password" />
              <p className="mt-1 text-xs text-muted-foreground">Must be at least 8 characters.</p>
            </div>
            <PasswordField label="Confirm new password" defaultValue="password" />
          </div>
          <div className="mt-6 flex justify-end">
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
              Update password
            </button>
          </div>
        </Section>
      </div>

      <div className="mt-6">
        <Section icon={ShieldCheck} title="Two-Factor Authentication" desc="Add an extra layer of security to your account.">
          <div className="space-y-3 rounded-lg border p-4">
            <TwoFA
              icon={Mail}
              name="Email verification"
              desc="Receive a one-time code at juand.cruz@example.com"
              enabled
            />
            <TwoFA
              icon={Smartphone}
              name="Authenticator app"
              desc="Use an app like Google Authenticator or Authy"
            />
            <TwoFA
              icon={KeyRound}
              name="Security key (WebAuthn)"
              desc="Use a hardware key like YubiKey or Touch ID"
            />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md bg-brand-soft/60 p-3 text-xs text-brand">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            Email verification is your primary 2FA method. You can add an authenticator app or
            security key for extra backup options.
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  desc,
  children,
  stacked,
}: {
  icon: any;
  title: string;
  desc: string;
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm md:p-8">
      <div className={stacked ? "space-y-6" : "grid gap-6 md:grid-cols-[220px_1fr] md:gap-8"}>
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-soft text-brand">
              <Icon className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{desc}</p>
        </div>
        <div>{children}</div>
      </div>
    </section>
  );
}

function Field({ label, wide, ...props }: { label: string; wide?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label className="text-sm font-medium">{label}</label>
      <input
        {...props}
        className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}

function PasswordField({ label, defaultValue }: { label: string; defaultValue?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={visible ? "text" : "password"}
          defaultValue={defaultValue}
          className="w-full rounded-md border bg-background px-3 py-2 pr-10 text-sm transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function TwoFA({ icon: Icon, name, desc, enabled }: { icon: any; name: string; desc: string; enabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md p-2">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted"><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {enabled ? (
          <>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Enabled</span>
            <button className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Configure</button>
          </>
        ) : (
          <>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Not set up</span>
            <button className="rounded-md border px-3 py-1 text-xs hover:bg-accent">Set up</button>
          </>
        )}
      </div>
    </div>
  );
}

export default Profile;
