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