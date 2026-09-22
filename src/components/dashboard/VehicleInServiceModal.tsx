"use client";

import { Car } from "lucide-react";

// Shown when a customer tries to book a vehicle that is already in the shop.
// One car can only have one open job order at a time, so instead of a browser
// alert we explain it in plain words.
export function VehicleInServiceModal({ plate, onClose }: { plate: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
          <Car className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-bold">This car is already in the shop</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {plate ? <span className="font-semibold text-foreground">{plate}</span> : "This vehicle"} still has a
          service going on. You can book it again once that service is done.
        </p>
        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground hover:opacity-90"
        >
          Okay
        </button>
      </div>
    </div>
  );
}
