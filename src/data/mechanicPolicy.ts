// mechanicPolicy.ts — the shop's rule for how much one mechanic can hold,
// in one place (same idea as diagnosticScan.ts).
//
// A mechanic can be assigned at most `jobs_capacity` OPEN tasks at once —
// tasks assigned to them and not yet finished, regardless of date or size.
// Finishing a task frees a slot. Unassigned tasks don't count against anyone.
//
// The per-mechanic number lives in employee_profiles.jobs_capacity (set on
// the Mechanics page). This constant is the fallback for a mechanic with no
// profile row yet.
//
// Team decision (Jubert): keep a hard limit for the capstone. A real talyer
// does overload its 1-2 head mechanics; that's a known simplification.
export const DEFAULT_MECHANIC_CAPACITY = 5

export function mechanicIsFull(openTasks: number, capacity: number = DEFAULT_MECHANIC_CAPACITY): boolean {
  return openTasks >= capacity
}
