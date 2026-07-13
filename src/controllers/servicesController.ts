// servicesController — wraps src/data/services.ts (the public Services
// catalog)
export { groups, getGroupByCode, type ServiceGroup, type ServiceItem } from '@/data/services'
import { groups as _groups, getGroupByCode as _getGroupByCode } from '@/data/services'

function simulateDelay<T>(value: T, ms = 200): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

export async function getServiceGroups() {
  return simulateDelay(_groups)
}

export async function getServiceGroupByCode(code: string) {
  return simulateDelay(_getGroupByCode(code) ?? null)
}
