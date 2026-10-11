export const NOTES_MAX_LENGTH = 500
export const MAX_SELECTED_SERVICES = 40
export const NOTE_MIN_WHEN_NO_SERVICE = 5

export type ServiceType = 'maintenance' | 'repair' | 'diagnostics'

export type DescribeInput = {
  packageName: string | null        // the package shortcut the customer used, if any
  packageServiceNames: string[]     // every service name in that package
  selected: Array<{ name: string; type: ServiceType }>   // replaces selectedNames
  notSure: boolean
  overnightOk: boolean
  customerNote: string
}

function clean(name: string): string {
  return name.replace(/\./g, '').replace(/\s+/g, ' ').trim()
}

export function buildCategoryLabel(input: {
  packageName: string | null
  packageServiceNames?: string[]
  selectedNames: string[]
  notSure: boolean
}): string {
  const { packageName, packageServiceNames = [], selectedNames, notSure } = input
  const hasTickedPackageService =
    Boolean(packageName) && packageServiceNames.some((n) => selectedNames.includes(n))

  let label = ''
  if (packageName && hasTickedPackageService) {
    const missing = packageServiceNames.filter((n) => !selectedNames.includes(n))
    const extras = selectedNames.filter((n) => !packageServiceNames.includes(n))
    label = clean(packageName)
    if (missing.length > 0) {
      label += ` (without: ${missing.map(clean).join(', ')})`
    }
    if (extras.length > 0) {
      label += ` plus ${extras.length} more`
    }
  } else if (selectedNames.length === 1) {
    label = clean(selectedNames[0])
  } else if (selectedNames.length > 1) {
    label = `${selectedNames.length} services`
  } else if (notSure) {
    label = 'Not sure, please check my car'
  } else {
    label = 'Other request'
  }

  label = label.replace(/\./g, '').replace(/[\r\n]+/g, ' ')
  return label.slice(0, 120)
}

// Returns the whole text saved in service_tickets.customer_concern.
export function buildConcernText(input: DescribeInput): string {
  const selectedNames = input.selected.map((s) => s.name)
  const label = buildCategoryLabel({
    packageName: input.packageName,
    packageServiceNames: input.packageServiceNames,
    selectedNames,
    notSure: input.notSure,
  })

  const bodyLines: string[] = []

  const maintenanceNames = input.selected.filter((s) => s.type === 'maintenance').map((s) => s.name)
  if (maintenanceNames.length > 0) {
    bodyLines.push(`Maintenance: ${maintenanceNames.join('; ')}`)
  }

  const repairNames = input.selected.filter((s) => s.type === 'repair').map((s) => s.name)
  if (repairNames.length > 0) {
    bodyLines.push(`Repair: ${repairNames.join('; ')}`)
  }

  const diagnosticsNames = input.selected.filter((s) => s.type === 'diagnostics').map((s) => s.name)
  if (diagnosticsNames.length > 0) {
    bodyLines.push(`Diagnostics: ${diagnosticsNames.join('; ')}`)
  }

  if (input.notSure) {
    bodyLines.push('Please check the car and tell me what it needs.')
  }

  if (input.overnightOk) {
    bodyLines.push('Overnight stay: OK, the customer agrees to leave the vehicle overnight.')
  }

  const trimmedNote = input.customerNote.trim().slice(0, NOTES_MAX_LENGTH)
  bodyLines.push(`Customer note: ${trimmedNote || 'None'}`)

  const body = bodyLines.join('\n')
  return `Category: ${label}. Notes: ${body}`
}
