// app/api/chat/admin/job-session/route.ts
//
// GET ?search=<query>&limit=20
//   → Returns a list of job orders matching the search (by plate or model).
//     No PII (no customer names) returned.
//
// GET ?job_order_id=<N>
//   → Returns the full session payload for a single job order:
//     vehicle info, booked services, parts used, inspection notes,
//     and a pre-built context string ready to inject into the AI chat.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type {
  JobOrderSummary,
  JobOrderService,
  JobOrderPart,
  InspectionNote,
  JobOrderSession,
} from '@/types/jobOrder';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function peso(n: number | null | undefined): string {
  if (n == null) return '—';
  return `₱${Number(n).toLocaleString('en-PH')}`;
}

function buildContextString(session: Omit<JobOrderSession, 'contextString'>): string {
  const lines: string[] = [
    `[Active Job Order Context]`,
    `JO #${session.id} | Status: ${session.status} | Date: ${session.jo_date}`,
    `Vehicle: ${session.vehicle.make} ${session.vehicle.model}${session.vehicle.year ? ` ${session.vehicle.year}` : ''} | Plate: ${session.vehicle.plate}`,
  ];

  if (session.vehicle.mileage) {
    lines.push(`Mileage: ${Number(session.vehicle.mileage).toLocaleString()} km`);
  }

  if (session.services.length > 0) {
    const svcLines = session.services
      .map((s) => `  • ${s.service_name} (est. ${peso(s.estimated_amount ?? null)})`)
      .join('\n');
    lines.push(`Services Booked:\n${svcLines}`);
  } else {
    lines.push('Services Booked: None recorded');
  }

  if (session.parts.length > 0) {
    const partLines = session.parts
      .map((p) => `  • ${p.description || p.part_number} ×${p.quantity} (${peso(p.unit_price)})`)
      .join('\n');
    lines.push(`Parts Used:\n${partLines}`);
  } else {
    lines.push('Parts Used: None recorded');
  }

  if (session.inspectionNotes.length > 0) {
    const noteLines = session.inspectionNotes
      .filter((n) => n.findings || n.notes)
      .map((n) => `  • ${n.name}: ${n.findings || n.notes}`)
      .join('\n');
    if (noteLines) lines.push(`Inspection Findings:\n${noteLines}`);
  }

  return lines.join('\n');
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobOrderId = searchParams.get('job_order_id');
  const search     = searchParams.get('search');
  const limit      = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);

  // ── A) Job order list / search ─────────────────────────────────────────────
  if (!jobOrderId) {
    try {
      const params: unknown[] = [];
      let where = '';

      if (search && search.trim()) {
        const q = `%${search.trim()}%`;
        where = `WHERE (v.plate_number ILIKE $1 OR v.vehicle_model ILIKE $1 OR CAST(jo.id AS VARCHAR) = $2)`;
        params.push(q, search.trim());
      }

      const res = await db.query<JobOrderSummary>(`
        SELECT
          jo.id,
          jo.jo_date::text     AS jo_date,
          jo.status::text      AS status,
          COALESCE(v.plate_number, '—') AS plate_number,
          COALESCE(v.vehicle_make, 'Unknown') AS vehicle_make,
          COALESCE(v.vehicle_model, 'Unknown') AS vehicle_model,
          v.vehicle_year
        FROM job_orders jo
        JOIN vehicles v ON v.id = jo.vehicle_id
        ${where}
        ORDER BY jo.jo_date DESC, jo.id DESC
        LIMIT ${limit}
      `, params);

      return NextResponse.json({ results: res.rows });
    } catch (err) {
      console.error('job-session list error:', err);
      return NextResponse.json({ error: 'Failed to load job orders.' }, { status: 500 });
    }
  }

  // ── B) Full session for a specific job order ───────────────────────────────
  const joId = parseInt(jobOrderId, 10);
  if (isNaN(joId)) {
    return NextResponse.json({ error: 'Invalid job_order_id.' }, { status: 400 });
  }

  try {
    // Vehicle + JO metadata
    const joRes = await db.query(`
      SELECT
        jo.id,
        jo.jo_date::text  AS jo_date,
        jo.status::text   AS status,
        COALESCE(v.plate_number, '—')          AS plate,
        COALESCE(v.vehicle_make, 'Unknown')    AS make,
        COALESCE(v.vehicle_model, 'Unknown')   AS model,
        v.vehicle_year                          AS year,
        v.mileage,
        v.vehicle_type
      FROM job_orders jo
      JOIN vehicles v ON v.id = jo.vehicle_id
      WHERE jo.id = $1
    `, [joId]);

    if (joRes.rows.length === 0) {
      return NextResponse.json({ error: 'Job order not found.' }, { status: 404 });
    }

    const jo = joRes.rows[0];

    // Services
    const svcRes = await db.query(`SELECT * FROM get_job_order_services($1)`, [joId]);
    const services: JobOrderService[] = svcRes.rows.map((r) => ({
      service_name:      r.service_name,
      estimated_amount:  r.estimated_amount != null ? Number(r.estimated_amount) : null,
      actual_amount:     r.actual_amount    != null ? Number(r.actual_amount)    : null,
    }));

    // Parts
    const partsRes = await db.query(`SELECT * FROM get_job_order_parts($1)`, [joId]);
    const parts: JobOrderPart[] = partsRes.rows.map((r) => ({
      part_number:  r.part_number  ?? '—',
      description:  r.description  ?? '',
      quantity:     Number(r.quantity ?? 1),
      unit_price:   r.retail_unit_price   != null ? Number(r.retail_unit_price)   : null,
      total:        r.total_retail_amount != null ? Number(r.total_retail_amount) : null,
    }));

    // Inspection notes
    const inspRes = await db.query(`
      SELECT name, notes, findings_description AS findings, status
      FROM vehicle_inspections
      WHERE job_order_id = $1
      ORDER BY logged_date ASC
      LIMIT 20
    `, [joId]);
    const inspectionNotes: InspectionNote[] = inspRes.rows.map((r) => ({
      name:     r.name,
      notes:    r.notes,
      findings: r.findings,
      status:   r.status,
    }));

    const sessionBase: Omit<JobOrderSession, 'contextString'> = {
      id:     jo.id,
      status: jo.status,
      jo_date: jo.jo_date,
      vehicle: {
        plate: jo.plate,
        make:  jo.make,
        model: jo.model,
        year:  jo.year,
        mileage: jo.mileage != null ? Number(jo.mileage) : null,
        vehicle_type: jo.vehicle_type,
      },
      services,
      parts,
      inspectionNotes,
    };

    const session: JobOrderSession = {
      ...sessionBase,
      contextString: buildContextString(sessionBase),
    };

    return NextResponse.json(session);
  } catch (err) {
    console.error('job-session detail error:', err);
    return NextResponse.json({ error: 'Failed to load job order session.' }, { status: 500 });
  }
}
