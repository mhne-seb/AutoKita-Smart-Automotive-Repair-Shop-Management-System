export const DEFAULT_MECHANIC_CAPACITY = 5

export function mechanicIsFull(openTasks: number, capacity: number = DEFAULT_MECHANIC_CAPACITY): boolean {
  return openTasks >= capacity
}
