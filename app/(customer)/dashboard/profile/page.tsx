'use client'

// Route: /dashboard/profile — Customer account/profile settings page.

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  User,
  Mail,
  Info,
  Eye,
  EyeOff,
  Check,
  Lock,
  ShieldCheck,
  Settings,
  MapPin,
  ChevronDown,
  AlertCircle,
  Camera,
  Trash2,
} from "lucide-react";
import phAddress from "@/data/ph-address.json";

const BRAND_GRADIENT = "linear-gradient(90deg, #0b1730 0%, #1d3a68 55%, #3b6cb4 100%)";
const FALLBACK_USER_ID = 280;

// Same province/city lists and "Others" choice as the booking form.
const OTHERS = "Others";
const PROVINCES: string[] = phAddress.provinces;
const CITIES_BY_PROVINCE: Record<string, string[]> = phAddress.citiesByProvince;

type ProfileForm = {
  first_name: string;
  last_name: string;
  nickname: string;
  email: string;
  contact_number: string;
  street: string;
  province: string; provinceOther: string;
  city: string; cityOther: string;
  barangay: string;
};

type AddressParts = Pick<ProfileForm, "street" | "province" | "provinceOther" | "city" | "cityOther" | "barangay">;

// The address is saved as one line, in the booking form's order:
// "street, barangay, city, province". Split it back into the four boxes.
function splitAddress(address: string | null): AddressParts {
  const empty = { street: "", province: "", provinceOther: "", city: "", cityOther: "", barangay: "" };
  // "None" is what older bookings stored when no address was given.
  if (!address || address === "None") return empty;
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length < 4) return { ...empty, street: address }; // older free-text address
  const province = parts[parts.length - 1];
  const city = parts[parts.length - 2];
  const knownProvince = PROVINCES.includes(province);
  const knownCity = knownProvince && (CITIES_BY_PROVINCE[province] ?? []).includes(city);
  return {
    street: parts.slice(0, -3).join(", "),
    barangay: parts[parts.length - 3],
    province: knownProvince ? province : OTHERS,
    provinceOther: knownProvince ? "" : province,
    city: knownCity ? city : OTHERS,
    cityOther: knownCity ? "" : city,
  };
}

const pick = (value: string, other: string) => (value === OTHERS ? other : value).trim();

function joinAddress(f: AddressParts): string {
  return [f.street.trim(), f.barangay.trim(), pick(f.city, f.cityOther), pick(f.province, f.provinceOther)]
    .filter(Boolean)
    .join(", ");
}

// The address is optional, but once the customer starts it, all four parts are needed.
function addressErrors(f: AddressParts) {
  const parts = [f.street.trim(), f.barangay.trim(), pick(f.city, f.cityOther), pick(f.province, f.provinceOther)];
  if (parts.every((p) => !p)) return {};
  return {
    street: parts[0] ? undefined : "House no. / street is required",
    barangay: parts[1] ? undefined : "Barangay is required",
    city: parts[2] ? undefined : "City is required",
    province: parts[3] ? undefined : "Province is required",
  };
}

// Phone photos are several MB, but this one only shows as a small circle.
// Crop to the centre square and shrink to 256px (about 20 KB), so it loads
// fast and barely touches the storage download quota.
async function shrinkPhoto(file: File): Promise<File> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas
    .getContext("2d")!
    .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Could not read that photo.");
  return new File([blob], "profile.jpg", { type: "image/jpeg" });
}

function Profile() {
  useEffect(() => { document.title = "Profile Settings — AutoKita"; }, []);

  const [userId, setUserId] = useState<number>(FALLBACK_USER_ID);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [showAddressErrors, setShowAddressErrors] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

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
            ...splitAddress(j.user.address),
          });
          setPhotoUrl(j.user.avatar_url ?? null);
        } else {
          toast.error(j.message ?? "Could not load your profile.");
        }
      })
      .catch(() => toast.error("Could not load your profile."));
  }, []);

  const set = <K extends keyof ProfileForm>(k: K, v: string) =>
    setForm((p) => (p ? { ...p, [k]: v } : p));

  // A new province means the old city no longer fits.
  const selectProvince = (v: string) =>
    setForm((p) => (p ? { ...p, province: v, provinceOther: v === OTHERS ? p.provinceOther : "", city: "", cityOther: "" } : p));

  const selectCity = (v: string) =>
    setForm((p) => (p ? { ...p, city: v, cityOther: v === OTHERS ? p.cityOther : "" } : p));

  // Tells the header to reload the name and photo.
  const announceChange = () => window.dispatchEvent(new Event("autokita-profile-changed"));

  const uploadPhoto = async (file: File) => {
    setSavingPhoto(true);
    try {
      const body = new FormData();
      body.append("userId", String(userId));
      body.append("file", await shrinkPhoto(file));
      const j = await fetch("/api/customer/profile/photo", { method: "POST", body }).then((r) => r.json());
      if (j.success) {
        setPhotoUrl(j.avatarUrl);
        announceChange();
        toast.success("Profile photo updated.");
      } else {
        toast.error(j.message ?? "Upload failed.");
      }
    } catch {
      toast.error("Could not upload that photo. Try a JPG or PNG.");
    }
    setSavingPhoto(false);
  };

  const removePhoto = async () => {
    setSavingPhoto(true);
    try {
      const j = await fetch(`/api/customer/profile/photo?userId=${userId}`, { method: "DELETE" }).then((r) => r.json());
      if (j.success) {
        setPhotoUrl(null);
        announceChange();
        toast.success("Profile photo removed.");
      } else {
        toast.error(j.message ?? "Could not remove the photo.");
      }
    } catch {
      toast.error("Could not reach the server.");
    }
    setSavingPhoto(false);
  };

  const saveProfile = async () => {
    if (!form) return;
    if (Object.values(addressErrors(form)).some(Boolean)) {
      setShowAddressErrors(true);
      return;
    }
    setShowAddressErrors(false);
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
          address: joinAddress(form),
        }),
      });
      const j = await res.json();
      if(j.success) {
        toast.success("Profile updated.");
        announceChange();
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

  const errors = showAddressErrors ? addressErrors(form) : {};
  const cityOptions = form.province && form.province !== OTHERS ? CITIES_BY_PROVINCE[form.province] ?? [] : [];

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
        <Section icon={User} title="Profile" desc="Your name and contact details. The shop uses these to reach you about your car." stacked>
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-muted-foreground">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl} alt="Your profile photo" className="h-full w-full object-cover" />
              ) : (
                <User className="h-8 w-8" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => photoInput.current?.click()}
                  disabled={savingPhoto}
                  className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-60"
                >
                  <Camera className="h-4 w-4" /> {savingPhoto ? "Saving..." : photoUrl ? "Change photo" : "Upload photo"}
                </button>
                {photoUrl && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    disabled={savingPhoto}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" /> Remove
                  </button>
                )}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">JPG, PNG or WebP. Saves right away.</p>
              <input
                ref={photoInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = ""; // so picking the same file again still triggers
                  if (file) uploadPhoto(file);
                }}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} />
            <Field label="Last name" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
            <Field label="Nickname" value={form.nickname} onChange={(e) => set("nickname", e.target.value)} wide />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Home address</label>
              <div className="mt-1.5 space-y-4 rounded-lg border p-4">
                <AddressInput
                  label="House No. / Street / Subdivision"
                  value={form.street}
                  onChange={(v) => set("street", v)}
                  placeholder="e.g., 123 Mabini St., Green Village"
                  error={errors.street}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <AddressSelect
                    label="Province"
                    value={form.province}
                    onChange={selectProvince}
                    options={PROVINCES}
                    placeholder="Select province"
                    otherValue={form.provinceOther}
                    onOtherChange={(v) => set("provinceOther", v)}
                    error={errors.province}
                  />
                  {form.province === OTHERS ? (
                    // No city list for a province we don't have, so the city is typed.
                    <AddressInput
                      label="City"
                      value={form.cityOther}
                      onChange={(v) => setForm((p) => (p ? { ...p, city: OTHERS, cityOther: v } : p))}
                      placeholder="Type your city"
                      error={errors.city}
                    />
                  ) : (
                    <AddressSelect
                      label="City"
                      value={form.city}
                      onChange={selectCity}
                      options={cityOptions}
                      placeholder={form.province ? "Select city" : "Select province first"}
                      disabled={!form.province}
                      otherValue={form.cityOther}
                      onOtherChange={(v) => set("cityOther", v)}
                      error={errors.city}
                    />
                  )}
                  <AddressInput
                    label="Barangay"
                    value={form.barangay}
                    onChange={(v) => set("barangay", v)}
                    placeholder="Type your barangay"
                    error={errors.barangay}
                  />
                </div>
              </div>
            </div>
            <Field label="Contact number" value={form.contact_number} readOnly wide />
            <Field label="Email address" value={form.email} readOnly wide />
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-md bg-brand-soft/60 p-3 text-xs text-brand">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Your email and contact number are where we send your approval codes and updates. To change
              either one, visit the shop or call us (see our{" "}
              <Link href="/contact" className="font-semibold underline">Contact page</Link>). We&apos;ll check
              it&apos;s really you first.
            </p>
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
      <label className="flex items-center gap-1.5 text-sm font-medium">
        {label}
        {props.readOnly && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Locked" />}
      </label>
      <input
        {...props}
        className={`mt-1.5 w-full rounded-md border px-3 py-2 text-sm transition-colors ${
          props.readOnly
            ? "cursor-not-allowed bg-muted text-muted-foreground"
            : "bg-background focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        }`}
      />
    </div>
  );
}

// Address boxes styled like the booking form's Location Information.
function AddressInput({
  label, value, onChange, placeholder, error,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={120}
          className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${
            error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
          }`}
        />
      </div>
      {error && <FieldError text={error} />}
    </div>
  );
}

function AddressSelect({
  label, value, onChange, options, placeholder, otherValue, onOtherChange, error, disabled,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; placeholder: string;
  otherValue: string; onOtherChange: (v: string) => void; error?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</label>
      <div className="relative mt-1.5">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={`w-full appearance-none rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none disabled:opacity-60 ${
            error ? "border-red-400 focus:border-red-400" : "focus:border-brand"
          }`}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
          <option value={OTHERS}>Others (type your own)</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
      {value === OTHERS && (
        <input
          value={otherValue}
          onChange={(e) => onOtherChange(e.target.value)}
          placeholder={`Please specify ${label.toLowerCase()}`}
          maxLength={60}
          className="mt-2 w-full rounded-md border border-brand/50 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
      )}
      {error && <FieldError text={error} />}
    </div>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p className="mt-1 flex items-center gap-1 text-[11px] text-red-500">
      <AlertCircle className="h-3 w-3" /> {text}
    </p>
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