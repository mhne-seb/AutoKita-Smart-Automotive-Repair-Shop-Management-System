import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { spawn } from 'child_process'
import path from 'path'
import os from 'os'
import fs from 'fs'

interface VehicleInfo {
  vin?: string | null
  plate?: string | null
  make?: string | null
  model?: string | null
  year?: number | null
  engine?: string | null
  mileage?: number | null
}

interface DtcCode {
  code: string
  description?: string | null
  state?: string | null
  system?: string | null
}

interface ParsedReport {
  scanner_tool?: string | null
  scanner_software?: string | null
  report_date?: string | null
  vehicle_info?: VehicleInfo
  dtc_codes?: DtcCode[]
  source_email_uid?: string | null
}

/**
 * POST /api/diagnostics/store
 *
 * Accepts a parsed OBD-II diagnostic report (from gmail_fetcher.py or a
 * manual PDF upload via multipart/form-data) and persists it to the database.
 *
 * Body (JSON from gmail_fetcher.py):
 *   { source: "gmail", filename: "Hyundai_KMHCT.pdf", parsed: { ...ParsedReport } }
 *
 * Body (multipart from manual upload):
 *   form field "file" = PDF file
 *   form field "source" = "manual_upload"
 */
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') || ''
  let source: string = 'gmail'
  let filename: string = 'report.pdf'
  let parsed: ParsedReport | null = null
  let pdfBuffer: Buffer | null = null

  try {
    if (contentType.includes('multipart/form-data')) {
      // -----------------------------------------------------------------------
      // Manual PDF upload from the UI
      // -----------------------------------------------------------------------
      const formData = await req.formData()
      source = (formData.get('source') as string) || 'manual_upload'
      const file = formData.get('file') as File | null
      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 })
      }
      filename = file.name
      const arrayBuffer = await file.arrayBuffer()
      pdfBuffer = Buffer.from(arrayBuffer)

      // Write to temp file and run Python parser
      const tmpPath = path.join(os.tmpdir(), `obd2_${Date.now()}_${filename}`)
      fs.writeFileSync(tmpPath, pdfBuffer)

      parsed = await runParser(tmpPath)
      fs.unlinkSync(tmpPath)

      if (!parsed) {
        return NextResponse.json({ error: 'Failed to parse PDF' }, { status: 422 })
      }
    } else {
      // -----------------------------------------------------------------------
      // JSON payload from gmail_fetcher.py
      // -----------------------------------------------------------------------
      const body = await req.json()
      source = body.source ?? 'gmail'
      filename = body.filename ?? 'report.pdf'
      parsed = body.parsed as ParsedReport
    }

    if (!parsed) {
      return NextResponse.json({ error: 'No parsed data provided' }, { status: 400 })
    }

    const vi = parsed.vehicle_info ?? {}

    // Insert the report header row (including filename for identification when VIN is absent)
    const reportRes = await db.query<{ id: number }>(
      `INSERT INTO obd2_diagnostic_reports
         (scanner_tool, scanner_software, report_date, test_mileage,
          reported_vin, reported_plate, reported_make, reported_model,
          reported_year, reported_engine,
          source, source_email_uid, pdf_storage_url, filename,
          datetime_created)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
       RETURNING id`,
      [
        parsed.scanner_tool ?? null,
        parsed.scanner_software ?? null,
        parsed.report_date ?? null,
        vi.mileage ?? null,
        vi.vin ? String(vi.vin).trim().toUpperCase() : null,
        vi.plate ? String(vi.plate).trim().toUpperCase() : null,
        vi.make ?? null,
        vi.model ?? null,
        vi.year ?? null,
        vi.engine ?? null,
        source,
        parsed.source_email_uid ?? null,
        null, // pdf_storage_url — future: upload to Supabase Storage
        filename,
      ]
    )

    const reportId = reportRes.rows[0].id

    // Bulk-insert DTC codes
    const dtcCodes = parsed.dtc_codes ?? []
    if (dtcCodes.length > 0) {
      const values: unknown[] = []
      const placeholders = dtcCodes.map((dtc, i) => {
        const base = i * 4
        values.push(reportId, dtc.code, dtc.description ?? null, dtc.state ?? null, dtc.system ?? null)
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
      })

      // Rebuild with correct indices
      const vals: unknown[] = []
      const phs = dtcCodes.map((dtc, i) => {
        const b = i * 5 + 1
        vals.push(reportId, dtc.code, dtc.description ?? null, dtc.state ?? null, dtc.system ?? null)
        return `($${b}, $${b + 1}, $${b + 2}, $${b + 3}, $${b + 4})`
      })

      await db.query(
        `INSERT INTO obd2_dtc_codes (report_id, dtc_code, description, state, system)
         VALUES ${phs.join(', ')}`,
        vals
      )
    }

    // Audit log
    await db.query(
      `INSERT INTO system_audit_logs
         (action_performed, entity_type, entity_id, new_values, action_date)
       VALUES ('created', 'obd2_diagnostic_reports', $1, $2, NOW())`,
      [reportId, JSON.stringify({ source, filename, dtc_count: dtcCodes.length })]
    )

    return NextResponse.json({
      success: true,
      report_id: reportId,
      dtc_count: dtcCodes.length,
    })
  } catch (err) {
    console.error('[/api/diagnostics/store] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helper: run pdf_parser.py on a local file path
// ---------------------------------------------------------------------------
function runParser(pdfPath: string): Promise<ParsedReport | null> {
  return new Promise((resolve) => {
    const parserScript = path.join(process.cwd(), 'Email_parser', 'pdf_parser.py')
    const proc = spawn('py', ['-3', parserScript, pdfPath], { stdio: 'pipe' })

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', (chunk) => (stdout += chunk))
    proc.stderr.on('data', (chunk) => (stderr += chunk))

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[runParser] Python exited with code', code, stderr)
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch {
        console.error('[runParser] JSON parse error:', stdout)
        resolve(null)
      }
    })
  })
}
