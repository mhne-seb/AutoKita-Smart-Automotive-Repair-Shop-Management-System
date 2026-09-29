import { NextResponse } from 'next/server'
import { mlFetch, MlServerError } from '@/lib/mlServer'

// Checking the inbox can take a while, and a sleeping online server needs time to wake.
export const maxDuration = 60

/**
 * POST /api/diagnostics/sync-gmail
 *
 * Admin-triggered: asks the Python server (Email_parser/gmail_fetcher.py) to
 * poll the shop Gmail inbox for new diagnostic scanner PDF reports.
 *
 * Returns a summary of what was processed.
 */
export async function POST() {
  try {
    const res = await mlFetch('/gmail/sync', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data.detail || 'Gmail sync failed' }, { status: 502 })
    }
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    console.error('[/api/diagnostics/sync-gmail] Error:', err)
    // The server answered but the sync itself failed (e.g. Gmail login) — say why.
    if (err instanceof MlServerError && err.detail && err.status !== 401) {
      return NextResponse.json({ error: err.detail }, { status: 502 })
    }
    return NextResponse.json(
      { error: 'Could not reach the report reader. If it was idle, wait a minute and try again.' },
      { status: 503 },
    )
  }
}
