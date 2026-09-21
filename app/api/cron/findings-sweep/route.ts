import { NextRequest, NextResponse } from 'next/server'
import { sweepPendingFindings } from '@/lib/findingsSweep'

// Production hook for the finding reminders — point a cron (Vercel Cron,
// cron-job.org, a server crontab) at this every 5–10 minutes. If CRON_SECRET
// is set in the environment the request must carry it as a Bearer token;
// with no secret configured (local dev) it's open.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
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
