import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Recent tasks this mechanic worked on — straight from service_progress_tasks,
// which is where assignments actually live. Finished ones first.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const result = await db.query(
      `SELECT * FROM get_mechanic_task_history($1, 25)`,
      [id],
    )
    return NextResponse.json({ success: true, history: result.rows })
  } catch (error) {
    console.error('Mechanic history error:', error)
    return NextResponse.json({ success: false, message: 'Failed to load history' }, { status: 500 })
  }
}
