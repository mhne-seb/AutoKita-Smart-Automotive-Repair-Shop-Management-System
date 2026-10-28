// Turns decimal hours (e.g. 1.5) into "1 h 30 min". Display only; stored values stay decimal.
export function formatHours(hours: number | string | null | undefined): string {
  const h = Number(hours)
  if (!Number.isFinite(h) || h <= 0) return '0 min'
  const totalMin = Math.round(h * 60)
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs > 0 && mins > 0) return `${hrs} h ${mins} min`
  if (hrs > 0) return `${hrs} h`
  return `${mins} min`
}
