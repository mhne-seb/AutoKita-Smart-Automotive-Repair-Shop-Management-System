import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { DEFAULT_MECHANIC_CAPACITY } from '@/data/mechanicPolicy'

// Mechanics roster for the admin Mechanics page.
//
// A mechanic is two rows: `employees` (who they are, hire date, active /
// on_leave / terminated) and `employee_profiles` (branch, rank, pay, and the
// jobs_capacity the assignment cap checks against). Workload comes from
// service_progress_tasks — the same count the scheduling modal uses, so the
// two screens never disagree about who is full.
//
// Note: get_mechanics_list() in run_all_functions.sql counts "active_jobs"
// from the audit log (job orders the employee *created*), which is a
// different thing. Flagged to Jubert; we query directly here.

const ROSTER_SQL = `
  SELECT e.id, e.full_name, e.email, e.contact_number, e.status, e.hire_date,
         ep.branch, ep.location, ep.rank, ep.base_salary, ep.commission_percent,
         COALESCE(ep.jobs_capacity, $1)::int AS jobs_capacity,
         COUNT(spt.id) FILTER (WHERE spt.task_status <> 'completed')::int AS open_tasks,
         COUNT(spt.id) FILTER (WHERE spt.task_status = 'completed'
                                 AND spt.completed_at >= date_trunc('month', NOW()))::int AS completed_this_month,
         COALESCE(SUM(spt.price) FILTER (WHERE spt.task_status = 'completed'
                                           AND spt.completed_at >= date_trunc('month', NOW())), 0)::float AS billed_this_month
  FROM employees e
  LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
  LEFT JOIN service_progress_tasks spt ON spt.mechanic_id = e.id
  WHERE e.role = 'mechanic' AND e.status <> 'terminated'
  GROUP BY e.id, ep.id
  ORDER BY e.full_name`

// Latest payroll row per mechanic (empty until payroll is generated).
const PAYROLL_SQL = `
  SELECT DISTINCT ON (employee_id)
         employee_id, period_start, period_end, net_pay, status, payment_date
  FROM payroll_summaries
  ORDER BY employee_id, period_end DESC`

export async function GET() {
  try {
    const [roster, payroll] = await Promise.all([
      db.query(ROSTER_SQL, [DEFAULT_MECHANIC_CAPACITY]),
      db.query(PAYROLL_SQL),
    ])
    const payrollByEmployee = new Map(payroll.rows.map((p) => [p.employee_id, p]))
    const mechanics = roster.rows.map((m) => ({ ...m, last_payroll: payrollByEmployee.get(m.id) ?? null }))
    return NextResponse.json({ success: true, mechanics })
  } catch (error) {
    console.error('Mechanics GET error:', error)
    return NextResponse.json({ success: false, message: 'Failed to load mechanics' }, { status: 500 })
  }
}

// employees.contact_number is varchar(11): store as 09XXXXXXXXX.
function normalizePhone(raw: string): string {
  const digits = String(raw ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('63')) return '0' + digits.slice(2)
  return digits
}

type MechanicBody = {
  id?: number
  name: string
  email: string
  phone: string
  branch: string
  location: string
  rank: string
  baseSalary: number
  commissionPercent: number
  jobsCapacity: number
  status?: 'active' | 'on_leave'
}

function validate(b: Partial<MechanicBody>): string | null {
  if (!b.name?.trim()) return 'Name is required'
  if (!b.email?.trim()) return 'Email is required'
  const phone = normalizePhone(b.phone ?? '')
  if (!/^09\d{9}$/.test(phone)) return 'Enter a valid PH mobile number'
  if (!(Number(b.jobsCapacity) > 0)) return 'Job capacity must be at least 1'
  if (Number(b.commissionPercent) < 0 || Number(b.commissionPercent) > 100) return 'Commission must be 0–100'
  return null
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as MechanicBody
  const problem = validate(body)
  if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 })

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    const emp = await client.query(
      `INSERT INTO employees (full_name, email, contact_number, role, hire_date, status)
       VALUES ($1, $2, $3, 'mechanic', CURRENT_DATE, 'active')
       RETURNING id`,
      [body.name.trim(), body.email.trim().toLowerCase(), normalizePhone(body.phone)],
    )
    const id = emp.rows[0].id
    await client.query(
      `INSERT INTO employee_profiles (employee_id, branch, location, rank, base_salary, commission_percent, jobs_capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, body.branch, body.location, body.rank, body.baseSalary, body.commissionPercent, body.jobsCapacity],
    )
    await client.query('COMMIT')
    return NextResponse.json({ success: true, id })
  } catch (error: unknown) {
    await client.query('ROLLBACK')
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ success: false, message: 'That email is already used by another employee.' }, { status: 409 })
    }
    console.error('Mechanics POST error:', error)
    return NextResponse.json({ success: false, message: 'Failed to add mechanic' }, { status: 500 })
  } finally {
    client.release()
  }
}

export async function PATCH(request: NextRequest) {
  const body = (await request.json()) as MechanicBody
  if (!body.id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })
  const problem = validate(body)
  if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 })

  const client = await db.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE employees
       SET full_name = $2, email = $3, contact_number = $4,
           status = COALESCE($5::employee_status, status)
       WHERE id = $1 AND role = 'mechanic'`,
      [body.id, body.name.trim(), body.email.trim().toLowerCase(), normalizePhone(body.phone), body.status ?? null],
    )
    // employee_profiles has no unique key on employee_id, so upsert by hand.
    const updated = await client.query(
      `UPDATE employee_profiles
       SET branch = $2, location = $3, rank = $4, base_salary = $5, commission_percent = $6, jobs_capacity = $7
       WHERE employee_id = $1`,
      [body.id, body.branch, body.location, body.rank, body.baseSalary, body.commissionPercent, body.jobsCapacity],
    )
    if (updated.rowCount === 0) {
      await client.query(
        `INSERT INTO employee_profiles (employee_id, branch, location, rank, base_salary, commission_percent, jobs_capacity)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [body.id, body.branch, body.location, body.rank, body.baseSalary, body.commissionPercent, body.jobsCapacity],
      )
    }
    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    await client.query('ROLLBACK')
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ success: false, message: 'That email is already used by another employee.' }, { status: 409 })
    }
    console.error('Mechanics PATCH error:', error)
    return NextResponse.json({ success: false, message: 'Failed to update mechanic' }, { status: 500 })
  } finally {
    client.release()
  }
}

// "Remove" is a soft delete: past tasks still reference the mechanic, and
// payroll history must survive. terminated mechanics drop off the roster and
// out of the assignment dropdown; nothing is erased.
export async function DELETE(request: NextRequest) {
  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })
  try {
    const open = await db.query(
      `SELECT COUNT(*)::int AS n FROM service_progress_tasks WHERE mechanic_id = $1 AND task_status <> 'completed'`,
      [id],
    )
    if (open.rows[0].n > 0) {
      return NextResponse.json(
        { success: false, message: `This mechanic still has ${open.rows[0].n} open task(s). Reassign or finish them first.` },
        { status: 409 },
      )
    }
    await db.query(
      `UPDATE employees SET status = 'terminated', "EOC" = CURRENT_DATE WHERE id = $1 AND role = 'mechanic'`,
      [id],
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Mechanics DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Failed to remove mechanic' }, { status: 500 })
  }
}
