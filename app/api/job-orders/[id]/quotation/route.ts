import { requireStaff } from '@/lib/authGuard'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { PoolClient } from 'pg'
import { syncBookedServicesToJobOrder } from '@/lib/syncBookedServices'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'
import {
  findEarliestSlotForMechanic,
  normalizeShopHours,
  parseNaiveTimestamp,
  formatNaiveIso,
  type Interval,
} from '@/lib/autoSchedule'
import { TASK_GAP_MINUTES } from '@/data/shopPolicy'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const { id } = await params

    const headerResult = await db.query(
      `
      SELECT jo.id, jo.quotation_notes, jo.actual_grand_total, jo.quotation_approved,
             jo.date_promised, jo.assigned_mechanic_id, e.full_name AS assigned_mechanic_name,
             EXISTS (
               SELECT 1 FROM pre_diagnostics pd
               JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
               WHERE vi.job_order_id = jo.id
             ) AS sent_to_customer
      FROM job_orders jo
      LEFT JOIN employees e ON e.id = jo.assigned_mechanic_id
      WHERE jo.id = $1
      `,
      [id]
    )

    if (headerResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Job order not found' }, { status: 404 })
    }

    let servicesResult = await db.query(
      `SELECT * FROM get_job_order_services($1::int)`,
      [id]
    )

    // If quotation has no non-diagnostic services and is not approved yet,
    // auto-populate from the customer's booking ticket so all requested services appear
    const hasOnlyScanOrNone =
      servicesResult.rows.length === 0 ||
      (servicesResult.rows.length === 1 && servicesResult.rows[0].service_name === DIAGNOSTIC_SCAN_SERVICE_NAME)

    if (hasOnlyScanOrNone && !headerResult.rows[0]?.quotation_approved) {
      const syncRes = await syncBookedServicesToJobOrder(Number(id), undefined, db)
      if (syncRes.added > 0) {
        servicesResult = await db.query(
          `SELECT * FROM get_job_order_services($1::int)`,
          [id]
        )
        const refreshedHeader = await db.query(
          `SELECT jo.id, jo.quotation_notes, jo.actual_grand_total, jo.quotation_approved,
                 jo.date_promised, jo.assigned_mechanic_id, e.full_name AS assigned_mechanic_name,
                 EXISTS (
                   SELECT 1 FROM pre_diagnostics pd
                   JOIN vehicle_inspections vi ON vi.id = pd.inspection_id
                   WHERE vi.job_order_id = jo.id
                 ) AS sent_to_customer
          FROM job_orders jo
          LEFT JOIN employees e ON e.id = jo.assigned_mechanic_id
          WHERE jo.id = $1`,
          [id]
        )
        if (refreshedHeader.rows.length > 0) {
          headerResult.rows[0] = refreshedHeader.rows[0]
        }
      }
    }

    const partsResult = await db.query(
      `SELECT * FROM get_job_order_parts($1)`,
      [id]
    )

    const extraPartsRes = await db.query(
      'SELECT id, warranty_months, estimated_delivery_date::text AS estimated_delivery_date FROM job_order_parts WHERE job_order_id = $1::int',
      [id]
    )
    const extraMap = new Map(extraPartsRes.rows.map((r: any) => [r.id, r]))
    const partsWithDetails = partsResult.rows.map((p: any) => {
      const extra = extraMap.get(p.id)
      return {
        ...p,
        warranty_months: extra?.warranty_months ?? null,
        estimated_delivery_date: extra?.estimated_delivery_date ? extra.estimated_delivery_date.slice(0, 10) : null,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        ...headerResult.rows[0],
        services: servicesResult.rows,
        parts: partsWithDetails,
      },
    })
  } catch (error) {
    console.error('Quotation fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  // Declared out here so the catch below can roll the transaction back.
  let client: PoolClient | null = null
  try {
    const { id } = await params
    const body = await request.json()
    const { notes, services, estimated_grand_total, actual_grand_total } = body

    client = await db.connect()
    await client.query('BEGIN')

    // 1. Update quotation notes and totals
    await client!.query(
      `UPDATE job_orders SET quotation_notes = $1, estimated_grand_total = $2, actual_grand_total = $3 WHERE id = $4::int`, 
      [notes || '', estimated_grand_total || 0, actual_grand_total || 0, id]
    )

    // 2. Fetch existing services and parts for this job order so we can update in-place
    //    and preserve primary keys rather than churning IDs on every save.
    const existingServicesRes = await client!.query(
      `SELECT jos.id, jos.service_id, s.service_name
         FROM job_order_services jos
         LEFT JOIN services s ON s.id = jos.service_id
        WHERE jos.job_order_id = $1::int`,
      [id],
    )
    const existingServicesMap = new Map<number, any>(existingServicesRes.rows.map((r) => [r.id, r]))

    const existingPartsRes = await client!.query(
      `SELECT id, job_order_service_id, part_number, description, status FROM job_order_parts WHERE job_order_id = $1::int`,
      [id],
    )
    const existingPartsMap = new Map<number, any>(existingPartsRes.rows.map((r) => [r.id, r]))
    const arrived = new Set(
      existingPartsRes.rows
        .filter((r) => r.status === 'received' || r.status === 'installed')
        .map((r) => `${r.part_number ?? ''}|${r.description ?? ''}`),
    )

    const retainedServiceIds = new Set<number>()
    const retainedPartIds = new Set<number>()

    // 3. Upsert services and parts
    if (Array.isArray(services)) {
      for (const s of services) {
        let serviceId = s.dbServiceId

        // A custom service needs a catalog row. Reuse one with the same name
        // if it already exists — otherwise every save adds another copy.
        if (!serviceId) {
          const existing = await client!.query(
            `SELECT id FROM services WHERE LOWER(service_name) = LOWER($1) ORDER BY id LIMIT 1`,
            [s.name],
          )
          if (existing.rows.length > 0) {
            serviceId = existing.rows[0].id
          } else {
            const newSrvRes = await client!.query(
              `INSERT INTO services (service_name, base_price, base_duration_hours, is_price_fixed, is_active)
               VALUES ($1, $2, $3, false, true) RETURNING id`,
              [s.name, s.laborCost, s.laborHours],
            )
            serviceId = newSrvRes.rows[0].id
          }
        }

        const parsedId =
          typeof s.id === 'string' && s.id.startsWith('SVC-') && !s.id.startsWith('SVC-new-')
            ? parseInt(s.id.replace('SVC-', ''), 10)
            : typeof s.id === 'number'
            ? s.id
            : null

        // The OBD-II scan fee is added only when the customer agrees to it (at booking or mid-inspection).
        // A save may update the line that is already there, but never adds one: an old tab or a quick
        // auto-save could otherwise bring back a fee that staff just removed.
        const isScanFee = String(s.name ?? '').trim().toLowerCase() === DIAGNOSTIC_SCAN_SERVICE_NAME.toLowerCase()
        if (isScanFee && !(parsedId && existingServicesMap.has(parsedId))) continue

        let jobOrderServiceId: number
        if (parsedId && existingServicesMap.has(parsedId)) {
          await client!.query(
            `UPDATE job_order_services 
             SET service_id = $1::int, description_of_work = $2, estimated_hours = $3::numeric,
                 actual_hours = $4::numeric, actual_amount = $5::numeric, estimated_amount = $6::numeric
             WHERE id = $7::int`,
            [serviceId, s.description || '', s.laborHours || 1, s.laborHours || 1, s.laborCost || 0, s.estimated_amount || 0, parsedId],
          )
          jobOrderServiceId = parsedId
        } else {
          const josRes = await client!.query(
            `INSERT INTO job_order_services 
             (job_order_id, service_id, description_of_work, estimated_hours, actual_hours, actual_amount, estimated_amount)
             VALUES ($1::int, $2::int, $3, $4::numeric, $5::numeric, $6::numeric, $7::numeric) RETURNING id`,
            [id, serviceId, s.description || '', s.laborHours || 1, s.laborHours || 1, s.laborCost || 0, s.estimated_amount || 0],
          )
          jobOrderServiceId = josRes.rows[0].id
        }
        retainedServiceIds.add(jobOrderServiceId)

        // Upsert parts for this service
        if (Array.isArray(s.parts)) {
          for (const p of s.parts) {
            const dbStatus = arrived.has(`${p.partNo || ''}|${p.name || ''}`)
              ? 'received'
              : p.status === 'in-stock'
              ? 'in_stock'
              : 'to_order'
            const totalRetail = (p.qty || 1) * (p.unitPrice || 0)

            const warranty = p.warranty_months
            if (warranty !== null && warranty !== undefined) {
              const wNum = Number(warranty)
              if (!Number.isInteger(wNum) || wNum < 0 || wNum > 60) {
                await client!.query('ROLLBACK')
                client!.release()
                return NextResponse.json({ success: false, message: `Check the warranty of ${p.name || 'a part'}: choose No warranty or 1 to 60 months.` }, { status: 400 })
              }
            }
            const validWarranty = (warranty === null || warranty === undefined) ? null : Number(warranty)

            const parsedPartId =
              typeof p.id === 'string' && p.id.startsWith('PRT-') && !p.id.startsWith('PRT-new-')
                ? parseInt(p.id.replace('PRT-', ''), 10)
                : typeof p.id === 'number'
                ? p.id
                : null

            const estimatedDelivery = (dbStatus === 'to_order' && p.estimated_delivery_date) ? String(p.estimated_delivery_date).slice(0, 10) : null

            let partId: number
            if (parsedPartId && existingPartsMap.has(parsedPartId)) {
              await client!.query(
                `UPDATE job_order_parts
                 SET job_order_service_id = $1::int, status = $2, part_number = $3,
                     description = $4, quantity = $5::int, retail_unit_price = $6::numeric, total_retail_amount = $7::numeric, 
                     warranty_months = CASE WHEN $10::boolean THEN $8::int ELSE warranty_months END,
                     estimated_delivery_date = $11::date
                 WHERE id = $9::int`,
                [jobOrderServiceId, dbStatus, p.partNo || '', p.name || '', p.qty || 1, p.unitPrice || 0, totalRetail, validWarranty, parsedPartId, warranty !== undefined, estimatedDelivery],
              )
              partId = parsedPartId
            } else {
              const prtRes = await client!.query(
                `INSERT INTO job_order_parts
                 (job_order_id, job_order_service_id, status, part_number, description, quantity, retail_unit_price, total_retail_amount, warranty_months, estimated_delivery_date)
                 VALUES ($1::int, $2::int, $3, $4, $5, $6::int, $7::numeric, $8::numeric, $9::int, $10::date) RETURNING id`,
                [id, jobOrderServiceId, dbStatus, p.partNo || '', p.name || '', p.qty || 1, p.unitPrice || 0, totalRetail, validWarranty, estimatedDelivery],
              )
              partId = prtRes.rows[0].id
            }
            retainedPartIds.add(partId)
          }
        }
      }
    }

    // Delete parts and services that were removed by the admin
    const partsToDelete = [...existingPartsMap.keys()].filter((partId) => !retainedPartIds.has(partId))
    if (partsToDelete.length > 0) {
      await client!.query(`DELETE FROM job_order_parts WHERE id = ANY($1::int[])`, [partsToDelete])
    }

    // The OBD-II scan fee is never deleted by a normal save. Staff remove it with
    // DELETE /api/job-orders/[id]/scan-authorization, which checks the rules and tells the customer.
    const servicesToDelete = [...existingServicesMap.keys()].filter(
      (srvId) =>
        !retainedServiceIds.has(srvId) &&
        existingServicesMap.get(srvId)?.service_name !== DIAGNOSTIC_SCAN_SERVICE_NAME,
    )
    if (servicesToDelete.length > 0) {
      await client!.query(`DELETE FROM job_order_parts WHERE job_order_service_id = ANY($1::int[])`, [servicesToDelete])
      await client!.query(`DELETE FROM job_order_services WHERE id = ANY($1::int[])`, [servicesToDelete])
    }

    // 4. If the quotation was already approved, dynamically sync changes to the "In Progress" tasks.
    const joStatusRes = await client!.query(`SELECT quotation_approved FROM job_orders WHERE id = $1::int`, [id])
    if (joStatusRes.rows[0]?.quotation_approved) {
      await client!.query(`SELECT set_quotation_approval($1::int, true)`, [id])
    }

    // 5. Recalculate estimated completion time (date_promised) considering labor and parts arrival
    let calculatedDatePromisedIso: string | null = null
    const joInfoRes = await client!.query(
      `SELECT jo.assigned_mechanic_id, jo.date_arrived::text AS date_arrived,
              st.preferred_datetime::text AS preferred_datetime
       FROM job_orders jo
       LEFT JOIN service_tickets st ON st.id = jo.ticket_id
       WHERE jo.id = $1::int`,
      [id]
    )

    const joInfo = joInfoRes.rows[0]
    const assignedMechId = joInfo?.assigned_mechanic_id ? Number(joInfo.assigned_mechanic_id) : null

    // Baseline start time (naive ms)
    let baselineStartMs = Date.now()
    if (joInfo?.date_arrived) {
      const p = parseNaiveTimestamp(joInfo.date_arrived)
      if (!isNaN(p)) baselineStartMs = p
    } else if (joInfo?.preferred_datetime) {
      const p = parseNaiveTimestamp(joInfo.preferred_datetime)
      if (!isNaN(p)) baselineStartMs = Math.max(p, Date.now())
    }

    const shopHours = normalizeShopHours(null)

    // Load mechanic busy intervals (from other job orders)
    const mechBusy: Interval[] = []
    if (assignedMechId) {
      const busyRes = await client!.query(
        `SELECT 
           COALESCE(spt.scheduled_date, spt.started_at)::text AS scheduled_date,
           COALESCE(
             spt.estimated_finish,
             spt.scheduled_date + (COALESCE(jos.estimated_hours, 1.5) * INTERVAL '1 hour')
           )::text AS estimated_finish
         FROM service_progress_tasks spt
         JOIN job_orders jo ON jo.id = spt.job_order_id
         LEFT JOIN LATERAL (
           SELECT jos.estimated_hours
           FROM services s
           JOIN job_order_services jos ON jos.service_id = s.id AND jos.job_order_id = spt.job_order_id
           WHERE s.service_name = spt.task_title
           LIMIT 1
         ) jos ON true
         WHERE spt.task_status <> 'cancelled'
           AND jo.status NOT IN ('completed', 'released', 'cancelled')
           AND jo.id <> $1::int
           AND COALESCE(spt.mechanic_id, jo.assigned_mechanic_id) = $2
           AND (spt.scheduled_date IS NOT NULL OR spt.started_at IS NOT NULL)
           AND COALESCE(spt.scheduled_date, spt.started_at) >= (NOW() - INTERVAL '2 days')
         ORDER BY scheduled_date ASC`,
        [id, assignedMechId]
      )
      for (const row of busyRes.rows) {
        const s = parseNaiveTimestamp(row.scheduled_date)
        const finishDateStr = row.estimated_finish || row.scheduled_date
        const e = parseNaiveTimestamp(finishDateStr)
        if (!isNaN(s) && !isNaN(e) && e > s) {
          mechBusy.push({ start: s, end: e })
        }
      }
    }

    if (Array.isArray(services) && services.length > 0) {
      let cursorMs = baselineStartMs
      let finalTaskEndMs = cursorMs

      // Partition services:
      // 1. readyServices: all required parts are in-stock (or no parts needed). These run first!
      // 2. delayedServices: requires parts that must be ordered. These run when parts arrive (last).
      const readyServices: typeof services = []
      const delayedServices: Array<{ service: (typeof services)[0]; latestPartArrivalMs: number }> = []

      for (const s of services) {
        let maxPartArrival = 0
        if (Array.isArray(s.parts)) {
          for (const p of s.parts) {
            const pStatus = p.status === 'to-order' || p.status === 'to_order'
            if (pStatus && p.estimated_delivery_date) {
              const rawDelivery = p.estimated_delivery_date instanceof Date
                ? p.estimated_delivery_date.toISOString()
                : String(p.estimated_delivery_date)
              const arrivalDateStr = rawDelivery.slice(0, 10)
              // Parts delivery arrives at 8:00 AM shop opening on that date
              const parsedArrival = parseNaiveTimestamp(`${arrivalDateStr} 08:00:00`)
              if (!isNaN(parsedArrival) && parsedArrival > maxPartArrival) {
                maxPartArrival = parsedArrival
              }
            }
          }
        }

        if (maxPartArrival > 0) {
          delayedServices.push({ service: s, latestPartArrivalMs: maxPartArrival })
        } else {
          readyServices.push(s)
        }
      }

      // Sort delayed services by their parts arrival date ascending
      delayedServices.sort((a, b) => a.latestPartArrivalMs - b.latestPartArrivalMs)

      // Step 1: Schedule all ready/in-stock services FIRST starting from baselineStartMs
      for (const s of readyServices) {
        const hours = Number(s.laborHours) || 1
        const slot = findEarliestSlotForMechanic(cursorMs, hours, mechBusy, [], shopHours)
        if (slot) {
          mechBusy.push({ start: slot.start, end: slot.end })
          cursorMs = slot.end + TASK_GAP_MINUTES * 60 * 1000
          finalTaskEndMs = slot.end
        }
      }

      // Step 2: Schedule delayed services LAST (when their parts arrive and after ready services)
      for (const item of delayedServices) {
        const s = item.service
        const hours = Number(s.laborHours) || 1
        // Service starts after parts arrive AND after preceding work is completed
        const serviceEarliestStart = Math.max(cursorMs, item.latestPartArrivalMs)

        const slot = findEarliestSlotForMechanic(serviceEarliestStart, hours, mechBusy, [], shopHours)
        if (slot) {
          mechBusy.push({ start: slot.start, end: slot.end })
          cursorMs = slot.end + TASK_GAP_MINUTES * 60 * 1000
          finalTaskEndMs = slot.end
        }
      }

      if (finalTaskEndMs > 0) {
        calculatedDatePromisedIso = formatNaiveIso(finalTaskEndMs)
        await client!.query(
          `UPDATE job_orders SET date_promised = $1 WHERE id = $2::int`,
          [calculatedDatePromisedIso, id]
        )
      }
    }

    await client!.query('COMMIT')
    client.release()
    return NextResponse.json({
      success: true,
      message: 'Quotation saved and synced successfully',
      date_promised: calculatedDatePromisedIso,
    })
  } catch (error) {
    console.error('Quotation save error:', error)
    try {
      await client?.query('ROLLBACK')
      client?.release()
    } catch {
      /* the connection is already gone */
    }
    return NextResponse.json(
      { success: false, message: 'Internal server error', ...(process.env.NODE_ENV !== 'production' ? { debug: error instanceof Error ? error.message : String(error) } : {}) },
      { status: 500 }
    )
  }
}