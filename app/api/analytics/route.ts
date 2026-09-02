import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const parsedDays = parseInt(searchParams.get('days') || '30', 10)
    const days = isNaN(parsedDays) ? 30 : parsedDays
    const prevDays = days * 2

    // 1. Current Period (Revenue & Jobs)
    const currentRes = await db.query(`
      SELECT 
        COALESCE(SUM(actual_grand_total), 0) as revenue,
        COUNT(id) as jobs_completed
      FROM job_orders 
      WHERE completed_at >= NOW() - ($1 * INTERVAL '1 day')
    `, [days])
    const current = currentRes.rows[0]

    // 2. Previous Period (for trends)
    const prevRes = await db.query(`
      SELECT 
        COALESCE(SUM(actual_grand_total), 0) as revenue,
        COUNT(id) as jobs_completed
      FROM job_orders 
      WHERE completed_at >= NOW() - ($2 * INTERVAL '1 day')
        AND completed_at < NOW() - ($1 * INTERVAL '1 day')
    `, [days, prevDays])
    const prev = prevRes.rows[0]

    // 3. Operational Safety Rate (Jobs completed on time)
    const safetyRes = await db.query(`
      SELECT
        COUNT(id) as total_jobs,
        SUM(CASE WHEN completed_at <= date_promised THEN 1 ELSE 0 END) as safe_jobs
      FROM job_orders
      WHERE completed_at >= NOW() - ($1 * INTERVAL '1 day')
    `, [days])
    const safety = safetyRes.rows[0]

    // 4. Monthly Trend Chart (Last 6 Months)
    const trendRes = await db.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', completed_at), 'Mon') as month,
        DATE_TRUNC('month', completed_at) as month_date,
        COALESCE(SUM(actual_grand_total), 0) as revenue,
        COUNT(id) as jobs_completed
      FROM job_orders
      WHERE completed_at >= DATE_TRUNC('month', NOW() - INTERVAL '5 months')
        AND completed_at IS NOT NULL
      GROUP BY DATE_TRUNC('month', completed_at), TO_CHAR(DATE_TRUNC('month', completed_at), 'Mon')
      ORDER BY month_date ASC
    `)

    // 5. Service Mix Query (Safely isolated)
    let serviceMixData: any[] = []
    let activeTableData: any[] = []

    const COLOR_PALETTE = ['#1e3a5f', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6']

    try {
      const serviceMixRes = await db.query(`
        WITH ranked_services AS (
          SELECT 
            s.service_name AS label,
            COUNT(jos.id)::numeric AS cnt
          FROM job_order_services jos
          JOIN services s ON jos.service_id = s.id
          GROUP BY s.service_name
        ),
        total AS (
          SELECT COALESCE(SUM(cnt), 1) AS total_cnt FROM ranked_services
        ),
        bucketed AS (
          SELECT 
            CASE 
              WHEN ROW_NUMBER() OVER (ORDER BY cnt DESC) <= 4 THEN label 
              ELSE 'Other' 
            END AS category,
            cnt
          FROM ranked_services
        )
        SELECT 
          b.category AS label,
          ROUND((SUM(b.cnt) / t.total_cnt) * 100, 1) AS percent
        FROM bucketed b, total t
        GROUP BY b.category, t.total_cnt
        ORDER BY percent DESC
      `)

      const activeTableRes = await db.query(`
      SELECT 
        jo.id AS "jobOrderId",
        COALESCE(u.first_name || ' ' || u.last_name, 'Unknown Customer') AS name,
        COALESCE(v.vehicle_model, 'Unknown Vehicle') AS vehicle,
        COALESCE(v.plate_number, 'N/A') AS plate,
        COALESCE(jo.actual_grand_total, 0) AS "totalCost",
        COALESCE(jo.balance, 0) AS "balanceDue",
        jo.status
      FROM job_orders jo
      LEFT JOIN users u ON jo.user_id = u.id
      LEFT JOIN vehicles v ON jo.vehicle_id = v.id
      WHERE jo.status NOT IN ('completed', 'released')
      ORDER BY jo.jo_date DESC, jo.id DESC
      LIMIT 6
    `)

      activeTableData = activeTableRes.rows

      serviceMixData = serviceMixRes.rows.map((row: any, index: number) => ({
        label: row.label,
        percent: parseFloat(row.percent) || 0,
        color: COLOR_PALETTE[index % COLOR_PALETTE.length],
      }))
    } catch (mixErr) {
      console.error('Service Mix SQL Error (falling back to mock for pie chart only):', mixErr)
        ; (global as any).__lastMixError = mixErr instanceof Error ? mixErr.message : String(mixErr)

    }

    // Calculations
    const currentRev = parseFloat(current.revenue) || 0
    const prevRev = parseFloat(prev.revenue) || 1
    const revTrend = prevRev > 1 ? ((currentRev - prevRev) / prevRev) * 100 : 100

    const currentJobs = parseInt(current.jobs_completed) || 0
    const prevJobs = parseInt(prev.jobs_completed) || 1
    const jobTrend = prevJobs > 1 ? ((currentJobs - prevJobs) / prevJobs) * 100 : 100

    const dailyJobs = days > 0 ? currentJobs / days : currentJobs

    const totalSafetyJobs = parseInt(safety.total_jobs) || 1
    const safeJobs = parseInt(safety.safe_jobs) || 0
    const safetyRate = totalSafetyJobs > 0 ? (safeJobs / totalSafetyJobs) * 100 : 100

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          revenue: currentRev,
          revenueTrend: revTrend,
          jobsDone: currentJobs,
          jobsTrend: jobTrend,
          averageDailyJobs: dailyJobs,
          safetyRate: safetyRate
        },
        chartData: trendRes.rows.map(row => ({
          month: row.month,
          revenue: parseFloat(row.revenue),
          jobsCompleted: parseInt(row.jobs_completed)
        })),
        serviceMix: serviceMixData,
        activeTable: activeTableData,
        _debugMixError: (global as any).__lastMixError || null
      }
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch analytics', detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}