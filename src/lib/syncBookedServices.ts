import { db } from '@/lib/db'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'

export interface ServiceItem {
  id: number
  service_name: string
  base_price: number | string
  base_duration_hours: number | string
}

const SERVICE_ALIASES: Record<string, string> = {
  'oil change': 'Change Oil',
  'brake service': 'Brake Service & Cleaning',
  'brake service & cleaning': 'Brake Service & Cleaning',
  'aircon repair': 'Air Conditioning Cleaning & Freon Charge',
  'air conditioning repair': 'Air Conditioning Cleaning & Freon Charge',
  'engine diagnostics': 'General Mechanical Inspection & Check-Up',
  'tire replacement': 'Tire Rotation & Balancing',
  'general maintenance': 'General Mechanical Inspection & Check-Up',
}

/**
 * Parses customer_concern text to extract human-readable service names.
 */
export function extractServiceNamesFromConcern(concern: string | null | undefined): string[] {
  if (!concern || typeof concern !== 'string') return []
  const names = new Set<string>()

  const lines = concern.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    // Match "Maintenance: Change Oil; Coolant Flush" or "Repair: Top Overhaul" or "Diagnostics: ..."
    const prefixMatch = trimmed.match(/(?:Notes:\s*)?(Maintenance|Repair|Diagnostics):\s*([^.\n\r]+)/i)
    if (prefixMatch && prefixMatch[2]) {
      const items = prefixMatch[2].split(';')
      for (const it of items) {
        const clean = it.trim().replace(/^and\s+/i, '')
        if (clean && clean.length > 2 && !/^(none|n\/a|please check|other request)/i.test(clean)) {
          names.add(clean)
        }
      }
    }
  }

  // If no prefix lines matched, try "Service: Brake Service"
  if (names.size === 0) {
    const svcMatch = concern.match(/Service:\s*([^|.\n]+)/i)
    if (svcMatch && svcMatch[1]) {
      const clean = svcMatch[1].trim()
      if (clean && clean.length > 2 && !/^(none|n\/a)/i.test(clean)) names.add(clean)
    }
  }

  // If still none, try "Category: Oil Change"
  if (names.size === 0) {
    const catMatch = concern.match(/Category:\s*([^|.\n]+)/i)
    if (catMatch && catMatch[1]) {
      const cat = catMatch[1].trim()
      if (cat && !/^\d+\s*services/i.test(cat) && !/not sure/i.test(cat) && !/other request/i.test(cat)) {
        names.add(cat)
      }
    }
  }

  // If still none and it's short, could be a raw service name like "Brake Service"
  if (names.size === 0) {
    const trimmed = concern.trim()
    if (trimmed.length > 2 && trimmed.length < 50 && !trimmed.includes(':') && !trimmed.includes('\n')) {
      names.add(trimmed)
    }
  }

  return Array.from(names)
}

/**
 * Resolves a list of service names into actual records from the services table.
 */
export async function resolveServicesFromNames(names: string[], clientOrDb: any = db): Promise<ServiceItem[]> {
  if (!names || names.length === 0) return []

  const allServicesRes = await clientOrDb.query(
    'SELECT id, service_name, base_price, base_duration_hours FROM services WHERE is_active = true'
  )
  const svcByName = new Map<string, ServiceItem>()
  allServicesRes.rows.forEach((s: any) => {
    svcByName.set(s.service_name.toLowerCase().trim(), {
      id: Number(s.id),
      service_name: String(s.service_name),
      base_price: Number(s.base_price ?? 0),
      base_duration_hours: Number(s.base_duration_hours ?? 1),
    })
  })

  // Also load package definitions in case a package name (e.g. "Basic PMS") was listed
  const pkgRes = await clientOrDb.query(
    `SELECT p.package_name, s.id, s.service_name, s.base_price, s.base_duration_hours
     FROM service_packages p
     JOIN service_package_items pi ON pi.package_id = p.id
     JOIN services s ON s.id = pi.service_id
     WHERE p.is_active = true
     ORDER BY p.id, pi.sort_order`
  )
  const pkgMap = new Map<string, ServiceItem[]>()
  pkgRes.rows.forEach((r: any) => {
    const pName = String(r.package_name).toLowerCase().trim()
    if (!pkgMap.has(pName)) pkgMap.set(pName, [])
    pkgMap.get(pName)!.push({
      id: Number(r.id),
      service_name: String(r.service_name),
      base_price: Number(r.base_price ?? 0),
      base_duration_hours: Number(r.base_duration_hours ?? 1),
    })
  })

  const resolved = new Map<number, ServiceItem>()

  for (const rawName of names) {
    const lower = rawName.toLowerCase().trim()

    // 1. Check if it matches a PMS package
    let matchedPkg = false
    for (const [pName, pServices] of pkgMap.entries()) {
      if (lower.startsWith(pName) || lower.includes(pName)) {
        for (const ps of pServices) {
          if (!resolved.has(ps.id)) resolved.set(ps.id, ps)
        }
        matchedPkg = true
      }
    }
    if (matchedPkg) continue

    // 2. Direct match
    if (svcByName.has(lower)) {
      const s = svcByName.get(lower)!
      resolved.set(s.id, s)
      continue
    }

    // 3. Alias match
    const alias = SERVICE_ALIASES[lower]
    if (alias && svcByName.has(alias.toLowerCase())) {
      const s = svcByName.get(alias.toLowerCase())!
      resolved.set(s.id, s)
      continue
    }

    // 4. Fuzzy/partial match
    for (const [sName, s] of svcByName.entries()) {
      if (sName.includes(lower) || lower.includes(sName)) {
        resolved.set(s.id, s)
        break
      }
    }
  }

  return Array.from(resolved.values())
}

/**
 * Gets all services associated with a service ticket, either from booked_service_ids or parsed from customer_concern.
 */
export async function getServicesForTicket(ticketId: number, clientOrDb: any = db): Promise<ServiceItem[]> {
  const ticketRes = await clientOrDb.query(
    'SELECT id, customer_concern, booked_service_ids FROM service_tickets WHERE id = $1',
    [ticketId]
  )
  if (ticketRes.rows.length === 0) return []

  const ticket = ticketRes.rows[0]

  // If ticket explicitly has booked_service_ids stored
  if (Array.isArray(ticket.booked_service_ids) && ticket.booked_service_ids.length > 0) {
    const res = await clientOrDb.query(
      'SELECT id, service_name, base_price, base_duration_hours FROM services WHERE id = ANY($1::int[]) AND is_active = true',
      [ticket.booked_service_ids]
    )
    if (res.rows.length > 0) {
      return res.rows.map((r: any) => ({
        id: Number(r.id),
        service_name: String(r.service_name),
        base_price: Number(r.base_price ?? 0),
        base_duration_hours: Number(r.base_duration_hours ?? 1),
      }))
    }
  }

  // Parse from customer_concern
  const names = extractServiceNamesFromConcern(ticket.customer_concern)
  const resolved = await resolveServicesFromNames(names, clientOrDb)

  // Backfill booked_service_ids on the ticket if empty
  if (resolved.length > 0) {
    try {
      await clientOrDb.query(
        'UPDATE service_tickets SET booked_service_ids = $1::int[] WHERE id = $2 AND (booked_service_ids IS NULL OR booked_service_ids = \'{}\')',
        [resolved.map((s) => s.id), ticketId]
      )
    } catch (err) {
      // Non-fatal if backfill fails
      console.warn('Could not backfill booked_service_ids on ticket:', err)
    }
  }

  return resolved
}

/**
 * Syncs the customer's booked services into job_order_services for a job order.
 * Safe to call multiple times: only inserts services if non-diagnostic services don't already exist.
 */
export async function syncBookedServicesToJobOrder(
  jobOrderId: number,
  ticketId?: number,
  clientOrDb: any = db
): Promise<{ added: number; totalLabor: number }> {
  // 1. Fetch job order info
  const joRes = await clientOrDb.query(
    'SELECT id, ticket_id, assigned_mechanic_id, actual_grand_total, quotation_approved FROM job_orders WHERE id = $1',
    [jobOrderId]
  )
  if (joRes.rows.length === 0) return { added: 0, totalLabor: 0 }
  const jo = joRes.rows[0]

  const actualTicketId = ticketId || jo.ticket_id
  if (!actualTicketId) return { added: 0, totalLabor: 0 }

  // 2. Check existing services on this job order
  const existingRes = await clientOrDb.query(
    `SELECT jos.id, jos.service_id, s.service_name
     FROM job_order_services jos
     JOIN services s ON s.id = jos.service_id
     WHERE jos.job_order_id = $1`,
    [jobOrderId]
  )
  const existingRows = existingRes.rows
  const existingServiceIds = new Set<number>(existingRows.map((r: any) => Number(r.service_id)))

  // If there are already non-diagnostic services present, do not overwrite or re-seed
  const hasCustomServices = existingRows.some(
    (r: any) => r.service_name !== DIAGNOSTIC_SCAN_SERVICE_NAME
  )
  if (hasCustomServices) {
    return { added: 0, totalLabor: 0 }
  }

  // 3. Get customer's requested services
  const bookedServices = await getServicesForTicket(actualTicketId, clientOrDb)
  if (bookedServices.length === 0) return { added: 0, totalLabor: 0 }

  // 4. Insert each booked service (avoid duplicating if already present, e.g. OBD-II)
  let added = 0
  let totalLabor = 0
  const mechanicId = jo.assigned_mechanic_id || null

  for (const s of bookedServices) {
    if (existingServiceIds.has(s.id)) continue

    const laborCost = Number(s.base_price) || 0
    const laborHours = Number(s.base_duration_hours) || 1

    await clientOrDb.query(
      `INSERT INTO job_order_services (
         job_order_id,
         service_id,
         assigned_mechanic_id,
         description_of_work,
         estimated_hours,
         actual_hours,
         estimated_amount,
         actual_amount
       ) VALUES ($1, $2, $3, $4, $5, $5, $6, $6)`,
      [
        jobOrderId,
        s.id,
        mechanicId,
        'Requested by customer at booking.',
        laborHours,
        laborCost,
      ]
    )

    existingServiceIds.add(s.id)
    added++
    totalLabor += laborCost
  }

  // 5. If we added services and the job order grand total was 0/null, update grand totals
  if (added > 0) {
    await clientOrDb.query(
      `UPDATE job_orders
       SET estimated_grand_total = (
             SELECT COALESCE(SUM(estimated_amount), 0)
             FROM job_order_services
             WHERE job_order_id = $1
           ) + (
             SELECT COALESCE(SUM(total_retail_amount), 0)
             FROM job_order_parts
             WHERE job_order_id = $1
           ),
           actual_grand_total = (
             SELECT COALESCE(SUM(actual_amount), 0)
             FROM job_order_services
             WHERE job_order_id = $1
           ) + (
             SELECT COALESCE(SUM(total_retail_amount), 0)
             FROM job_order_parts
             WHERE job_order_id = $1
           )
       WHERE id = $1 AND (actual_grand_total IS NULL OR actual_grand_total = 0)`,
      [jobOrderId]
    )
  }

  return { added, totalLabor }
}
