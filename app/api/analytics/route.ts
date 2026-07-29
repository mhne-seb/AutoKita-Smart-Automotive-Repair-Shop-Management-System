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

    // Calculations
    const currentRev = parseFloat(current.revenue) || 0
    const prevRev = parseFloat(prev.revenue) || 1 // avoid div by zero
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
        }))
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
