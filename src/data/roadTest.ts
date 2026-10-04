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
