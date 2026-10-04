
const PATTERNS = [
  /^[A-Z]{3}[0-9]{3,4}$/, // private / government / PUV / EV / trailer / vintage
  /^[0-9]{3}[A-Z]{3}$/,   // legacy reversed government/PUV
  /^[0-9]{3,5}$/,         // diplomatic, pre-2014
  /^[0-9]{7}$/,           // diplomatic, current
]

/** Uppercases and drops spaces/dashes so "abc-1234" and "ABC 1234" compare equal. */
export function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '')
}

export function isValidPhPlate(raw: string): boolean {
  const p = normalizePlate(raw)
  return PATTERNS.some((re) => re.test(p))
}

/** Shown in placeholders and validation messages — the common case, not every accepted format. */
export const PLATE_FORMAT_HINT = 'ABC1234'
export const PLATE_FORMAT_ERROR =
  'Enter a valid PH plate number — 3 letters + 3 or 4 digits, e.g. ABC1234'
