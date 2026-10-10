'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, Car, X, Calendar, Info } from 'lucide-react'

type Vehicle = {
  id: number
  make: string
  model: string
  year: string
  plate: string
  transmission: string
  mileage: number
  inService: boolean
  activeJobOrderId: number | null
}

type HistoryRecord = {
  id: number
  status: string
  date: string | null
  services: string[]
  total: number | null
}

const vehicleName = (v: Vehicle) => (v.make ? `${v.make} ${v.model}` : v.model)

function StatusPill({ inService }: { inService: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${
        inService
          ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${inService ? 'bg-amber-500' : 'bg-emerald-500'}`} />
      {inService ? 'In service now' : 'Ready'}
    </span>
  )
}

function PlateBadge({ plate }: { plate: string }) {
  return (
    <span className="inline-block whitespace-nowrap rounded border bg-muted/40 px-2 py-0.5 text-xs font-semibold tracking-wider">
      {plate}
    </span>
  )
}

export default function MyVehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [historyFor, setHistoryFor] = useState<Vehicle | null>(null)
  const router = useRouter()

  const load = () => {
    setLoading(true)
    setError(false)
    fetch('/api/customer/vehicles')
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => {
        if (data.success) {
          setVehicles(data.vehicles)
        } else {
          setError(true)
        }
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    document.title = 'My Vehicles — AutoKita'
    load()
  }, [])

  const book = (id: number) => router.push(`/dashboard?book=1&vehicle=${id}`)

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center px-6 py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <p className="mb-4 text-sm text-muted-foreground">Could not load your vehicles.</p>
        <button onClick={load} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
          Try again
        </button>
      </div>
    )
  }

  if (vehicles.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
          <Car className="h-6 w-6 text-brand" />
        </div>
        <h2 className="text-xl font-bold">Register your first vehicle</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          We keep your car&apos;s details and service history in one place, so booking next time takes seconds.
        </p>
        <Link
          href="/dashboard/vehicles/new"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          Register vehicle
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">My Vehicles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}. Choose View history to see a car&apos;s past services.
          </p>
        </div>
        <Link
          href="/dashboard/vehicles/new"
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
          <Plus className="h-4 w-4" /> Add vehicle
        </Link>
      </div>

      {/* A real table: the header and every row share one set of column widths, so they always line up. */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <table className="w-full border-collapse text-center">
          <thead>
            <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 text-left font-semibold">Vehicle</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Plate</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">Transmission</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold md:table-cell">Mileage</th>
              <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Status</th>
              <th scope="col" className="px-3 py-3 font-semibold">Action</th>
              <th scope="col" className="px-4 py-3 font-semibold">Booking</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map(v => (
              <tr key={v.id} className="border-b align-middle transition-colors last:border-b-0 hover:bg-muted/30">
                <td className="px-4 py-4 text-left">
                  <div className="text-sm font-semibold">{vehicleName(v)}</div>
                  <div className="text-xs text-muted-foreground">{v.year}</div>
                  {/* On a phone the plate and status columns are hidden, so show them here. */}
                  <div className="mt-1.5 flex flex-wrap items-center justify-start gap-1.5 sm:hidden">
                    <PlateBadge plate={v.plate} />
                    <StatusPill inService={v.inService} />
                  </div>
                </td>

                <td className="hidden px-4 py-4 sm:table-cell"><PlateBadge plate={v.plate} /></td>

                <td className="hidden px-4 py-4 text-sm text-muted-foreground md:table-cell">{v.transmission}</td>

                <td className="hidden whitespace-nowrap px-4 py-4 text-sm tabular-nums text-muted-foreground md:table-cell">
                  {Number(v.mileage).toLocaleString()} km
                </td>

                <td className="hidden px-4 py-4 sm:table-cell"><StatusPill inService={v.inService} /></td>

                <td className="px-3 py-4">
                  <button
                    type="button"
                    onClick={() => setHistoryFor(v)}
                    className="rounded-md border px-3 py-2 text-sm font-medium text-brand transition-colors hover:border-brand hover:bg-brand/10 sm:whitespace-nowrap"
                  >
                    View history
                  </button>
                </td>

                <td className="px-4 py-4">
                  <button
                    type="button"
                    disabled={v.inService}
                    title={v.inService ? 'You can book again after this job is done.' : undefined}
                    onClick={() => book(v.id)}
                    className="rounded-md bg-brand px-3.5 py-2 text-sm font-semibold text-brand-foreground transition-all hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none sm:whitespace-nowrap"
                  >
                    Book a service
                  </button>
                  {v.inService && (
                    <div className="mt-1 text-[11px] text-muted-foreground">After this job is done</div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {historyFor && (
        <VehicleHistoryModal
          vehicle={historyFor}
          onClose={() => setHistoryFor(null)}
          onBook={() => book(historyFor.id)}
        />
      )}
    </div>
  )
}

// Service history of one car, shown over the table so the customer keeps their place.
function VehicleHistoryModal({ vehicle, onClose, onBook }: { vehicle: Vehicle; onClose: () => void; onBook: () => void }) {
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    fetch(`/api/customer/vehicles/${vehicle.id}`)
      .then(res => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then(data => {
        if (data.success) setHistory(data.history)
        else setError(true)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [vehicle.id])

  // Keep the page behind still, and let Escape close the modal.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Service history of ${vehicleName(vehicle)}`}
        onClick={e => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl border bg-card shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b p-6">
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{vehicleName(vehicle)} {vehicle.year}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <PlateBadge plate={vehicle.plate} />
              <span>{vehicle.transmission}</span>
              <span>&middot;</span>
              <span>{Number(vehicle.mileage).toLocaleString()} km</span>
              <StatusPill inService={vehicle.inService} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Service history</h3>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-sm text-muted-foreground">Could not load the history.</p>
              <button onClick={load} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground">
                Try again
              </button>
            </div>
          ) : history.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No service history for this car yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {history.map(jo => {
                const statusText = jo.status === 'released' ? 'Completed' : jo.status === 'cancelled' ? 'Cancelled' : 'In progress'
                const dateText = jo.date
                  ? new Date(jo.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Unknown date'
                return (
                  <div key={jo.id} className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{dateText}</span>
                      </div>
                      <div className="mt-1 text-sm font-medium">
                        {jo.services.length > 0 ? jo.services.join(', ') : 'Service'}
                      </div>
                    </div>
                    <div className="flex flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusText === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : statusText === 'Cancelled'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                        }`}
                      >
                        {statusText}
                      </span>
                      {jo.total !== null && (
                        <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                          PHP {jo.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t p-4 px-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {vehicle.inService && (
              <>
                <Info className="h-4 w-4 shrink-0 text-amber-600" />
                <span>This car is in the shop now. You can book again after this job is done.</span>
              </>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="rounded-md border px-5 py-2 text-sm hover:bg-accent">
              Close
            </button>
            <button
              type="button"
              disabled={vehicle.inService}
              onClick={onBook}
              className="rounded-md bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Book a service
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
