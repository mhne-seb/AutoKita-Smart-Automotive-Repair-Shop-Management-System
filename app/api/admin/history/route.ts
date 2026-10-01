import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Service History (admin): every ticket, together with its job order when it
// has one, newest first. Real data, searched / filtered / sorted / paged in
// the database so the browser never receives thousands of rows.
//
// One row = one ticket (a booking). A ticket that was declined or is still
// pending has no job order; a job order always belongs to exactly one ticket.

const STATUSES = ['pending', 'in_progress', 'completed', 'released', 'cancelled'] as const
const PAGE_SIZES = [10, 20, 50, 100]
const EXPORT_LIMIT = 5000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

// What the admin sees: one plain status, whether the record is a ticket or a job order.
const STATUS_SQL = `
  CASE
    WHEN jo.id IS NULL THEN
      CASE WHEN st.ticket_status::text IN ('declined', 'cancelled') THEN 'cancelled' ELSE 'pending' END
    WHEN jo.status::text = 'released' THEN 'released'
    WHEN jo.status::text = 'completed' THEN 'completed'
    WHEN jo.status::text = 'cancelled' THEN 'cancelled'
    ELSE 'in_progress'
  END`

// Only these can be sorted on (whitelist: the value is put into the SQL text).
const SORTS: Record<string, string> = {
  date: 'record_date',
  id: 'ticket_id',
  customer: "LOWER(CONCAT_WS(' ', last_name, first_name))",
  status: 'record_status',
}

// Seeded demo tickets carry dates months in the future; they must not sit at the top.
function orderBy(sort: string, dir: 'ASC' | 'DESC') {
  const key = SORTS[sort]
  if (sort === 'date') return `(record_date > NOW()) ASC, record_date ${dir}, ticket_id DESC`
  return `${key} ${dir}, ticket_id DESC`
}

// A ticket with no job order yet only has the booking note, e.g.
// "Requested: Oct 2, 2026 04:00 PM | Service: Brake Service | brake issues"; show just the service.
function serviceFromConcern(concern: string | null): string {
  if (!concern) return ''
  const m = /Service:\s*([^|]+)/i.exec(concern)
  return (m ? m[1] : concern).trim().slice(0, 120)
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

export async function GET(req: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response

  try {
    const sp = new URL(req.url).searchParams

    // ---- validate every input (server side is the real check) ----
    const page = Number.parseInt(sp.get('page') ?? '1', 10)
    const pageSize = Number.parseInt(sp.get('pageSize') ?? '10', 10)
    const q = (sp.get('q') ?? '').trim()
    const status = sp.get('status') ?? ''
    const from = sp.get('from') ?? ''
    const to = sp.get('to') ?? ''
    const sort = sp.get('sort') ?? 'date'
    const dir = (sp.get('dir') ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
    const exportAll = sp.get('export') === '1'

    const bad = (message: string) => NextResponse.json({ success: false, message }, { status: 400 })
    if (!Number.isInteger(page) || page < 1 || page > 100000) return bad('Page must be a whole number of 1 or more.')
    if (!PAGE_SIZES.includes(pageSize)) return bad('Rows per page must be 10, 20, 50 or 100.')
    if (q.length > 100) return bad('Search is too long (100 characters at most).')
    if (status && !(STATUSES as readonly string[]).includes(status)) return bad('Unknown status.')
    if (from && !DATE_RE.test(from)) return bad('Start date must look like 2026-10-01.')
    if (to && !DATE_RE.test(to)) return bad('End date must look like 2026-10-01.')
    if (from && to && from > to) return bad('The start date is after the end date.')
    if (!(sort in SORTS)) return bad('Unknown sort column.')

    // ---- the shared filter (search + dates; status is applied separately so the counts stay useful) ----
    const params: unknown[] = []
    const add = (v: unknown) => { params.push(v); return `$${params.length}` }
    const where: string[] = []
    if (q) {
      const p = add(`%${escapeLike(q.toLowerCase())}%`)
      where.push(`LOWER(CONCAT_WS(' ', first_name, last_name, email, plate_number, vehicle_model,
                   'st-' || ticket_id, 'jo-' || COALESCE(job_order_id::text, ''))) LIKE ${p} ESCAPE '\\'`)
    }
    if (from) where.push(`record_date::date >= ${add(from)}::date`)
    if (to) where.push(`record_date::date <= ${add(to)}::date`)
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const baseCte = `
      WITH base AS (
        SELECT st.id AS ticket_id, jo.id AS job_order_id, st.request_date AS record_date,
               ${STATUS_SQL} AS record_status,
               st.customer_concern, st.service_mode::text AS service_mode,
               u.first_name, u.last_name, u.email, u.contact_number,
               v.vehicle_model, v.vehicle_year, v.plate_number,
               (wc.id IS NOT NULL) AS is_warranty_claim,
               jo.completed_at, jo.released_at
        FROM service_tickets st
        JOIN users u ON u.id = st.user_id
        JOIN vehicles v ON v.id = st.vehicle_id
        LEFT JOIN job_orders jo ON jo.ticket_id = st.id
        LEFT JOIN warranty_claims wc ON wc.ticket_id = st.id
      ),
      scoped AS (SELECT * FROM base ${whereSql})`

    // counts per status for the chips (ignores the status filter itself); runs alongside the rows below
    const scopedParams = [...params]
    const countsPromise = db.query(`${baseCte} SELECT record_status, COUNT(*)::int AS n FROM scoped GROUP BY record_status`, scopedParams)

    // ---- the rows of this page ----
    const statusSql = status ? `WHERE record_status = ${add(status)}` : ''
    const limit = exportAll ? EXPORT_LIMIT : pageSize
    const offset = exportAll ? 0 : (page - 1) * pageSize
    const limitP = add(limit), offsetP = add(offset)

    const rowsPromise = db.query(
      `${baseCte},
       paged AS (
         SELECT * FROM scoped ${statusSql}
         ORDER BY ${orderBy(sort, dir)}
         LIMIT ${limitP} OFFSET ${offsetP}
       )
       SELECT p.*, sv.service_names, bl.total, bl.paid
       FROM paged p
       LEFT JOIN LATERAL (
         SELECT STRING_AGG(DISTINCT s.service_name, ', ') AS service_names
         FROM job_order_services jos JOIN services s ON s.id = jos.service_id
         WHERE jos.job_order_id = p.job_order_id
       ) sv ON p.job_order_id IS NOT NULL
       LEFT JOIN LATERAL (
         SELECT (SELECT COALESCE(SUM(actual_amount), 0) FROM job_order_services WHERE job_order_id = p.job_order_id)
              + (SELECT COALESCE(SUM(total_retail_amount), 0) FROM job_order_parts WHERE job_order_id = p.job_order_id) AS total,
                (SELECT COALESCE(SUM(amount_paid), 0) FROM payments
                  WHERE job_order_id = p.job_order_id AND verification_status = 'verified') AS paid
       ) bl ON p.job_order_id IS NOT NULL
       ORDER BY ${orderBy(sort, dir)}`,
      params,
    )
    const [countsRes, rowsRes] = await Promise.all([countsPromise, rowsPromise])
    const counts: Record<string, number> = { all: 0, pending: 0, in_progress: 0, completed: 0, released: 0, cancelled: 0 }
    for (const r of countsRes.rows) { counts[r.record_status] = r.n; counts.all += r.n }
    const total = status ? counts[status] ?? 0 : counts.all

    const rows = rowsRes.rows.map((r) => ({
      ticketId: r.ticket_id,
      jobOrderId: r.job_order_id,
      date: r.record_date,
      status: r.record_status,
      customer: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Unknown',
      email: r.email,
      contact: r.contact_number,
      vehicle: [r.vehicle_year, r.vehicle_model].filter(Boolean).join(' '),
      plate: r.plate_number,
      services: r.service_names || serviceFromConcern(r.customer_concern),
      serviceMode: r.service_mode,
      isWarrantyClaim: r.is_warranty_claim,
      total: r.job_order_id ? Number(r.total ?? 0) : null,
      paid: r.job_order_id ? Number(r.paid ?? 0) : null,
      completedAt: r.completed_at,
      releasedAt: r.released_at,
    }))

    return NextResponse.json({
      success: true, rows, counts, total,
      page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)),
      truncated: exportAll && total > EXPORT_LIMIT,
    })
  } catch (err) {
    console.error('Service history list error:', err)
    return NextResponse.json(
      { success: false, message: 'Could not load the service history.', ...(process.env.NODE_ENV !== 'production' ? { debug: err instanceof Error ? err.message : String(err) } : {}) },
      { status: 500 },
    )
  }
}
