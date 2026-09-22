import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/diagnostics/sync-gmail
 *
 * Admin-triggered endpoint that spawns gmail_fetcher.py to poll the shop
 * Gmail inbox for new diagnostic scanner PDF reports.
 *
 * Returns a summary of what was processed.
 */
export async function POST(req: NextRequest) {
  try {
    const result = await runGmailFetcher()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[/api/diagnostics/sync-gmail] Error:', err)
    return NextResponse.json({ error: 'Gmail sync failed' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helper: spawn gmail_fetcher.py and parse the summary line
// ---------------------------------------------------------------------------
function runGmailFetcher(): Promise<{
  fetched: number
  validated: number
  stored: number
  skipped: number
  output: string
}> {
  return new Promise((resolve, reject) => {
    const fetcherScript = path.join(process.cwd(), 'Email_parser', 'gmail_fetcher.py')
    const proc = spawn('py', ['-3', fetcherScript], {
      stdio: 'pipe',
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      },
    })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => (stdout += chunk))
    proc.stderr.on('data', (chunk) => (stderr += chunk))

    proc.on('close', (code) => {
      if (code !== 0 && stderr) {
        console.error('[gmail_fetcher] stderr:', stderr)
      }

      // Parse the [Done] summary line that gmail_fetcher.py prints last
      const match = stdout.match(
        /fetched=(\d+)\s+validated=(\d+)\s+stored=(\d+)\s+skipped=(\d+)/
      )
      if (match) {
        resolve({
          fetched:   parseInt(match[1]),
          validated: parseInt(match[2]),
          stored:    parseInt(match[3]),
          skipped:   parseInt(match[4]),
          output:    stdout.trim(),
        })
      } else {
        // Return raw output if parsing fails
        resolve({ fetched: 0, validated: 0, stored: 0, skipped: 0, output: stdout.trim() })
      }
    })

    proc.on('error', reject)
  })
}
