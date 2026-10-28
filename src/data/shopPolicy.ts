// The scheduler's rules in one place. Change a number here, not in the code that uses it.
// Opening hours, closing time and the safety margin are NOT here: they live in src/lib/bookingTiming.ts
// so the booking page and the scheduler always agree.
export const TASK_GAP_MINUTES = 15       // same gap the schedule route enforces between tasks
export const SLOT_STEP_MINUTES = 15      // suggested start times fall on quarter hours
export const DEFAULT_TASK_HOURS = 1.5    // same default the progress route uses
export const MAX_MECHANICS_ON_CAR = 2    // most different mechanics working on one car at the same time
export const SHOP_LUNCH_START_HOUR = 12  // 12:00 PM - Start of mandatory lunch break
export const SHOP_LUNCH_END_HOUR = 13    // 1:00 PM - End of mandatory lunch break

