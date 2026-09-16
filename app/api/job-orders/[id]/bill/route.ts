import { NextResponse } from 'next/server'
import { getJobOrderBill } from '@/lib/jobOrderBill'

// Admin-side: what this job order costs, what's been paid, and the latest
// payment waiting on (or already through) verification.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const bill = await getJobOrderBill(Number(id))
    return NextResponse.json({ success: true, bill })
  } catch (error) {
    console.error('Bill fetch error:', error)
    return NextResponse.json({ success: false, message: 'Failed to load bill' }, { status: 500 })
  }
}
