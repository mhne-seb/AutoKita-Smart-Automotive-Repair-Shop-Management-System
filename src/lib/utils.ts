import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// crypto.randomUUID() only exists in secure contexts (https or localhost),
// so it fails when the dev server is opened via a LAN IP over http.
export function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* fall through to the manual id */
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

// Postgres timestamps arrive as raw text ("2026-09-22 19:51:57.896302"),
// which is no use to a customer. Show them as 09/22/2026 07:51 PM.
export function formatStamp(value: string | Date | null | undefined): string {
  if (!value) return ''
  let d: Date
  if (value instanceof Date) {
    d = value
  } else {
    // Postgres gives "2026-09-22 19:51:57.896302+08": the space isn't valid
    // ISO, and a "+08" offset needs its minutes to parse.
    const iso = String(value).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
    d = new Date(iso)
    if (isNaN(d.getTime())) d = new Date(String(value))
  }
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-PH', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
