import { NextRequest, NextResponse } from 'next/server'
import { sweepPendingFindings } from '@/lib/findingsSweep'

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const production = process.env.NODE_ENV === 'production'
  if ((production && !secret) || (secret && request.headers.get('authorization') !== `Bearer ${secret}`)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await sweepPendingFindings(true)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('[cron/findings-sweep] error:', error)
    return NextResponse.json({ success: false, message: 'Sweep failed' }, { status: 500 })
  }
}
