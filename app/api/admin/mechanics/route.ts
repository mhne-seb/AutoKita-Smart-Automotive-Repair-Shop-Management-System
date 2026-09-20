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

// Latest payroll row per mechanic (empty until payroll is generated).
const PAYROLL_SQL = `
  SELECT DISTINCT ON (employee_id)
         employee_id, period_start, period_end, net_pay, status, payment_date
  FROM payroll_summaries
  ORDER BY employee_id, period_end DESC`

const AUDIT_SQL = `
  SELECT
    sal.id,
    sal.employees_id AS "adminId",
    COALESCE(e.full_name, 'System Administrator') AS "adminName",
    sal.action_performed AS "actionPerformed",
    sal.entity_type AS "entityType",
    sal.entity_id AS "entityId",
    sal.old_values AS "oldValues",
    sal.new_values AS "newValues",
    sal.action_date AS "actionDate"
  FROM system_audit_logs sal
  LEFT JOIN employees e ON e.id = sal.employees_id
  WHERE sal.entity_type IN ('employees', 'employee_profiles')
  ORDER BY sal.action_date DESC
  LIMIT 30`

export async function GET() {
  try {
    const [roster, payroll, auditLogsRes] = await Promise.all([
      db.query(`SELECT * FROM get_mechanics($1)`, [DEFAULT_MECHANIC_CAPACITY]),
      db.query(PAYROLL_SQL),
      db.query(AUDIT_SQL),
    ])
    const payrollByEmployee = new Map(payroll.rows.map((p) => [p.employee_id, p]))
    const mechanics = roster.rows.map((m) => ({ ...m, last_payroll: payrollByEmployee.get(m.id) ?? null }))
    return NextResponse.json({ success: true, mechanics, auditLogs: auditLogsRes.rows })
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
  adminId?: number
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

  const actingAdminId = body.adminId ? parseInt(String(body.adminId), 10) : 1

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    const res = await client.query(
      `SELECT add_mechanic($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id`,
      [
        body.name.trim(),
        body.email.trim().toLowerCase(),
        normalizePhone(body.phone),
        body.branch,
        body.location,
        body.rank,
        body.baseSalary,
        body.commissionPercent,
        body.jobsCapacity,
      ],
    )
    const id = res.rows[0]?.id

    // Record audit log for mechanic hiring/creation
    await client.query(
      `INSERT INTO system_audit_logs (
        employees_id,
        action_performed,
        entity_type,
        entity_id,
        old_values,
        new_values,
        action_date
      ) VALUES ($1, 'created', 'employees', $2, NULL, $3, NOW())`,
      [
        actingAdminId,
        id,
        JSON.stringify({
          full_name: body.name.trim(),
          email: body.email.trim().toLowerCase(),
          contact_number: normalizePhone(body.phone),
          branch: body.branch,
          location: body.location,
          rank: body.rank,
          base_salary: body.baseSalary,
          commission_percent: body.commissionPercent,
          jobs_capacity: body.jobsCapacity,
          status: 'active',
        }),
      ],
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

  const actingAdminId = body.adminId ? parseInt(String(body.adminId), 10) : 1

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // 1. Capture old values before update
    const oldRes = await client.query(
      `SELECT e.full_name, e.email, e.contact_number, e.status,
              ep.branch, ep.location, ep.rank, ep.base_salary, ep.commission_percent, ep.jobs_capacity
       FROM employees e
       LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
       WHERE e.id = $1`,
      [body.id],
    )
    const oldEmp = oldRes.rows[0]

    // 2. Perform updates
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

    // 3. Determine if this was only a status change (e.g. toggling leave) or a profile edit
    const isStatusOnlyChange =
      oldEmp &&
      body.status &&
      body.status !== oldEmp.status &&
      oldEmp.full_name === body.name.trim() &&
      oldEmp.email === body.email.trim().toLowerCase() &&
      oldEmp.rank === body.rank &&
      Number(oldEmp.jobs_capacity) === Number(body.jobsCapacity)

    const action = isStatusOnlyChange ? 'status_changed' : 'updated'

    const oldValues = oldEmp
      ? {
          full_name: oldEmp.full_name,
          email: oldEmp.email,
          contact_number: oldEmp.contact_number,
          status: oldEmp.status,
          branch: oldEmp.branch,
          location: oldEmp.location,
          rank: oldEmp.rank,
          base_salary: Number(oldEmp.base_salary || 0),
          commission_percent: Number(oldEmp.commission_percent || 0),
          jobs_capacity: Number(oldEmp.jobs_capacity || 0),
        }
      : null

    const newValues = {
      full_name: body.name.trim(),
      email: body.email.trim().toLowerCase(),
      contact_number: normalizePhone(body.phone),
      status: body.status ?? oldEmp?.status ?? 'active',
      branch: body.branch,
      location: body.location,
      rank: body.rank,
      base_salary: body.baseSalary,
      commission_percent: body.commissionPercent,
      jobs_capacity: body.jobsCapacity,
    }

    await client.query(
      `INSERT INTO system_audit_logs (
        employees_id,
        action_performed,
        entity_type,
        entity_id,
        old_values,
        new_values,
        action_date
      ) VALUES ($1, $2, 'employees', $3, $4, $5, NOW())`,
      [actingAdminId, action, body.id, JSON.stringify(oldValues), JSON.stringify(newValues)],
    )

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
// payroll history must survive. remove_mechanic() verifies 0 open tasks
// and sets status = 'terminated' and EOC = CURRENT_DATE.
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const id = Number(url.searchParams.get('id'))
  const adminIdParam = url.searchParams.get('adminId')
  const actingAdminId = adminIdParam ? parseInt(adminIdParam, 10) : 1

  if (!id) return NextResponse.json({ success: false, message: 'Missing id' }, { status: 400 })

  const client = await db.connect()
  try {
    await client.query('BEGIN')

    // Fetch previous status and name
    const prevRes = await client.query(`SELECT full_name, status FROM employees WHERE id = $1`, [id])
    const prevEmp = prevRes.rows[0]

    const res = await client.query(`SELECT * FROM remove_mechanic($1)`, [id])
    const outcome = res.rows[0]
    if (!outcome?.success) {
      await client.query('ROLLBACK')
      return NextResponse.json(
        { success: false, message: outcome?.message || 'Cannot remove mechanic.' },
        { status: 409 },
      )
    }

    // Insert termination audit log
    await client.query(
      `INSERT INTO system_audit_logs (
        employees_id,
        action_performed,
        entity_type,
        entity_id,
        old_values,
        new_values,
        action_date
      ) VALUES ($1, 'status_changed', 'employees', $2, $3, $4, NOW())`,
      [
        actingAdminId,
        id,
        JSON.stringify({ full_name: prevEmp?.full_name ?? '', status: prevEmp?.status ?? 'active' }),
        JSON.stringify({ full_name: prevEmp?.full_name ?? '', status: 'terminated' }),
      ],
    )

    await client.query('COMMIT')
    return NextResponse.json({ success: true })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Mechanics DELETE error:', error)
    return NextResponse.json({ success: false, message: 'Failed to remove mechanic' }, { status: 500 })
  } finally {
    client.release()
  }
}
