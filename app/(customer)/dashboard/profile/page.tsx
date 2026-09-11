'use client'

// Route: /dashboard/profile — Customer account/profile settings page.

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  User,
  Upload,
  Mail,
  Info,
  Eye,
  EyeOff,
  Camera,
  Check,
  Lock,
  ShieldCheck,
  Settings,
} from "lucide-react";

const BRAND_GRADIENT = "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)";
const FALLBACK_USER_ID = 280;

type ProfileForm = {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  contact_number: string;
};

function Profile() {
  useEffect(() => { document.title = "Profile Settings — AutoKita"; }, []);

  const [userId, setUserId] = useState<number>(FALLBACK_USER_ID);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);

  //Brief green "updated" state on the buttons - a corner toast is easy to miss.
  const [profileSaved, setProfileSaved] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false); 

  useEffect(() => {
    const stored = typeof window !== "undefined" ? sessionStorage.getItem("autokita_user_id") : null;
    const id = stored ? parseInt(stored, 10) : FALLBACK_USER_ID;
    setUserId(id);
    fetch(`/api/customer/profile?userId=${id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) {
          setForm({
            first_name: j.user.first_name ?? "",
            last_name: j.user.last_name ?? "",
            nickname: j.user.nickname ?? "",
            email: j.user.email ?? "",
            contact_number: j.user.contact_number ?? "",
          });
        } else {
          toast.error(j.message ?? "Could not load your profile.");
        }
      })
      .catch(() => toast.error("Could not load your profile."));
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: string) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  const saveProfile = async () => {
    if (!form) return;
    setSavingProfile(true);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          firstName: form.first_name,
          lastName: form.last_name,
          nickname: form.nickname,
          email: form.email,
          contactNumber: form.contact_number,
        }),
      });
      const j = await res.json();
      if(j.success) {
        toast.success("Profile updated.");
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2000);
      } else {
        toast.error(j.message ?? "Update failed.");
      }
    } catch {
      toast.error("Could not reach the server.");
    }
    setSavingProfile(false);
  };

  const savePassword = async () => {
    if (pwd.next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (pwd.next !== pwd.confirm) return toast.error("New passwords don't match.");
    setSavingPwd(true);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, currentPassword: pwd.current, newPassword: pwd.next }),
      });
      const j = await res.json();
      if (j.success) {
        toast.success("Password updated.");
        setPwd({ current: "", next: "", confirm: "" });
        setPwdSaved(true);
        setTimeout(() => setPwdSaved(false), 2000);
      } else {
        toast.error(j.message ?? "Update failed.");
      }
    } catch {
      toast.error("Could not reach the server.");
    }
    setSavingPwd(false);
  };

  if (!form) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10 text-sm text-muted-foreground">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <div
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-md"
          style={{ backgroundImage: BRAND_GRADIENT }}
        >
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1
            className="bg-clip-text text-2xl font-extrabold tracking-tight text-transparent"
            style={{ backgroundImage: BRAND_GRADIENT }}
          >
            Account Settings
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage your profile, password, and account security.
          </p>
        </div>
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
              <button className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                <Upload className="h-3.5 w-3.5" /> Upload photo
              </button>
              <p className="mt-1.5 text-xs text-muted-foreground">JPG or PNG. Max 5MB.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            <Field label="Last name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            <Field label="Nickname" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} wide />
            <Field label="Contact number" value={form.contact_number} onChange={(e) => set("contact_number", e.target.value)} wide />
            <Field label="Email address" value={form.email} onChange={(e) => set("email", e.target.value)} wide />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                profileSaved
                  ? "bg-emerald-600 text-white"
                  : "bg-brand text-brand-foreground hover:opacity-90 disabled:opacity-60"
              }`}
            >
              {profileSaved ? (
                <>
                  <Check className="h-4 w-4" /> Profile updated
                </>
              ) : savingProfile ? (
                "Saving..."
              ) : (
                "Save changes"
              )}
            </button>
          </div>
        </Section>

        <Section icon={Lock} title="Password" desc="Update your password to keep your account secure." stacked>
                    <div className="space-y-4">
            <PasswordField label="Current password" value={pwd.current} onChange={(v) => setPwd((p) => ({ ...p, current: v }))} />
            <div>
              <PasswordField label="New password" value={pwd.next} onChange={(v) => setPwd((p) => ({ ...p, next: v }))} />
              <p className="mt-1 text-xs text-muted-foreground">Must be at least 8 characters.</p>
            </div>
            <PasswordField label="Confirm new password" value={pwd.confirm} onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))} />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              onClick={savePassword}
              disabled={savingPwd}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
                pwdSaved
                  ? "bg-emerald-600 text-white"
                  : "bg-brand text-brand-foreground hover:opacity-90 disabled:opacity-60"
              }`}
            >
              {pwdSaved ? (
                <>
                  <Check className="h-4 w-4" /> Password updated 
                </>
              ) : savingPwd ? (
                "Updating..."
              ) : (
                "Update password"
              )}
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
              desc={`Approval codes are sent to ${form.email}`}
              enabled
            />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md bg-brand-soft/60 p-3 text-xs text-brand">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0" />
            AutoKita uses email verification for account codes. Authenticator apps and hardware
            keys aren&apos;t supported.
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
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="h-1 w-full" style={{ backgroundImage: BRAND_GRADIENT }} />
      <div className="p-6 md:p-8">
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

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative mt-1.5">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Always on</span>
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