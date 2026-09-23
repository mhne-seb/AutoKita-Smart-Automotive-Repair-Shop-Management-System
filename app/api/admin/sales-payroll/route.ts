import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cycle = searchParams.get('cycle') || 'weekly'
    const poolRateParam = searchParams.get('poolRate')
    const poolRate = poolRateParam !== null ? Math.max(0, Math.min(100, parseFloat(poolRateParam) || 0)) : 20
    const poolMultiplier = poolRate / 100
    
    // Determine interval for SQL filtering
    let intervalStr = '7 days'
    if (cycle === 'daily') intervalStr = '1 day'
    else if (cycle === 'monthly') intervalStr = '30 days'
    else if (cycle === 'all') intervalStr = '100 years'

    const [
      paymentsRes,
      mechanicsRes,
      servicesSummaryRes,
      servicesDoneRes,
      finishedTotalsRes,
      kpiRes,
      auditRes
    ] = await Promise.all([
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
            WHEN jo.partial_payment > 0 AND COALESCE(jo.balance, 0) > 0 THEN 'Downpayment'
            ELSE 'Full Payment'
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
          COALESCE(ep.commission_percent, 25)::float AS "commissionPercent",
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

      // 3. Services done summary for the cycle (aggregated by service name)
      db.query(`
        SELECT 
          s.service_name AS name,
          COUNT(jos.id)::int AS qty,
          ROUND(AVG(jos.actual_amount))::float AS price,
          ROUND(SUM(jos.actual_amount))::float AS "totalAmount",
          ROUND(SUM(jos.actual_amount * $2::float))::float AS "allocatedCommission"
        FROM job_order_services jos
        JOIN services s ON s.id = jos.service_id
        JOIN job_orders jo ON jo.id = jos.job_order_id
        WHERE jo.status IN ('completed', 'released')
          AND jo.completed_at >= NOW() - $1::interval
        GROUP BY s.service_name
        ORDER BY qty DESC
        LIMIT 25
      `, [intervalStr, poolMultiplier]),

      // 4. Detailed itemized log of all services finished during the cycle
      db.query(`
        SELECT 
          jos.id,
          jo.id AS "jobOrderId",
          s.service_name AS "serviceName",
          COALESCE(u.first_name || ' ' || u.last_name, u.nickname, 'Customer #' || u.id) AS "customerName",
          COALESCE(v.vehicle_model, 'Vehicle') AS "vehicleModel",
          COALESCE(v.plate_number, 'N/A') AS "plateNumber",
          jo.completed_at AS "completedAt",
          jos.actual_amount::float AS "amount",
          ROUND(jos.actual_amount * $2::float)::float AS "commission"
        FROM job_order_services jos
        JOIN services s ON s.id = jos.service_id
        JOIN job_orders jo ON jo.id = jos.job_order_id
        LEFT JOIN users u ON u.id = jo.user_id
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        WHERE jo.status IN ('completed', 'released')
          AND jo.completed_at >= NOW() - $1::interval
        ORDER BY jo.completed_at DESC
        LIMIT 200
      `, [intervalStr, poolMultiplier]),

      // 5. Finished services total & commission pool
      db.query(`
        SELECT 
          COUNT(jos.id)::int AS "servicesCount",
          COALESCE(SUM(jos.actual_amount), 0)::float AS "finishedServicesTotal",
          ROUND(COALESCE(SUM(jos.actual_amount * $2::float), 0))::float AS "totalCommissionPool"
        FROM job_order_services jos
        JOIN job_orders jo ON jo.id = jos.job_order_id
        WHERE jo.status IN ('completed', 'released')
          AND jo.completed_at >= NOW() - $1::interval
      `, [intervalStr, poolMultiplier]),

      // 6. Sales & Profit KPI metrics
      db.query(`
        SELECT 
          COALESCE((
            SELECT SUM(amount_paid)::float 
            FROM payments 
            WHERE payment_date >= NOW() - $1::interval
          ), 0) AS "grossSales",
          COALESCE((
            SELECT SUM(amount_paid)::float 
            FROM payments 
            WHERE payment_date >= NOW() - ($1::interval * 2) 
              AND payment_date < NOW() - $1::interval
          ), 0) AS "prevGrossSales"
      `, [intervalStr]),

      // 7. Recent audit logs for sales & payroll
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

    const mechanicsRaw = mechanicsRes.rows
    const paymentRecords = paymentsRes.rows
    const weeklyServices = servicesSummaryRes.rows
    const servicesDone = servicesDoneRes.rows
    const auditLogs = auditRes.rows

    const finishedTotals = finishedTotalsRes.rows[0] || {
      servicesCount: 0,
      finishedServicesTotal: 0,
      totalCommissionPool: 0,
    }

    const servicesCount = finishedTotals.servicesCount || 0
    const finishedServicesTotal = finishedTotals.finishedServicesTotal || 0
    const totalCommissionPool = finishedTotals.totalCommissionPool || Math.round(finishedServicesTotal * poolMultiplier)

    const grossSales = kpiRes.rows[0]?.grossSales || finishedServicesTotal
    const prevGrossSales = kpiRes.rows[0]?.prevGrossSales || 0
    const salesGrowthPct = prevGrossSales > 0 
      ? (((grossSales - prevGrossSales) / prevGrossSales) * 100).toFixed(1)
      : '0.0'

    // Compute shared commission among the active mechanics
    const activeMechanicsCount = mechanicsRaw.length
    const equalSharePercent = activeMechanicsCount > 0 ? Math.round(100 / activeMechanicsCount) : 0
    const sharedCommissionPerEmployee = activeMechanicsCount > 0 
      ? Math.round(totalCommissionPool / activeMechanicsCount)
      : 0

    const mechanics = mechanicsRaw.map((m: any) => {
      const rawComm = Number(m.commissionPercent)
      // If employee has a customized commission share, use it; otherwise default to equal share
      const sharePercent = (!isNaN(rawComm) && rawComm > 0 && rawComm <= 100) ? rawComm : equalSharePercent
      const commissionPay = Math.round(totalCommissionPool * (sharePercent / 100))
      const baseSalary = m.baseSalary || 0
      const totalEstimatedPay = baseSalary + commissionPay

      return {
        ...m,
        commissionPercent: sharePercent,
        commissionSalary: commissionPay,
        totalEstimatedPay,
        servicesDoneWeekly: servicesCount,
      }
    })

    const netProfit = Math.max(0, Math.round(grossSales - totalCommissionPool))

    return NextResponse.json({
      success: true,
      cycle,
      poolRate,
      kpi: {
        cycle,
        finishedServicesTotal,
        totalCommissionPool,
        commissionRatePct: poolRate,
        sharedCommissionPerEmployee,
        servicesCount,
        weeklyGrossSales: grossSales,
        prevWeeklyGrossSales: prevGrossSales,
        salesGrowthPct,
        totalCommissions: totalCommissionPool,
        netProfit,
        activeMechanicsCount,
      },
      paymentRecords,
      mechanics,
      weeklyServices,
      servicesDone,
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
