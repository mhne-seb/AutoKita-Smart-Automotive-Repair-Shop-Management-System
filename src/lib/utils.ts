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

// Postgres gives "2026-09-22 19:51:57.896302+08": the space isn't valid ISO,
// and a "+08" offset needs its minutes before any browser will parse it.
export function parseStamp(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const iso = String(value).replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00')
  let d = new Date(iso)
  if (isNaN(d.getTime())) d = new Date(String(value))
  return isNaN(d.getTime()) ? null : d
}

export function formatStamp(value: string | Date | null | undefined): string {
  const d = parseStamp(value)
  if (!d) return ''
  return d.toLocaleString('en-PH', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
