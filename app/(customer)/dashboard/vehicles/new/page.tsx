'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { VehicleForm } from '@/components/dashboard/VehicleForm'

export default function RegisterVehiclePage() {
  const router = useRouter()

  const handleSaved = (vehicle: any) => {
    toast.success("Vehicle saved.")
    router.push('/dashboard/vehicles')
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/dashboard/vehicles" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to my vehicles
      </Link>
      
      <div className="rounded-xl border bg-card p-6 md:p-8">
        <h1 className="text-2xl font-bold">Register vehicle</h1>
        <p className="mt-1 text-sm text-muted-foreground">Add your vehicle details to easily book services later.</p>
        
        <VehicleForm onSaved={handleSaved} />
      </div>
    </div>
  )
}
