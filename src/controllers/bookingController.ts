// bookingController
//
// Backs the /book flow (Customer side). Right now "submitting" a booking just
// resolves with a generated booking id — there is no persistence, matching
// the rest of this frontend-only demo

export interface BookingRequest {
  service: string
  date: string
  time: string
  vehicle: string
  mode: 'Shop Visit' | 'Home Service'
  notes?: string
}

export interface BookingResult {
  success: boolean
  bookingId: string
}

function simulateDelay<T>(value: T, ms = 500): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function createBooking(request: BookingRequest): Promise<BookingResult> {
  // Mock booking id
  const bookingId = `BK-${Date.now().toString().slice(-6)}`
  return simulateDelay({ success: true, bookingId })
}
