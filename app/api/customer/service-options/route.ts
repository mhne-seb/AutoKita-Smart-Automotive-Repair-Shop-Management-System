import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireCustomer } from '@/lib/authGuard'
import { DIAGNOSTIC_SCAN_SERVICE_NAME } from '@/data/diagnosticScan'
import { ROAD_TEST_TITLE } from '@/data/roadTest'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireCustomer()
  if (!guard.ok) return guard.response

  try {
    const servicesRes = await db.query(
      `SELECT DISTINCT ON (s.service_name) s.id, s.service_name, s.description, s.service_type
       FROM services s
       WHERE s.is_active = true
         AND s.service_name <> $1
         AND s.service_name <> $2
       ORDER BY s.service_name ASC, s.id ASC`,
      [DIAGNOSTIC_SCAN_SERVICE_NAME, ROAD_TEST_TITLE]
    )

    const services = servicesRes.rows.map((row: any) => ({
      id: Number(row.id),
      name: String(row.service_name),
      type: (row.service_type || 'repair') as 'maintenance' | 'repair' | 'diagnostics',
      description: row.description ? String(row.description) : null,
    }))

    const serviceIdByName = new Map<string, number>()
    for (const s of services) {
      serviceIdByName.set(s.name, s.id)
    }

    const packagesRes = await db.query(
      `SELECT p.id, p.package_name, p.description, p.interval_km, p.interval_months, p.sort_order,
              s.service_name, i.sort_order AS item_order
       FROM service_packages p
       JOIN service_package_items i ON i.package_id = p.id
       JOIN services s ON s.id = i.service_id AND s.is_active = true
       WHERE p.is_active = true
       ORDER BY p.sort_order, p.id, i.sort_order`
    )

    const packageMap = new Map<number, {
      id: number
      name: string
      description: string | null
      intervalKm: number | null
      intervalMonths: number | null
      serviceIds: number[]
    }>()

    for (const row of packagesRes.rows) {
      const survivorId = serviceIdByName.get(row.service_name)
      if (survivorId === undefined) continue

      const pkgId = Number(row.id)
      let pkg = packageMap.get(pkgId)
      if (!pkg) {
        pkg = {
          id: pkgId,
          name: String(row.package_name),
          description: row.description ? String(row.description) : null,
          intervalKm: row.interval_km != null ? Number(row.interval_km) : null,
          intervalMonths: row.interval_months != null ? Number(row.interval_months) : null,
          serviceIds: [],
        }
        packageMap.set(pkgId, pkg)
      }
      if (!pkg.serviceIds.includes(survivorId)) {
        pkg.serviceIds.push(survivorId)
      }
    }

    const packages = Array.from(packageMap.values()).filter((p) => p.serviceIds.length > 0)

    return NextResponse.json(
      {
        success: true,
        packages,
        services,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (err) {
    console.error('[/api/customer/service-options GET] error:', err)
    return NextResponse.json(
      { success: false, message: 'Could not load the service list.' },
      { status: 500 }
    )
  }
}
