import { requireStaff } from '@/lib/authGuard'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

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
      auditRes,
      partsSummaryRes,
      partsDoneRes,
      partsAggRes
    ] = await Promise.all([
      // 1. Payment records with itemized parts & services (both actual payments and unpaid job orders)
      db.query(`
        WITH recorded_payments AS (
          SELECT 
            p.id::text AS "paymentId",
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
              WHEN p.verification_status = 'verified' AND COALESCE(jo.balance, 0) <= 0 THEN 'Paid'
              ELSE 'To Be Paid'
            END AS status,
            COALESCE(jo.partial_payment, 0)::float AS "downpaymentAmount",
            COALESCE(jo.balance, 0)::float AS balance,
            COALESCE(jo.actual_grand_total, jo.estimated_grand_total, p.amount_paid, 0)::float AS "totalAmount",
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
        ),
        unpaid_job_orders AS (
          SELECT
            ('JO-' || jo.id) AS "paymentId",
            'CUS-' || u.id AS "customerId",
            COALESCE(u.first_name || ' ' || u.last_name, u.nickname, 'Customer #' || u.id) AS name,
            COALESCE(u.contact_number, 'N/A') AS contact,
            COALESCE((
              SELECT STRING_AGG(s.service_name, ', ')
              FROM job_order_services jos
              JOIN services s ON s.id = jos.service_id
              WHERE jos.job_order_id = jo.id
            ), 'General Service') AS services,
            'Pending' AS "modeOfPayment",
            CASE 
              WHEN jo.partial_payment > 0 AND COALESCE(jo.balance, 0) > 0 THEN 'Downpayment'
              ELSE 'Full Payment'
            END AS "paymentType",
            COALESCE(NULLIF(jo.balance::float, 0), jo.actual_grand_total::float, jo.estimated_grand_total::float, 0) AS amount,
            'To Be Paid' AS status,
            COALESCE(jo.partial_payment, 0)::float AS "downpaymentAmount",
            COALESCE(NULLIF(jo.balance::float, 0), jo.actual_grand_total::float, jo.estimated_grand_total::float, 0) AS balance,
            COALESCE(jo.actual_grand_total, jo.estimated_grand_total, 0)::float AS "totalAmount",
            jo.id AS "jobOrderId",
            COALESCE(jo.jo_date, NOW()) AS "paymentDate",
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
          FROM job_orders jo
          JOIN users u ON u.id = jo.user_id
          WHERE jo.status NOT IN ('cancelled', 'inspecting')
            AND (COALESCE(jo.balance, jo.actual_grand_total, jo.estimated_grand_total, 0) > 0)
            AND NOT EXISTS (
              SELECT 1 FROM payments p WHERE p.job_order_id = jo.id
            )
          ORDER BY 
            CASE 
              WHEN jo.status IN ('in_progress', 'waiting_on_parts', 'testing', 'completed') THEN 0 
              ELSE 1 
            END,
            COALESCE(jo.date_arrived, jo.jo_date) DESC,
            jo.id DESC
        )
        SELECT * FROM recorded_payments
        UNION ALL
        SELECT * FROM unpaid_job_orders
        ORDER BY "paymentDate" DESC
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
            SELECT COUNT(DISTINCT jo.id)::int
            FROM job_orders jo
            LEFT JOIN service_progress_tasks spt ON spt.job_order_id = jo.id
            WHERE (jo.assigned_mechanic_id = e.id OR spt.mechanic_id = e.id)
              AND jo.status NOT IN ('completed', 'released', 'cancelled')
          ), 0) AS "jobsAssigned",
          COALESCE(ep.jobs_capacity, 5) AS "jobsCapacity",
          COALESCE(ep.rank, 'Mechanic') AS rank,
          COALESCE(ep.base_salary, 15000)::float AS "baseSalary",
          COALESCE(ep.commission_percent, 25)::float AS "commissionPercent",
          COALESCE((
            SELECT COUNT(DISTINCT jo.id)::int 
            FROM job_orders jo
            LEFT JOIN service_progress_tasks spt ON spt.job_order_id = jo.id
            WHERE (jo.assigned_mechanic_id = e.id OR spt.mechanic_id = e.id)
              AND jo.status IN ('completed', 'released')
          ), 0) AS "servicesDoneWeekly",
          COALESCE(ep.color, '#3b82f6') AS color
        FROM employees e
        LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
        WHERE e.role::text IN ('mechanic', 'operations_manager', 'owner')
          AND e.status != 'terminated'
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
            WHERE verification_status = 'verified'
              AND payment_date >= NOW() - $1::interval
          ), 0) AS "grossSales",
          COALESCE((
            SELECT SUM(amount_paid)::float 
            FROM payments 
            WHERE verification_status = 'verified'
              AND payment_date >= NOW() - ($1::interval * 2) 
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
      `),

      // 8. Parts financial summary for the cycle (total customer paid vs total admin supplier cost)
      db.query(`
        SELECT 
          COUNT(jop.id)::int AS "partsCount",
          COALESCE(SUM(jop.quantity), 0)::int AS "totalUnits",
          ROUND(COALESCE(SUM(jop.total_retail_amount), 0))::float AS "totalCustomerPaid",
          ROUND(COALESCE(SUM(jop.quantity * COALESCE(jop.supplier_unit_cost, 0)), 0))::float AS "totalAdminCost",
          ROUND(COALESCE(SUM(jop.total_retail_amount), 0) - COALESCE(SUM(jop.quantity * COALESCE(jop.supplier_unit_cost, 0)), 0))::float AS "totalPartsProfit"
        FROM job_order_parts jop
        JOIN job_orders jo ON jo.id = jop.job_order_id
        WHERE jo.status IN ('completed', 'released')
          AND (COALESCE(jo.completed_at, jo.jo_date) >= NOW() - $1::interval OR ($1::text = '100 years'))
      `, [intervalStr]),

      // 9. Detailed itemized log of all parts used during the cycle
      db.query(`
        SELECT 
          jop.id,
          jo.id AS "jobOrderId",
          COALESCE(u.first_name || ' ' || u.last_name, u.nickname, 'Customer #' || u.id) AS "customerName",
          COALESCE(v.vehicle_model, 'Vehicle') AS "vehicleModel",
          COALESCE(v.plate_number, 'N/A') AS "plateNumber",
          COALESCE(jop.part_number, 'N/A') AS "partNumber",
          jop.description AS "partName",
          jop.quantity AS qty,
          COALESCE(jop.supplier_unit_cost, 0)::float AS "supplierUnitCost",
          ROUND(COALESCE(jop.quantity * jop.supplier_unit_cost, 0))::float AS "adminTotalCost",
          COALESCE(jop.retail_unit_price, 0)::float AS "retailUnitPrice",
          ROUND(COALESCE(jop.total_retail_amount, jop.quantity * jop.retail_unit_price, 0))::float AS "customerTotalPaid",
          ROUND(COALESCE(jop.total_retail_amount, jop.quantity * jop.retail_unit_price, 0) - COALESCE(jop.quantity * jop.supplier_unit_cost, 0))::float AS profit,
          ROUND(
            CASE 
              WHEN COALESCE(jop.total_retail_amount, jop.quantity * jop.retail_unit_price, 0) > 0 
              THEN ((COALESCE(jop.total_retail_amount, jop.quantity * jop.retail_unit_price, 0) - COALESCE(jop.quantity * jop.supplier_unit_cost, 0)) / COALESCE(jop.total_retail_amount, jop.quantity * jop.retail_unit_price, 0) * 100)
              ELSE 0 
            END
          )::float AS "marginPercent",
          COALESCE(jo.completed_at, jo.jo_date) AS "completedAt"
        FROM job_order_parts jop
        JOIN job_orders jo ON jo.id = jop.job_order_id
        LEFT JOIN users u ON u.id = jo.user_id
        LEFT JOIN vehicles v ON v.id = jo.vehicle_id
        WHERE jo.status IN ('completed', 'released')
          AND (COALESCE(jo.completed_at, jo.jo_date) >= NOW() - $1::interval OR ($1::text = '100 years'))
        ORDER BY COALESCE(jo.completed_at, jo.jo_date) DESC, jop.id DESC
        LIMIT 250
      `, [intervalStr]),

      // 10. Aggregated parts profit summary grouped by part name
      db.query(`
        SELECT 
          jop.description AS name,
          COALESCE(jop.part_number, 'N/A') AS "partNumber",
          SUM(jop.quantity)::int AS qty,
          ROUND(AVG(jop.supplier_unit_cost))::float AS "avgSupplierCost",
          ROUND(AVG(jop.retail_unit_price))::float AS "avgRetailPrice",
          ROUND(SUM(jop.quantity * COALESCE(jop.supplier_unit_cost, 0)))::float AS "totalAdminCost",
          ROUND(SUM(jop.total_retail_amount))::float AS "totalCustomerPaid",
          ROUND(SUM(jop.total_retail_amount) - SUM(jop.quantity * COALESCE(jop.supplier_unit_cost, 0)))::float AS profit
        FROM job_order_parts jop
        JOIN job_orders jo ON jo.id = jop.job_order_id
        WHERE jo.status IN ('completed', 'released')
          AND (COALESCE(jo.completed_at, jo.jo_date) >= NOW() - $1::interval OR ($1::text = '100 years'))
        GROUP BY jop.description, jop.part_number
        ORDER BY profit DESC
        LIMIT 50
      `, [intervalStr])
    ])

    const mechanicsRaw = mechanicsRes.rows
    const paymentRecords = paymentsRes.rows
    const weeklyServices = servicesSummaryRes.rows
    const servicesDone = servicesDoneRes.rows
    const auditLogs = auditRes.rows

    const partsTotalsRaw = partsSummaryRes.rows[0] || {
      partsCount: 0,
      totalUnits: 0,
      totalCustomerPaid: 0,
      totalAdminCost: 0,
      totalPartsProfit: 0,
    }
    const partsCount = Number(partsTotalsRaw.partsCount || 0)
    const partsUnits = Number(partsTotalsRaw.totalUnits || 0)
    const partsCustomerPaid = Number(partsTotalsRaw.totalCustomerPaid || 0)
    const partsAdminCost = Number(partsTotalsRaw.totalAdminCost || 0)
    const partsProfit = Number(partsTotalsRaw.totalPartsProfit || 0)

    const partsDone = partsDoneRes.rows
    const partsSummary = partsAggRes.rows

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

    // Services Profit + Parts Profit = Net Profit
    const servicesProfit = Math.max(0, Math.round(finishedServicesTotal - totalCommissionPool))
    const netProfit = Math.max(0, Math.round(servicesProfit + partsProfit))

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
        servicesProfit,
        partsCustomerPaid,
        partsAdminCost,
        partsProfit,
        partsCount,
        partsUnits,
        netProfit,
        activeMechanicsCount,
      },
      paymentRecords,
      mechanics,
      weeklyServices,
      servicesDone,
      partsDone,
      partsSummary,
      partsTotals: {
        partsCount,
        totalUnits: partsUnits,
        totalCustomerPaid: partsCustomerPaid,
        totalAdminCost: partsAdminCost,
        totalPartsProfit: partsProfit,
      },
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
  const auth = await requireStaff(); if (!auth.ok) return auth.response;

  try {
    const body = await request.json()
    const { employeeId, field, value } = body

    if (!employeeId || !field || value === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required parameters (employeeId, field, value)' },
        { status: 400 }
      )
    }

    const empIdNum = parseInt(String(employeeId), 10)
    const currentAdminId = auth.session.userId

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
