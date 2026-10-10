'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { normalizePlateNumber, isValidPlateNumber } from '@/lib/plate'

const BOOK_VEHICLE_MAKES = [
  "Toyota", "Honda", "Mitsubishi", "Ford", "Nissan", "Hyundai", "Kia",
  "Suzuki", "Isuzu", "Mazda", "Chevrolet", "Subaru", "Volkswagen",
  "BMW", "Mercedes-Benz", "Peugeot", "Geely", "Chery", "MG",
]
const BOOK_YEARS = Array.from({ length: 20 }, (_, i) => String(new Date().getFullYear() - i))
const BOOK_OTHERS = "Others"

export default function RegisterVehiclePage() {
  const router = useRouter()
  
  const [make, setMake] = useState("")
  const [makeOther, setMakeOther] = useState("")
  const [model, setModel] = useState("")
  const [year, setYear] = useState("")
  const [transmission, setTransmission] = useState("")
  const [mileage, setMileage] = useState("")
  const [plate, setPlate] = useState("")
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [apiError, setApiError] = useState("")

  const validate = () => {
    const errs: Record<string, string> = {}
    
    if (!make) {
      errs.make = "Vehicle make is required"
    } else if (make === BOOK_OTHERS && !makeOther.trim()) {
      errs.makeOther = "Please specify vehicle make"
    }
    
    if (!model.trim()) {
      errs.model = "Vehicle model is required"
    }
    
    if (!year) {
      errs.year = "Year is required"
    }
    
    if (!transmission) {
      errs.transmission = "Transmission is required"
    }
    
    if (!mileage) {
      errs.mileage = "Mileage is required"
    } else if (parseFloat(mileage) < 0) {
      errs.mileage = "Mileage cannot be negative"
    }
    
    if (!plate.trim()) {
      errs.plate = "License plate is required"
    } else if (!isValidPlateNumber(normalizePlateNumber(plate))) {
      errs.plate = "Invalid license plate format (e.g., ABC-1234)"
    }
    
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    
    setIsSubmitting(true)
    setApiError("")
    
    const finalMake = make === BOOK_OTHERS ? makeOther.trim() : make
    
    try {
      const res = await fetch('/api/customer/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          make: finalMake,
          model: model.trim(),
          year,
          transmission,
          mileage,
          plate: plate.trim()
        })
      })
      const data = await res.json()
      
      if (data.success) {
        toast.success("Vehicle saved.")
        router.push('/dashboard/vehicles')
      } else {
        if (data.code === 'PLATE_REGISTERED' || data.code === 'INVALID_PLATE_FORMAT') {
          setErrors({ plate: data.message })
        } else {
          setApiError(data.message || "Failed to save vehicle")
        }
        setIsSubmitting(false)
      }
    } catch (err) {
      setApiError("Network error. Please try again.")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/vehicles" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to my vehicles
      </Link>
      
      <div className="rounded-xl border bg-card p-6 md:p-8">
        <h1 className="text-2xl font-bold">Register vehicle</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add your vehicle details to easily book services later.</p>
        
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Vehicle Make</label>
              <select
                value={make}
                onChange={e => { setMake(e.target.value); setErrors(prev => ({ ...prev, make: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.make ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              >
                <option value="" disabled>Select Brand</option>
                {BOOK_VEHICLE_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                <option value={BOOK_OTHERS}>Others (type your own)</option>
              </select>
              {errors.make && <p className="mt-1 text-xs font-medium text-rose-500">{errors.make}</p>}
              
              {make === BOOK_OTHERS && (
                <div className="mt-3">
                  <input
                    placeholder="Enter brand name"
                    value={makeOther}
                    onChange={e => { setMakeOther(e.target.value); setErrors(prev => ({ ...prev, makeOther: "" })) }}
                    className={`w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.makeOther ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
                  />
                  {errors.makeOther && <p className="mt-1 text-xs font-medium text-rose-500">{errors.makeOther}</p>}
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Vehicle Model</label>
              <input
                placeholder="e.g., Vios, Civic, Montero"
                value={model}
                onChange={e => { setModel(e.target.value); setErrors(prev => ({ ...prev, model: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.model ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              />
              {errors.model && <p className="mt-1 text-xs font-medium text-rose-500">{errors.model}</p>}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Year</label>
              <select
                value={year}
                onChange={e => { setYear(e.target.value); setErrors(prev => ({ ...prev, year: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.year ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              >
                <option value="" disabled>Select Year</option>
                {BOOK_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              {errors.year && <p className="mt-1 text-xs font-medium text-rose-500">{errors.year}</p>}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Transmission</label>
              <select
                value={transmission}
                onChange={e => { setTransmission(e.target.value); setErrors(prev => ({ ...prev, transmission: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.transmission ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              >
                <option value="" disabled>Select Transmission</option>
                <option value="Automatic">Automatic</option>
                <option value="Manual">Manual</option>
                <option value="CVT">CVT</option>
                <option value="Semi-Automatic">Semi-Automatic</option>
              </select>
              {errors.transmission && <p className="mt-1 text-xs font-medium text-rose-500">{errors.transmission}</p>}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">Mileage (km)</label>
              <input
                type="number"
                placeholder="e.g., 50000"
                value={mileage}
                onChange={e => { setMileage(e.target.value); setErrors(prev => ({ ...prev, mileage: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 ${errors.mileage ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              />
              {errors.mileage && <p className="mt-1 text-xs font-medium text-rose-500">{errors.mileage}</p>}
            </div>

            <div>
              <label className="text-[10px] font-semibold uppercase text-muted-foreground">License Plate</label>
              <input
                placeholder="e.g., ABC-1234"
                value={plate}
                onChange={e => { setPlate(e.target.value); setErrors(prev => ({ ...prev, plate: "" })) }}
                className={`mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm uppercase focus:outline-none focus:ring-1 ${errors.plate ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500' : 'border-input focus:border-brand focus:ring-brand'}`}
              />
              {errors.plate && <p className="mt-1 text-xs font-medium text-rose-500">{errors.plate}</p>}
            </div>
          </div>
          
          {apiError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {apiError}
            </div>
          )}

          <div className="flex justify-end border-t pt-6">
            <button
              type="submit"
              disabled={isSubmitting || Object.values(errors).some(Boolean)}
              className="flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Saving...' : 'Save vehicle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
