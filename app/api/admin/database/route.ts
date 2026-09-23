import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

function formatEntityLabel(entityType: string): string {
  switch (entityType) {
    case 'service_tickets':
      return 'Service Ticket Table'
    case 'job_orders':
      return 'Job Order Table'
    case 'employee_profiles':
      return 'Employee Profile Table'
    case 'employees':
      return 'Employee Table'
    case 'payments':
      return 'Payment Table'
    case 'service_progress_tasks':
      return 'Progress Task Table'
    case 'service_findings':
      return 'Service Finding Table'
    case 'pre_diagnostics':
      return 'Pre-Diagnostic Table'
    case 'obd2_diagnostic_reports':
      return 'OBD-II Diagnostic Table'
    case 'road_tests':
      return 'Road Test Table'
    case 'pull_out_requests':
      return 'Pull-Out Request Table'
    case 'retention_offers':
      return 'Retention Offer Table'
    case 'job_order_parts':
      return 'Job Order Part Table'
    case 'chat_sessions':
      return 'Customer Chat Session Table'
    case 'chat_messages':
      return 'Customer Chat Message Table'
    case 'internal_ai_sessions':
      return 'Internal AI Session Table'
    case 'internal_ai_messages':
      return 'Internal AI Message Table'
    default:
      return entityType
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ') + ' Table'
  }
}

function formatEntityId(entityType: string, entityId: number): string {
  if (!entityId) return 'N/A'
  switch (entityType) {
    case 'service_tickets':
      return `ST-${entityId}`
    case 'job_orders':
      return `JO-${entityId}`
    case 'employees':
    case 'employee_profiles':
      return `EMP-${entityId}`
    case 'payments':
      return `PAY-${entityId}`
    case 'service_progress_tasks':
      return `TASK-${entityId}`
    case 'retention_offers':
      return `OFFER-${entityId}`
    case 'chat_sessions':
      return `CHAT-${entityId}`
    case 'chat_messages':
      return `MSG-${entityId}`
    case 'internal_ai_sessions':
      return `AI-SESS-${entityId}`
    case 'internal_ai_messages':
      return `AI-MSG-${entityId}`
    default:
      return `#${entityId}`
  }
}

function formatActionTitle(action: string, entityType: string, newVals: any): string {
  if (entityType === 'service_tickets' && action === 'approved') {
    return 'Accepted Service Ticket'
  }
  if (entityType === 'service_tickets' && action === 'rejected') {
    return 'Rejected Service Ticket'
  }
  if (entityType === 'service_tickets' && action === 'status_changed') {
    return 'Modified Ticket Status'
  }
  if (entityType === 'employee_profiles' && action === 'updated') {
    return 'Modified Mechanic Profile'
  }
  if (entityType === 'employees' && action === 'created') {
    return 'Added New Mechanic'
  }
  if (entityType === 'job_orders' && action === 'created') {
    return 'Created Job Order'
  }
  if (entityType === 'job_orders' && action === 'status_changed') {
    return 'Changed Job Order Status'
  }
  if (action === 'status_changed') {
    return `Changed Status (${formatEntityLabel(entityType).replace(' Table', '')})`
  }
  if (action === 'created') {
    return `Created ${formatEntityLabel(entityType).replace(' Table', '')}`
  }
  if (action === 'updated') {
    return `Modified ${formatEntityLabel(entityType).replace(' Table', '')} Details`
  }
  if (action === 'deleted') {
    return `Deleted ${formatEntityLabel(entityType).replace(' Table', '')}`
  }
  return `${action.charAt(0).toUpperCase() + action.slice(1)} ${formatEntityLabel(entityType).replace(' Table', '')}`
}

function formatVal(val: any): string {
  if (val === null || val === undefined) return 'None'
  if (typeof val === 'object') return JSON.stringify(val)
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  return String(val)
}

function parseDiff(oldValues: string | null, newValues: string | null): Array<{ field: string; from: string; to: string }> {
  let oldObj: any = null
  let newObj: any = null

  if (oldValues) {
    try {
      oldObj = JSON.parse(oldValues)
    } catch {
      oldObj = oldValues
    }
  }

  if (newValues) {
    try {
      newObj = JSON.parse(newValues)
    } catch {
      newObj = newValues
    }
  }

  // If both or either is an object
  if (typeof newObj === 'object' && newObj !== null && !Array.isArray(newObj)) {
    const keys = Array.from(new Set([...Object.keys(newObj), ...(oldObj && typeof oldObj === 'object' ? Object.keys(oldObj) : [])]))
    const diffs: Array<{ field: string; from: string; to: string }> = []

    for (const key of keys) {
      const fromVal = oldObj && typeof oldObj === 'object' ? oldObj[key] : undefined
      const toVal = newObj[key]
      if (fromVal !== toVal) {
        const fieldName = key
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
        diffs.push({
          field: fieldName,
          from: formatVal(fromVal),
          to: formatVal(toVal),
        })
      }
    }
    if (diffs.length > 0) return diffs
  }

  // Fallback if plain text
  if (oldValues || newValues) {
    return [
      {
        field: 'Record Details',
        from: oldValues || 'None',
        to: newValues || 'None',
      },
    ]
  }

  return []
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '500', 10)

    const query = `
      SELECT 
        sal.id,
        sal.user_id,
        sal.employees_id,
        sal.action_performed::text AS action_performed,
        sal.entity_type,
        sal.entity_id,
        sal.old_values,
        sal.new_values,
        sal.action_date,
        NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS customer_name,
        u.nickname AS user_nickname,
        u.email AS user_email,
        e.full_name AS employee_name,
        e.role AS employee_role
      FROM system_audit_logs sal
      LEFT JOIN users u ON u.id = sal.user_id
      LEFT JOIN employees e ON e.id = sal.employees_id
      ORDER BY sal.action_date DESC, sal.id DESC
      LIMIT $1
    `

    const result = await db.query(query, [limit])

    const entries = result.rows.map((row: any) => {
      let parsedNew: any = null
      try {
        parsedNew = row.new_values ? JSON.parse(row.new_values) : null
      } catch {}

      // Resolve User display
      let userDisplay = 'System / None'
      if (row.user_nickname) {
        userDisplay = row.user_nickname
      } else if (row.customer_name) {
        userDisplay = row.customer_name
      } else if (row.user_email) {
        userDisplay = row.user_email
      } else if (row.user_id) {
        userDisplay = `User #${row.user_id}`
      }

      // Resolve Employee display
      let employeeDisplay = 'System / Auto'
      if (row.employee_name) {
        employeeDisplay = row.employee_name
      } else if (parsedNew?.accepted_by) {
        employeeDisplay = parsedNew.accepted_by
      } else if (parsedNew?.created_by) {
        employeeDisplay = parsedNew.created_by
      } else if (row.employees_id) {
        employeeDisplay = `Employee #${row.employees_id}`
      }

      const actionTitle = formatActionTitle(row.action_performed, row.entity_type, parsedNew)
      const entityLabel = formatEntityLabel(row.entity_type)
      const entityIdFormatted = formatEntityId(row.entity_type, row.entity_id)

      // Ticket acceptance metadata if applicable
      const isTicketAcceptance =
        row.entity_type === 'service_tickets' &&
        (row.action_performed === 'approved' || Boolean(parsedNew?.accepted_by))

      const ticketAcceptance = isTicketAcceptance
        ? {
            ticketId: row.entity_id,
            acceptedBy: parsedNew?.accepted_by || row.employee_name || 'Admin',
            acceptedByEmployeeId: parsedNew?.accepted_by_employee_id || row.employees_id,
            assignedMechanic: parsedNew?.assigned_mechanic || 'Unassigned',
            assignedMechanicId: parsedNew?.assigned_mechanic_id,
            jobOrderId: parsedNew?.job_order_id,
            summary: parsedNew?.description || `Accepted ticket #${row.entity_id}`,
          }
        : null

      const dateObj = new Date(row.action_date)
      const dateStr = !isNaN(dateObj.getTime())
        ? dateObj.toISOString().split('T')[0]
        : '2026-05-27'
      const timeStr = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })
        : ''

      return {
        id: `#DB-${row.id}`,
        rawId: row.id,
        user: userDisplay,
        employee: employeeDisplay,
        employeeRole: row.employee_role || 'Staff',
        employeeId: row.employees_id,
        userId: row.user_id,
        action: actionTitle,
        rawAction: row.action_performed,
        entityType: entityLabel,
        rawEntityType: row.entity_type,
        entityId: entityIdFormatted,
        rawEntityId: row.entity_id,
        date: dateStr,
        time: timeStr,
        fullDate: `${dateStr} ${timeStr}`.trim(),
        oldValues: row.old_values,
        newValues: row.new_values,
        diff: parseDiff(row.old_values, row.new_values),
        ticketAcceptance,
      }
    })

    return NextResponse.json({
      success: true,
      entries,
      totalCount: entries.length,
    })
  } catch (err: any) {
    console.error('Database administration audit logs GET error:', err)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch audit logs', debug: err.message },
      { status: 500 }
    )
  }
}
