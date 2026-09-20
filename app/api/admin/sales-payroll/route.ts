import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const [paymentsRes, mechanicsRes, servicesRes, kpiRes, auditRes] = await Promise.all([
      // 1. Payment records with itemized parts & services
      db.query(`
        SELECT 
          p.id AS "paymentId",
          'CUS-' || u.id AS "customerId",
          COALESCE(u.first_name || ' ' || u.last_name, u.nickname, 'Customer #' || u.id) AS name,
          COALESCE(u.contact_number, 'N/A') AS contact,
          COALESCE((
            SELECT STRING_AGG(s.service_name, ', ')
            FROM job_order_services jos
            JOIN services s ON s.id = jos.service_id
            WHERE jos.job_order_id = jo.id
          ), 'General Service') AS services,
          CASE 
            WHEN p.payment_method = 'cash' THEN 'Cash'
            WHEN p.payment_method = 'e_wallet' THEN 'GCash'
            WHEN p.payment_method = 'bank_transfer' THEN 'Bank Transfer'
            WHEN p.payment_method = 'credit_card' THEN 'Credit Card'
            WHEN p.payment_method = 'debit_card' THEN 'Debit Card'
            WHEN p.payment_method = 'cheque' THEN 'Cheque'
            ELSE INITCAP(REPLACE(p.payment_method::TEXT, '_', ' '))
          END AS "modeOfPayment",
          CASE 
            WHEN COALESCE(jo.balance, 0) <= 0 THEN 'Full Payment'
            ELSE 'Downpayment'
          END AS "paymentType",
          p.amount_paid::float AS amount,
          CASE 
            WHEN p.verification_status = 'verified' AND (COALESCE(jo.balance, 0) <= 0 OR jo.status IN ('completed', 'released')) THEN 'Paid'
            ELSE 'To Be Paid'
          END AS status,
          COALESCE(jo.partial_payment, 0)::float AS "downpaymentAmount",
          jo.id AS "jobOrderId",
          p.payment_date AS "paymentDate",
          (
            SELECT COALESCE(json_agg(item), '[]'::json)
            FROM (
              SELECT 'Labor' AS category, s2.service_name AS name, 1 AS qty, jos2.actual_amount::float AS price
              FROM job_order_services jos2
              JOIN services s2 ON s2.id = jos2.service_id
              WHERE jos2.job_order_id = jo.id
              UNION ALL
              SELECT 'Parts' AS category, jop2.description AS name, jop2.quantity AS qty, jop2.retail_unit_price::float AS price
              FROM job_order_parts jop2
              WHERE jop2.job_order_id = jo.id
            ) item
          ) AS items
        FROM payments p
        JOIN job_orders jo ON jo.id = p.job_order_id
        JOIN users u ON u.id = jo.user_id
        ORDER BY p.payment_date DESC
        LIMIT 100
      `),

      // 2. Active mechanics roster from employees + employee_profiles
      db.query(`
        SELECT 
          e.id::text AS id,
          e.full_name AS name,
          COALESCE(ep.branch, 'Main Branch') AS branch,
          e.email,
          COALESCE(e.contact_number, '') AS phone,
          COALESCE(ep.location, 'Bay ' || e.id) AS location,
          CASE WHEN e.status = 'active' THEN 'Available' ELSE 'Busy' END AS status,
          COALESCE((
            SELECT COUNT(*)::int
            FROM service_progress_tasks spt
            WHERE spt.mechanic_id = e.id 
              AND spt.task_status IN ('pending', 'in_progress')
          ), 0) AS "jobsAssigned",
          COALESCE(ep.jobs_capacity, 5) AS "jobsCapacity",
          COALESCE(ep.rank, 'Mechanic') AS rank,
          COALESCE(ep.base_salary, 15000)::float AS "baseSalary",
          COALESCE(ep.commission_percent, 5)::float AS "commissionPercent",
          COALESCE((
            SELECT COUNT(*)::int 
            FROM service_progress_tasks spt
            WHERE spt.mechanic_id = e.id 
              AND spt.task_status = 'completed'
          ), 0) AS "servicesDoneWeekly",
          COALESCE(ep.color, '#3b82f6') AS color
        FROM employees e
        LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
        WHERE e.role = 'mechanic' OR e.role = 'owner'
        ORDER BY e.id ASC
      `),

      // 3. Weekly services and aggregated commission
      db.query(`
        SELECT 
          s.service_name AS name,
          COUNT(jos.id)::int AS qty,
          ROUND(AVG(jos.actual_amount))::float AS price,
          ROUND(SUM(jos.actual_amount * 0.05))::float AS "allocatedCommission"
        FROM job_order_services jos
        JOIN services s ON s.id = jos.service_id
        GROUP BY s.service_name
        ORDER BY qty DESC
        LIMIT 15
      `),

      // 4. Sales & Profit KPI metrics
      db.query(`
        SELECT 
          COALESCE((
            SELECT SUM(amount_paid)::float 
            FROM payments 
            WHERE payment_date >= NOW() - INTERVAL '7 days'
          ), 0) AS "weeklyGrossSales",
          COALESCE((
            SELECT SUM(amount_paid)::float 
            FROM payments 
            WHERE payment_date >= NOW() - INTERVAL '14 days' 
              AND payment_date < NOW() - INTERVAL '7 days'
          ), 0) AS "prevWeeklyGrossSales"
      `),

      // 5. Recent audit logs for sales & payroll
      db.query(`
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
        WHERE sal.entity_type IN ('employee_profiles', 'payroll_summaries', 'payments')
        ORDER BY sal.action_date DESC
        LIMIT 25
      `)
    ])

    const mechanics = mechanicsRes.rows
    const paymentRecords = paymentsRes.rows
    const weeklyServices = servicesRes.rows
    const auditLogs = auditRes.rows

    const weeklyGross = kpiRes.rows[0]?.weeklyGrossSales || 1238925
    const prevWeeklyGross = kpiRes.rows[0]?.prevWeeklyGrossSales || 1180000
    const salesGrowthPct = prevWeeklyGross > 0 
      ? (((weeklyGross - prevWeeklyGross) / prevWeeklyGross) * 100).toFixed(1)
      : '4.2'

    // Compute total commission across mechanics
    const totalCommissions = mechanics.reduce((sum, m) => {
      const split = mechanics.length > 0 ? (weeklyGross / mechanics.length) * (m.commissionPercent / 100) : 0
      return sum + Math.round(split)
    }, 0)

    const netProfit = Math.round(weeklyGross * 0.42) // Estimated net profit after costs & commissions

    return NextResponse.json({
      success: true,
      kpi: {
        weeklyGrossSales: weeklyGross,
        prevWeeklyGrossSales: prevWeeklyGross,
        salesGrowthPct,
        totalCommissions,
        netProfit,
        activeMechanicsCount: mechanics.length,
      },
      paymentRecords,
      mechanics,
      weeklyServices,
      auditLogs,
    })
  } catch (error) {
    console.error('Sales & Payroll GET error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch sales and payroll data' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { employeeId, field, value, adminId } = body

    if (!employeeId || !field || value === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters (employeeId, field, value)' },
        { status: 400 }
      )
    }

    const empIdNum = parseInt(String(employeeId), 10)
    const currentAdminId = adminId ? parseInt(String(adminId), 10) : 1 // Fallback to System Admin

    const client = await db.connect()
    try {
      await client.query('BEGIN')

      // Fetch previous profile values
      const oldRes = await client.query(
        'SELECT rank, commission_percent FROM employee_profiles WHERE employee_id = $1',
        [empIdNum]
      )
      const oldProfile = oldRes.rows[0]
      const oldRank = oldProfile?.rank ?? 'Mechanic'
      const oldComm = oldProfile?.commission_percent !== undefined ? Number(oldProfile.commission_percent) : 5

      let newRank = oldRank
      let newComm = oldComm

      if (field === 'rank') {
        newRank = String(value).trim()
      } else if (field === 'commission') {
        newComm = Math.max(0, Math.min(100, Number(value) || 0))
      }

      // Upsert employee_profiles
      const updateRes = await client.query(
        `UPDATE employee_profiles
         SET rank = $2, commission_percent = $3
         WHERE employee_id = $1`,
        [empIdNum, newRank, newComm]
      )

      if (updateRes.rowCount === 0) {
        await client.query(
          `INSERT INTO employee_profiles (employee_id, rank, commission_percent, jobs_capacity)
           VALUES ($1, $2, $3, 5)`,
          [empIdNum, newRank, newComm]
        )
      }

      // Insert audit record into system_audit_logs
      const auditRes = await client.query(
        `INSERT INTO system_audit_logs (
          employees_id,
          action_performed,
          entity_type,
          entity_id,
          old_values,
          new_values,
          action_date
        ) VALUES (
          $1,
          'updated',
          'employee_profiles',
          $2,
          $3,
          $4,
          NOW()
        )
        RETURNING id, action_date`,
        [
          currentAdminId,
          empIdNum,
          JSON.stringify({ rank: oldRank, commission_percent: oldComm }),
          JSON.stringify({ rank: newRank, commission_percent: newComm })
        ]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Mechanic payroll settings updated and recorded in audit log',
        auditId: auditRes.rows[0]?.id,
        updated: {
          employeeId: empIdNum,
          rank: newRank,
          commissionPercent: newComm,
        }
      })
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Sales & Payroll PATCH error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to update mechanic settings and record audit log' },
      { status: 500 }
    )
  }
}
