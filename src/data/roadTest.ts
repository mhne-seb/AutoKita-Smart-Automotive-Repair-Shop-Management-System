// roadTest.ts — the shop's rule that every job is road-tested before it's
// handed back, in one place (same idea as diagnosticScan.ts / mechanicPolicy.ts).
//
// The road test is its own stage (Testing), backed by the road_tests table
// and Jubert's start_road_test / pass_road_test / fail_road_test functions:
//   in_progress --start--> testing --pass--> completed
//                                  --fail--> in_progress (ticked tasks reopen)
// Older job orders modelled it as a service_progress_tasks row titled
// "Road Test"; isRoadTest() still recognises those so they don't count as
// services.
export const ROAD_TEST_TITLE = 'Road Test'
export const ROAD_TEST_NOTE = 'Drive the vehicle to confirm the repairs hold up on the road before handing it back.'

export function isRoadTest(task: { title: string } | { task_title: string }): boolean {
  const title = 'title' in task ? task.title : task.task_title
  return title === ROAD_TEST_TITLE
}

// What the admin sees per attempt (get_road_test_history), already shaped
// for the page. Shared with the customer's Testing page.
export interface RoadTestAttempt {
  id: number
  attemptNo: number
  testerName: string
  startedAt: string
  endedAt: string | null
  result: 'pass' | 'fail' | null // null = still out on the road
  notes: string | null
  photoUrl: string | null
  reworkTaskIds: number[]
  reworkTaskTitles: string[]
  failedPartIds: number[]
  failedPartNames: string[]
}
