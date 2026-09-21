import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// "Record purchase" on Service Progress. This is the shop's purchase ledger,
// not a procurement workflow — nothing is sent to the supplier. One save =
// one purchase_orders row (already fulfilled, since the parts are in hand)
// plus every ticked part pointed at it and marked received.

type PurchasedPart = { partId: number; unitCost: number }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: jobOrderId } = await params
  const body = await request.json()
  const supplierId = Number(body.supplierId)
  const purchasedOn = String(body.purchasedOn ?? '').trim()
  const parts: PurchasedPart[] = Array.isArray(body.parts) ? body.parts : []

  if (!supplierId || !purchasedOn || parts.length === 0) {
    return NextResponse.json(
      { success: false, message: 'supplierId, purchasedOn and at least one part are required' },
      { status: 400 },
    )
  }
  // unitCost must be a real number (0 is fine — warranty replacements are free);
  // a blank box coerced with Number('') would sneak in as 0, so no coercion here.
  if (parts.some((p) => !p.partId || typeof p.unitCost !== 'number' || !Number.isFinite(p.unitCost) || p.unitCost < 0)) {
    return NextResponse.json({ success: false, message: 'Every part needs a partId and a unit cost' }, { status: 400 })
  }

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Only this job order's own to_order parts can be recorded — guards
    // against a stale modal referencing a part that was already bought.
    const partIds = parts.map((p) => Number(p.partId))
    const owned = await client.query(
      `SELECT id, quantity FROM job_order_parts
       WHERE job_order_id = $1 AND id = ANY($2::int[]) AND status = 'to_order'`,
      [jobOrderId, partIds],
    )
    if (owned.rows.length !== partIds.length) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, message: 'Some of those parts are not waiting to be bought anymore. Reload and try again.' },
        { status: 409 },
      )
    }

    const qtyById = new Map<number, number>(owned.rows.map((r) => [r.id, r.quantity ?? 1]))
    const totalCost = parts.reduce((sum, p) => sum + Number(p.unitCost) * (qtyById.get(Number(p.partId)) ?? 1), 0)

    // Recording the purchase means the parts are on order — they're marked
    // received one by one on the task cards as they arrive, which is also
    // what closes the PO (see parts/route.ts).
    const po = await client.query(
      `INSERT INTO purchase_orders (supplier_id, order_date, total_supplier_cost, status)
       VALUES ($1, $2, $3, 'sent')
       RETURNING id`,
      [supplierId, purchasedOn, totalCost],
    )
    const purchaseOrderId = po.rows[0].id

    for (const p of parts) {
      await client.query(
        `UPDATE job_order_parts
         SET purchase_order_id = $1, supplier_unit_cost = $2, status = 'ordered'
         WHERE id = $3`,
        [purchaseOrderId, Number(p.unitCost), Number(p.partId)],
      )
    }

    await client.query('COMMIT')
    return NextResponse.json({ success: true, purchaseOrderId })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Record purchase error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  } finally {
    client.release()
  }
}
