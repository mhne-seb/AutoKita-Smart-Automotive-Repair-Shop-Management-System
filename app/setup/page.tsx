'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle, CheckCircle2, ChevronDown, MapPin } from 'lucide-react'
import { Logo } from '@/components/site/Logo'
import { ProfileProgress } from '@/components/setup/ProfileProgress'
import { VehicleForm } from '@/components/dashboard/VehicleForm'
import phAddress from '@/data/ph-address.json'

const PROVINCES: string[] = phAddress.provinces
const CITIES_BY_PROVINCE: Record<string, string[]> = phAddress.citiesByProvince
const OTHERS = "Others"

type SetupData = {
  setupCompleted: boolean;
  percent: number;
  items: { account: boolean; email: boolean; phone: boolean; address: boolean; contact: boolean; vehicle: boolean };
  firstName: string;
  phone: string;
  address: string | null;
  vehicles: any[];
}

export default function SetupPage() {
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [data, setData] = useState<SetupData | null>(null)
  const [step, setStep] = useState<'details' | 'vehicles' | 'done'>('details')
  
  // Address form
  const [street, setStreet] = useState("")
  const [province, setProvince] = useState("")
  const [provinceOther, setProvinceOther] = useState("")
  const [city, setCity] = useState("")
  const [cityOther, setCityOther] = useState("")
  const [barangay, setBarangay] = useState("")
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressErrors, setAddressErrors] = useState<Record<string, string>>({})
  // Phone: asked here only when the account has none yet (new Google customers).
  const [phoneInput, setPhoneInput] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [saveError, setSaveError] = useState("")
  
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [completing, setCompleting] = useState(false)

  const loadSetup = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch('/api/customer/setup')
      if (res.status === 401) {
        router.replace('/login')
        return
      }
      const j = await res.json()
      if (j.success) {
        if (j.setupCompleted) {
          router.replace('/dashboard')
          return
        }
        setData(j)

        // The details step (phone and address) comes first until both are saved.
        if (!j.items.contact) {
          setStep('details')
        } else {
          setStep(j.vehicles.length > 0 ? 'done' : 'vehicles')
        }
      } else {
        setError("Could not load your setup.")
      }
    } catch {
      setError("Could not load your setup.")
    }
    setLoading(false)
  }

  useEffect(() => {
    loadSetup()
  }, [])

  const pick = (value: string, other: string) => (value === OTHERS ? other : value).trim();

  const validateAddress = () => {
    const parts = [street.trim(), barangay.trim(), pick(city, cityOther), pick(province, provinceOther)];
    return {
      street: parts[0] ? undefined : "House no. / street is required",
      barangay: parts[1] ? undefined : "Barangay is required",
      city: parts[2] ? undefined : "City is required",
      province: parts[3] ? undefined : "Province is required",
    };
  }

  const needsPhone = !!data && !data.items.phone
  const needsAddress = !!data && !data.items.address

  const handleSaveDetails = async () => {
    setSaveError("")

    // The mobile number comes first: it is required, and only asked while the account has none.
    if (needsPhone) {
      const cleaned = phoneInput.replace(/[\s-]/g, "")
      if (!/^(\+?63|0)9\d{9}$/.test(cleaned)) {
        setPhoneError("Enter a valid mobile number, like 09171234567.")
        return
      }
    }
    setPhoneError("")

    // The address is required too (unless the account already has one saved).
    const errs = needsAddress ? validateAddress() : {}
    if (Object.values(errs).some(Boolean)) {
      setAddressErrors(errs as any)
      return
    }
    setAddressErrors({})

    setSavingAddress(true)
    try {
      if (needsPhone) {
        const res = await fetch('/api/customer/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phoneInput }),
        })
        const j = await res.json().catch(() => null)
        if (!res.ok || !j?.success) {
          setPhoneError(j?.message || "We could not save your number. Try again.")
          setSavingAddress(false)
          return
        }
      }

      if (needsAddress) {
        const joined = [street.trim(), barangay.trim(), pick(city, cityOther), pick(province, provinceOther)]
          .filter(Boolean)
          .join(", ")
        if (joined) {
          const res = await fetch("/api/customer/profile", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: joined }),
          })
          const j = await res.json().catch(() => null)
          if (!res.ok || !j?.success) {
            setSaveError(j?.message || "We could not save your address. Try again.")
            setSavingAddress(false)
            return
          }
        }
      }

      const res = await fetch('/api/customer/setup')
      const j = await res.json()
      if (j.success) setData(j)
      setStep('vehicles')
    } catch {
      setSaveError("Something went wrong. Check your connection and try again.")
    }
    setSavingAddress(false)
  }

  const handleComplete = async () => {
    setCompleting(true)
    try {
      const res = await fetch('/api/customer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ complete: true })
      })
      const j = await res.json()
      if (j.success) {
        setData(j)
        setStep('done')
      }
    } catch {
      // Ignore
    }
    setCompleting(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-destructive" />
        <p className="mb-4 text-sm font-medium">{error}</p>
        <button onClick={loadSetup} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-6 py-10 flex flex-col items-center">
      <div className="mb-10 text-center">
        <Logo />
      </div>

      <div className="w-full max-w-[32rem]">
        <ProfileProgress items={data.items} percent={data.percent} />

        {step === 'details' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-bold">Your details</h1>
            <p className="mt-1 text-sm text-muted-foreground">So the shop can reach you.</p>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Mobile number{needsPhone && <span className="text-red-500"> *</span>}
                </label>
                {needsPhone ? (
                  <>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phoneInput}
                      onChange={(e) => { setPhoneInput(e.target.value); setPhoneError("") }}
                      placeholder="e.g., 09171234567"
                      className={`mt-1.5 w-full rounded-md border bg-background py-2 px-3 text-sm focus:outline-none ${phoneError ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                    />
                    {phoneError ? (
                      <p className="mt-1.5 text-xs text-red-500">{phoneError}</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">The shop uses this to reach you about your car.</p>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={data.phone}
                      readOnly
                      className="mt-1.5 w-full rounded-md border bg-muted py-2 px-3 text-sm text-muted-foreground cursor-not-allowed"
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">From your sign-up</p>
                  </>
                )}
              </div>

              {needsAddress ? (
                <div className="pt-4">
                  <label className="text-sm font-medium">Address <span className="text-red-500">*</span></label>
                  <p className="mb-3 text-xs text-muted-foreground">Used for home service visits.</p>
                  <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">House No. / Street / Subdivision</label>
                      <div className="relative mt-1.5">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          value={street}
                          onChange={(e) => { setStreet(e.target.value); setAddressErrors(p => ({ ...p, street: "" })) }}
                          placeholder="e.g., 123 Mabini St., Green Village"
                          className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${addressErrors.street ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                        />
                      </div>
                      {addressErrors.street && <p className="mt-1 text-xs text-red-500">{addressErrors.street}</p>}
                    </div>
  
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Province</label>
                        <div className="relative mt-1.5">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <select
                            value={province}
                            onChange={(e) => {
                              const v = e.target.value;
                              setProvince(v);
                              if (v !== OTHERS) setProvinceOther("");
                              setCity(""); setCityOther("");
                              setAddressErrors(p => ({ ...p, province: "", city: "" }))
                            }}
                            className={`w-full appearance-none rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none ${addressErrors.province ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                          >
                            <option value="" disabled>Select province</option>
                            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                            <option value={OTHERS}>Others (type your own)</option>
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        {province === OTHERS && (
                          <input
                            value={provinceOther}
                            onChange={(e) => setProvinceOther(e.target.value)}
                            placeholder="Please specify province"
                            className="mt-2 w-full rounded-md border border-brand/50 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                          />
                        )}
                        {addressErrors.province && <p className="mt-1 text-xs text-red-500">{addressErrors.province}</p>}
                      </div>
  
                      <div>
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">City</label>
                        <div className="relative mt-1.5">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          {province === OTHERS ? (
                            <input
                              value={cityOther}
                              onChange={(e) => { setCityOther(e.target.value); setCity(OTHERS); setAddressErrors(p => ({ ...p, city: "" })) }}
                              placeholder="Type your city"
                              className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${addressErrors.city ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                            />
                          ) : (
                            <select
                              value={city}
                              disabled={!province}
                              onChange={(e) => {
                                const v = e.target.value;
                                setCity(v);
                                if (v !== OTHERS) setCityOther("");
                                setAddressErrors(p => ({ ...p, city: "" }))
                              }}
                              className={`w-full appearance-none rounded-md border bg-background py-2 pl-9 pr-9 text-sm focus:outline-none disabled:opacity-60 ${addressErrors.city ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                            >
                              <option value="" disabled>{province ? "Select city" : "Select province first"}</option>
                              {(CITIES_BY_PROVINCE[province] || []).map(c => <option key={c} value={c}>{c}</option>)}
                              <option value={OTHERS}>Others (type your own)</option>
                            </select>
                          )}
                          {province !== OTHERS && <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />}
                        </div>
                        {city === OTHERS && province !== OTHERS && (
                          <input
                            value={cityOther}
                            onChange={(e) => setCityOther(e.target.value)}
                            placeholder="Please specify city"
                            className="mt-2 w-full rounded-md border border-brand/50 bg-background px-3 py-2 text-sm focus:border-brand focus:outline-none"
                          />
                        )}
                        {addressErrors.city && <p className="mt-1 text-xs text-red-500">{addressErrors.city}</p>}
                      </div>
  
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold uppercase text-muted-foreground">Barangay</label>
                        <div className="relative mt-1.5">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            value={barangay}
                            onChange={(e) => { setBarangay(e.target.value); setAddressErrors(p => ({ ...p, barangay: "" })) }}
                            placeholder="Type your barangay"
                            className={`w-full rounded-md border bg-background py-2 pl-9 pr-3 text-sm focus:outline-none ${addressErrors.barangay ? "border-red-400 focus:border-red-400" : "focus:border-brand"}`}
                          />
                        </div>
                        {addressErrors.barangay && <p className="mt-1 text-xs text-red-500">{addressErrors.barangay}</p>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="pt-4">
                  <label className="text-sm font-medium">Address</label>
                  <p className="mt-1.5 rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">{data.address}</p>
                </div>
              )}

              {saveError && (
                <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{saveError}</p>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <button
                  onClick={() => handleSaveDetails()}
                  disabled={savingAddress}
                  className="flex items-center justify-center rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-50"
                >
                  {savingAddress ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'vehicles' && (
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-bold">Your vehicles</h1>
            <p className="mt-1 text-sm text-muted-foreground">Add at least one car. You can add more any time.</p>
            
            {data.vehicles.length > 0 && (
              <div className="mt-6 space-y-3">
                {data.vehicles.map(v => (
                  <div key={v.id} className="rounded-md border p-4 bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-sm">{v.make} {v.model}</div>
                      <div className="text-xs text-muted-foreground">{v.year} • {v.plate}</div>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 border-t pt-6">
              {data.vehicles.length === 0 || showVehicleForm ? (
                <>
                  {data.vehicles.length > 0 && (
                    <div className="mb-4 flex justify-end">
                      <button 
                        onClick={() => setShowVehicleForm(false)}
                        className="text-sm font-semibold text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  <h3 className="text-sm font-semibold mb-2">{data.vehicles.length > 0 ? 'Add another vehicle' : 'Add a vehicle'}</h3>
                  <VehicleForm 
                    onSaved={async () => {
                      const res = await fetch('/api/customer/setup')
                      const j = await res.json()
                      if (j.success) {
                        setData(j)
                        setShowVehicleForm(false)
                      }
                    }} 
                  />
                </>
              ) : (
                <button
                  onClick={() => setShowVehicleForm(true)}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  + Add another vehicle
                </button>
              )}
            </div>

            <div className="mt-8 pt-6 border-t">
              <button
                onClick={handleComplete}
                disabled={data.vehicles.length === 0 || completing}
                className="w-full flex items-center justify-center rounded-md bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition-all hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </button>
              {data.vehicles.length === 0 && (
                <p className="mt-2 text-center text-xs text-muted-foreground">Continue is switched off until you add a car.</p>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="rounded-xl border bg-card p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold">Your account is complete</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Welcome, {data.firstName}. Your {data.vehicles[data.vehicles.length - 1]?.make} {data.vehicles[data.vehicles.length - 1]?.model} is saved.
            </p>
            
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/dashboard?book=1&vehicle=${data.vehicles[data.vehicles.length - 1]?.id}`}
                className="flex items-center justify-center rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
              >
                Book a service now
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center justify-center rounded-md border border-input px-6 py-2.5 text-sm font-semibold hover:bg-accent"
              >
                Go to my dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
