// Philippine (LTO) vehicle plate numbers — formats per
// https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_the_Philippines
//
//   private / government / PUV / EV / trailer / vintage (current, 2018–):
//     3 letters + 4 digits, e.g. ABC1234 (government plates share this exact
//     shape — just a red background and often an S as the first letter)
//   same categories, 1981 series (still valid until reissued):
//     3 letters + 3 digits, e.g. ABC123
//   legacy reversed ordering, older government/PUV plates:
//     3 digits + 3 letters, e.g. 123ABC
//   diplomatic, pre-2014 series: 3–5 digits only, no letters, e.g. 10000
//   diplomatic, current series:  7 digits only, no letters, e.g. 0011234
//
// Motorcycles/tricycles use entirely different, more varied formats and are
// out of scope — this shop's fleet (confirmed against 506 real vehicles) is
// 100% 4-wheeled private cars. If that changes, extend this file rather than
// guessing at a pattern.

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
