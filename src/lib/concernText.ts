// Reads the text saved in service_tickets.customer_concern by buildConcernText() (src/lib/bookingServices.ts)
// back into parts, so the admin can see it as a list instead of one long line.
// Text that does not follow that format (older or admin-made tickets) comes back as `plain` and is shown as is.

export interface ParsedConcern {
  category: string | null
  groups: { title: string; items: string[] }[]
  notSure: boolean
  overnight: boolean
  note: string | null
  other: string[]
  plain: string | null
}

const GROUP_TITLES = ['Maintenance', 'Repair', 'Diagnostics']
const NOT_SURE_LINE = 'Please check the car and tell me what it needs.'

export function parseConcernText(raw: string | null | undefined): ParsedConcern {
  const empty: ParsedConcern = { category: null, groups: [], notSure: false, overnight: false, note: null, other: [], plain: null }
  const text = (raw ?? '').trim()
  if (!text || text === 'N/A') return empty

  const m = text.match(/^Category:\s*(.*?)\.\s*Notes:\s*([\s\S]*)$/i)
  if (!m) return { ...empty, plain: text }

  const result: ParsedConcern = { ...empty, category: m[1].trim() || null }
  let body = m[2]

  // The customer's own note is last and can run over several lines, so cut it off first.
  const noteMatch = body.match(/(?:^|\n)Customer note:\s*([\s\S]*)$/)
  if (noteMatch) {
    const note = noteMatch[1].trim()
    result.note = note && note.toLowerCase() !== 'none' ? note : null
    body = body.slice(0, noteMatch.index)
  }

  for (const line of body.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const group = line.match(/^(Maintenance|Repair|Diagnostics):\s*(.*)$/)
    if (group && GROUP_TITLES.includes(group[1])) {
      result.groups.push({ title: group[1], items: group[2].split(';').map((i) => i.trim()).filter(Boolean) })
    } else if (line === NOT_SURE_LINE) {
      result.notSure = true
    } else if (/^Overnight stay:/i.test(line)) {
      result.overnight = true
    } else {
      result.other.push(line)
    }
  }
  return result
}
