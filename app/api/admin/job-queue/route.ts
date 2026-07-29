import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    
    const query = `
      SELECT 
          st.id as ticket_id,
          st.service_mode,
          st.customer_concern,
          st.ticket_status,
          st.request_date,
          u.id as user_id,
          u.first_name,
          u.last_name,
          u.contact_number,
          u.email,
          v.vehicle_model,
          v.plate_number,
          v.vehicle_year,
          (
              SELECT sal.employees_id 
              FROM job_orders jo 
              JOIN system_audit_logs sal ON sal.entity_id = jo.id AND sal.entity_type = 'job_orders'
              WHERE jo.ticket_id = st.id AND sal.employees_id IS NOT NULL
              ORDER BY sal.action_date DESC
              LIMIT 1
          ) as mechanic_id
      FROM service_tickets st
      JOIN users u ON u.id = st.user_id
      JOIN vehicles v ON v.id = st.vehicle_id
      ORDER BY st.request_date DESC
    `
    const result = await db.query(query)

   
    const mechanicsQuery = `SELECT id, full_name, email FROM employees WHERE role = 'mechanic'`
    const mechanicsResult = await db.query(mechanicsQuery)
    const mechanics = mechanicsResult.rows

    return NextResponse.json({
      success: true,
      tickets: result.rows,
      mechanics
    })
  } catch (err: any) {
    console.error('Job queue GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, ticketId, mechanicId, holdReason } = body

    if (!ticketId || !action) {
      return NextResponse.json({ success: false, message: 'Missing parameters' }, { status: 400 })
    }

    if (action === 'approve') {
     
      const joQuery = `SELECT * FROM create_job_order_from_ticket($1, $2)`
      const joResult = await db.query(joQuery, [ticketId, mechanicId || null])
      
      const newJo = joResult.rows[0]

     
      if (mechanicId && newJo) {
        const assignQuery = `SELECT assign_mechanic_to_job_order($1, $2)`
        await db.query(assignQuery, [newJo.id, mechanicId])
      }
      
      return NextResponse.json({ success: true, jobOrder: newJo })
    } 
    else if (action === 'reject') {
      // update_ticket_status
      const rejectQuery = `SELECT update_ticket_status($1, 'declined')`
      await db.query(rejectQuery, [ticketId])
      return NextResponse.json({ success: true })
    }
    else if (action === 'hold') {
      // Assuming 'inspection_scheduled' or 'queued' for hold
      // We will just use 'queued' and we could store the reason in customer_concern if needed,
      // but for now we'll just set it back to 'queued' or a similar pending state.
      const holdQuery = `SELECT update_ticket_status($1, 'queued')`
      await db.query(holdQuery, [ticketId])
      return NextResponse.json({ success: true, reason: holdReason })
    }
    
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
    
  } catch (err: any) {
    console.error('Job queue POST error:', err)
    return NextResponse.json(
      { success: false, message: 'Internal server error', debug: err.message },
      { status: 500 }
    )
  }
}
