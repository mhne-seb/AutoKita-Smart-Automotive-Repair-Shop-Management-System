// roadTest.ts — the shop's rule that every job is road-tested before it's
// handed back, in one place (same idea as diagnosticScan.ts / mechanicPolicy.ts).
//
// The road test is modelled as one more service_progress_tasks row, created
// by the system the moment the last service task is finished. It sits in the
// 'complete' section, costs nothing, and the job order can't reach
// 'completed' until it's finished — the server enforces that, not the UI.
export const ROAD_TEST_TITLE = 'Road Test'
export const ROAD_TEST_NOTE = 'Drive the vehicle to confirm the repairs hold up on the road before handing it back.'

export function isRoadTest(task: { title: string } | { task_title: string }): boolean {
  const title = 'title' in task ? task.title : task.task_title
  return title === ROAD_TEST_TITLE
}
