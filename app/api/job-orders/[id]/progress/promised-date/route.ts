import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/authGuard'
import { db } from '@/lib/db'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireStaff()
  if (!auth.ok) return auth.response

  const { id } = await params
  const jobOrderId = parseInt(id, 10)
  if (Number.isNaN(jobOrderId) || jobOrderId <= 0) {
    return NextResponse.json(
      { success: false, message: 'Invalid job order ID.' },
      { status: 400 },
    )
  }

  const body = await request.json().catch(() => null)
  const promisedDate = body?.promisedDate

  // Validate format and valid date
  if (
    typeof promisedDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/.test(promisedDate) ||
    Number.isNaN(Date.parse(promisedDate.replace('T', ' ')))
  ) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid date and time.' },
      { status: 400 },
    )
  }

  try {
    const updateRes = await db.query(
      `UPDATE job_orders
       SET date_promised = $1::timestamp
       WHERE id = $2 AND date_promised IS NULL
       RETURNING date_promised::text`,
      [promisedDate, jobOrderId],
    )

    let changed = false
    let storedDate: string | null = null

    if (updateRes.rows.length > 0) {
      changed = true
      storedDate = updateRes.rows[0].date_promised
    } else {
      changed = false
      const existingRes = await db.query(
        `SELECT date_promised::text FROM job_orders WHERE id = $1`,
        [jobOrderId],
      )
      if (existingRes.rows.length === 0) {
        return NextResponse.json(
          { success: false, message: 'Job order not found.' },
          { status: 404 },
        )
      }
      storedDate = existingRes.rows[0]?.date_promised ?? null
    }

    return NextResponse.json({
      success: true,
      changed,
      promisedDate: storedDate,
    })
  } catch (error) {
    console.error('Update promised date error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error.' },
      { status: 500 },
    )
  }
}
