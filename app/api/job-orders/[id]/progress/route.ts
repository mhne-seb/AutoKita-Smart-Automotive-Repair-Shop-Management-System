import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const result = await db.query(
      `SELECT * FROM "Capstone-Testing".get_service_progress_tasks($1)`,
      [id]
    )

    return NextResponse.json({ success: true, data: result.rows })
  } catch (error) {
    console.error('Service progress fetch error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}