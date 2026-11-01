import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Recent tasks this mechanic worked on and leave history from audit logs
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  const { id } = await params
  try {
    const [result, leaveLogs, empRes] = await Promise.all([
      db.query(`SELECT * FROM get_mechanic_task_history($1, 25)`, [id]),
      db.query(`
        SELECT action_date, old_values, new_values
        FROM system_audit_logs
        WHERE entity_type = 'employees' AND entity_id = $1::int
        ORDER BY action_date ASC
      `, [id]),
      db.query(`SELECT status, hire_date FROM employees WHERE id = $1::int`, [id]),
    ])

    const leaveHistory: Array<{ start: string; end: string | null }> = []
    for (const r of leaveLogs.rows) {
      let oldVal: any = {}, newVal: any = {}
      try { oldVal = typeof r.old_values === 'string' ? JSON.parse(r.old_values) : (r.old_values || {}) } catch(e){}
      try { newVal = typeof r.new_values === 'string' ? JSON.parse(r.new_values) : (r.new_values || {}) } catch(e){}
      if (newVal.status === 'on_leave') {
        const last = leaveHistory[leaveHistory.length - 1]
        if (!last || last.end !== null) {
          leaveHistory.push({ start: r.action_date, end: null })
        }
      } else if (newVal.status === 'active' || (oldVal.status === 'on_leave' && newVal.status && newVal.status !== 'on_leave')) {
        const last = leaveHistory[leaveHistory.length - 1]
        if (last && last.end === null) {
          last.end = r.action_date
        }
      }
    }
    const currentStatus = empRes.rows[0]?.status
    if (currentStatus === 'on_leave') {
      const last = leaveHistory[leaveHistory.length - 1]
      if (!last || last.end !== null) {
        leaveHistory.push({ start: empRes.rows[0]?.hire_date || new Date().toISOString(), end: null })
      }
    }

    return NextResponse.json({ success: true, history: result.rows, leaveHistory })
  } catch (error) {
    console.error('Mechanic history error:', error)
    return NextResponse.json({ success: false, message: 'Failed to load history' }, { status: 500 })
  }
}
