'use client'

import { useState } from 'react'
import { Loader2, User, X } from 'lucide-react'
import { toast } from 'sonner'
import type { InspectionData } from '@/data/types'
import { isValidPlateNumber } from '@/lib/plate'

export function EditCustomerModal({
  jobOrderId,
  data,
  locked,
  onClose,
  onSaved,
}: {
  jobOrderId: string
  data: InspectionData
  locked: boolean
  onClose: () => void
  onSaved: () => void
}) {
  // What the form starts with. Save stays gray until something differs from this.
  const start = {
    firstName: data.customerDetails?.firstName || '',
    lastName: data.customerDetails?.lastName || '',
    contactNumber: data.customerDetails?.contactNumber || '',
    email: data.customerDetails?.email || '',
    address: data.customerDetails?.address === 'None' ? '' : (data.customerDetails?.address || ''),
    plateNumber: data.vehicleDetails?.plateNumber || '',
    make: data.vehicleDetails?.make || '',
    model: data.vehicleDetails?.model || '',
    year: data.vehicleDetails?.year?.toString() || '',
    mileage: data.vehicleDetails?.mileage?.toString() || '',
  }

  const [firstName, setFirstName] = useState(start.firstName)
  const [lastName, setLastName] = useState(start.lastName)
  const [contactNumber, setContactNumber] = useState(start.contactNumber)
  const [email, setEmail] = useState(start.email)
  const [address, setAddress] = useState(start.address)

  const [plateNumber, setPlateNumber] = useState(start.plateNumber)
  const [make, setMake] = useState(start.make)
  const [model, setModel] = useState(start.model)
  const [year, setYear] = useState(start.year)
  const [mileage, setMileage] = useState(start.mileage)

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))

  const errors = {
    firstName: !firstName.trim() ? 'Required.' : firstName.length > 50 ? 'Max 50 characters.' : '',
    lastName: !lastName.trim() ? 'Required.' : lastName.length > 50 ? 'Max 50 characters.' : '',
    contactNumber: (() => {
      const p = contactNumber.replace(/[\s-]/g, '')
      if (p && !/^(\+?63|0)9\d{9}$/.test(p)) return 'Invalid format.'
      return ''
    })(),
    email: email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? 'Invalid format.' : '',
    address: address.length > 200 ? 'Max 200 characters.' : '',
    plateNumber: plateNumber.trim() && !isValidPlateNumber(plateNumber) ? 'Invalid format.' : '',
    make: '',
    model: !model.trim() ? 'Required.' : '',
    year: (() => {
      if (!year.trim()) return ''
      const y = Number(year)
      if (isNaN(y) || y < 1900 || y > new Date().getFullYear() + 1) return 'Invalid year.'
      return ''
    })(),
    mileage: (() => {
      if (!mileage.trim()) return ''
      const m = Number(mileage)
      if (!Number.isInteger(m) || m < 0 || m > 1000000) return '0 to 1,000,000 km.'
      return ''
    })()
  }

  const hasErrors = Object.values(errors).some((e) => e !== '')

  const hasChanges =
    firstName.trim() !== start.firstName.trim() ||
    lastName.trim() !== start.lastName.trim() ||
    contactNumber.trim() !== start.contactNumber.trim() ||
    email.trim() !== start.email.trim() ||
    address.trim() !== start.address.trim() ||
    plateNumber.trim() !== start.plateNumber.trim() ||
    make.trim() !== start.make.trim() ||
    model.trim() !== start.model.trim() ||
    year.trim() !== start.year.trim() ||
    mileage.trim() !== start.mileage.trim()

  const getInputClass = (field: keyof typeof errors) => {
    return `mt-1 w-full rounded-lg border p-2 text-sm text-slate-700 outline-none ${
      touched[field] && errors[field] ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:border-emerald-500'
    }`
  }

  async function save() {
    if (locked || !hasChanges || hasErrors) {
      if (hasErrors) {
        setTouched({
          firstName: true, lastName: true, contactNumber: true, email: true,
          address: true, plateNumber: true, make: true, model: true, year: true, mileage: true
        })
      }
      return
    }
    setErrorMsg('')
    setSaving(true)
    
    try {
      const res = await fetch(`/api/job-orders/${jobOrderId}/customer`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          contactNumber,
          email,
          address,
          vehicle: { plateNumber, make, model, year, mileage }
        })
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        if (res.status === 401 || res.status === 403) {
          setErrorMsg("Your login doesn't allow this. Please log out and log in again as staff.")
        } else {
          setErrorMsg(json.message || 'Failed to save changes.')
        }
        setSaving(false)
        return
      }
      
      toast.success('Customer details updated successfully.')
      onSaved()
      onClose()
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><User size={18} className="text-emerald-600" /> Edit Details</h3>
            <p className="mt-0.5 text-sm text-slate-500">Update customer and vehicle information.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-slate-100" aria-label="Close"><X size={16} className="text-slate-500" /></button>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">
            {errorMsg}
          </div>
        )}

        {locked && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
            Details are locked once the job is completed.
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 border-b pb-1">Customer</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">First Name
                <input value={firstName} onChange={e => setFirstName(e.target.value)} onBlur={() => markTouched('firstName')} disabled={locked} className={getInputClass('firstName')} />
                {touched.firstName && errors.firstName && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.firstName}</span>}
              </label>
              <label className="block text-xs font-semibold text-slate-700">Last Name
                <input value={lastName} onChange={e => setLastName(e.target.value)} onBlur={() => markTouched('lastName')} disabled={locked} className={getInputClass('lastName')} />
                {touched.lastName && errors.lastName && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.lastName}</span>}
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">Contact Number
                <input value={contactNumber} onChange={e => setContactNumber(e.target.value)} onBlur={() => markTouched('contactNumber')} disabled={locked} className={getInputClass('contactNumber')} />
                {touched.contactNumber && errors.contactNumber && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.contactNumber}</span>}
              </label>
              <label className="block text-xs font-semibold text-slate-700">Email
                <input value={email} onChange={e => setEmail(e.target.value)} onBlur={() => markTouched('email')} disabled={locked} type="email" className={getInputClass('email')} />
                {touched.email && errors.email && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.email}</span>}
              </label>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Approval codes and reports are sent to this address. Check it with the customer before saving.</p>
            <label className="mt-3 block text-xs font-semibold text-slate-700">Address
              <input value={address} onChange={e => setAddress(e.target.value)} onBlur={() => markTouched('address')} disabled={locked} className={getInputClass('address')} />
              {touched.address && errors.address && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.address}</span>}
            </label>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-slate-900 border-b pb-1">Vehicle</h4>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">Plate Number
                <input value={plateNumber} onChange={e => setPlateNumber(e.target.value)} onBlur={() => markTouched('plateNumber')} disabled={locked} className={`uppercase ${getInputClass('plateNumber')}`} />
                {touched.plateNumber && errors.plateNumber && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.plateNumber}</span>}
              </label>
              <label className="block text-xs font-semibold text-slate-700">Year
                <input value={year} onChange={e => setYear(e.target.value)} onBlur={() => markTouched('year')} type="number" disabled={locked} className={getInputClass('year')} />
                {touched.year && errors.year && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.year}</span>}
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">Make
                <input value={make} onChange={e => setMake(e.target.value)} onBlur={() => markTouched('make')} disabled={locked} className={getInputClass('make')} />
                {touched.make && errors.make && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.make}</span>}
              </label>
              <label className="block text-xs font-semibold text-slate-700">Model
                <input value={model} onChange={e => setModel(e.target.value)} onBlur={() => markTouched('model')} disabled={locked} className={getInputClass('model')} />
                {touched.model && errors.model && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.model}</span>}
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-slate-700">Mileage (km)
                <input value={mileage} onChange={e => setMileage(e.target.value)} onBlur={() => markTouched('mileage')} type="number" min={0} max={1000000} disabled={locked} className={getInputClass('mileage')} />
                {touched.mileage && errors.mileage && <span className="mt-1 block text-[10px] font-normal text-red-500">{errors.mileage}</span>}
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={save} disabled={saving || locked || !hasChanges || hasErrors} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:hover:bg-slate-200">
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save Details
          </button>
        </div>
      </div>
    </div>
  )
}
