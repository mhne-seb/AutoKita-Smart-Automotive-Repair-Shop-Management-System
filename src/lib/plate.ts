/**
 * License plate normalization, formatting, and validation matching
 * Land Transportation Office (LTO) Philippine vehicle plate standards
 * and the PostgreSQL database check constraint `vehicles_plate_number_format`:
 * 
 * CHECK (
 *   (plate_number ~ '^[A-Z]{3}[0-9]{2,4}$') OR
 *   (plate_number ~ '^[A-Z]{2}[0-9]{4,5}$') OR
 *   (plate_number ~ '^[0-9]{4}[A-Z]{2}$') OR
 *   (plate_number ~ '^[0-9]{3}[A-Z]{3}$') OR
 *   (plate_number ~ '^[0-9]{1,5}$') OR
 *   (plate_number ~ '^[0-9]{7}$')
 * )
 */

/**
 * Normalizes a plate string by removing whitespace, hyphens, and converting to uppercase.
 * Example: 'abc-1234' -> 'ABC1234', '123 abc' -> '123ABC', 'ab 1234' -> 'AB1234'
 */
export function normalizePlateNumber(plate?: string | null): string {
  if (!plate) return '';
  return plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase().trim();
}

/**
 * Regex enforcing the database check constraint for Philippine vehicle plates:
 * 1. Standard Motor Vehicles:
 *    - 3 Letters, 4 Numbers (ABC 1234)
 *    - 3 Letters, 3 Numbers (ABC 123)
 *    - 3 Letters, 2 Numbers (ABC 12 - Vanity / OMVSP)
 * 2. Motorcycles and Tricycles (MC/TC):
 *    - 2 Letters, 5 Numbers (AB 12345)
 *    - 2 Letters, 4 Numbers (AB 1234)
 *    - 4 Numbers, 2 Letters (1234 AB)
 * 3. Temporary Plates:
 *    - Conduction Stickers (AB 1234 - 2 letters, 4 numbers)
 * 4. Special and Protocol Plates:
 *    - Protocol Plates (1 to 17, e.g., 1 for President, 8 for Congressmen)
 *    - Diplomatic Plates (1000 to 99999)
 * 5. Legacy Series:
 *    - 3 Numbers, 3 Letters (123 ABC)
 *    - 7 Numbers (1234567)
 */
export const PH_PLATE_REGEX =
  /^(?:[A-Z]{3}[0-9]{2,4}|[A-Z]{2}[0-9]{4,5}|[0-9]{4}[A-Z]{2}|[0-9]{3}[A-Z]{3}|[0-9]{1,5}|[0-9]{7})$/;

/**
 * Checks whether a given plate string (with or without dashes/spaces) is valid.
 */
export function isValidPlateNumber(plate?: string | null): boolean {
  const norm = normalizePlateNumber(plate);
  return PH_PLATE_REGEX.test(norm);
}

/**
 * Friendly error message explaining accepted plate formats.
 */
export const PLATE_FORMAT_ERROR_MESSAGE =
  'Invalid license plate format. Accepted formats include standard plates (e.g., ABC-1234, ABC-123), motorcycles (e.g., AB-12345, AB-1234, 1234-AB), conduction stickers (e.g., AB-1234), protocol (1-17), or diplomatic plates.';

/**
 * Formats a normalized plate for clear, user-friendly display with hyphens.
 * Example:
 *  - 'ABC1234' -> 'ABC-1234'
 *  - 'ABC123'  -> 'ABC-123'
 *  - 'ABC12'   -> 'ABC-12'
 *  - 'AB12345' -> 'AB-12345'
 *  - 'AB1234'  -> 'AB-1234'
 *  - '1234AB'  -> '1234-AB'
 *  - '123ABC'  -> '123-ABC'
 *  - '1' or '8' or '1000' -> '1', '8', '1000'
 */
export function formatPlateDisplay(plate?: string | null): string {
  if (!plate) return '—';
  const norm = normalizePlateNumber(plate);
  if (/^[A-Z]{3}[0-9]{2,4}$/.test(norm)) {
    return `${norm.slice(0, 3)}-${norm.slice(3)}`;
  }
  if (/^[A-Z]{2}[0-9]{4,5}$/.test(norm)) {
    return `${norm.slice(0, 2)}-${norm.slice(2)}`;
  }
  if (/^[0-9]{4}[A-Z]{2}$/.test(norm)) {
    return `${norm.slice(0, 4)}-${norm.slice(4)}`;
  }
  if (/^[0-9]{3}[A-Z]{3}$/.test(norm)) {
    return `${norm.slice(0, 3)}-${norm.slice(3)}`;
  }
  return norm;
}
