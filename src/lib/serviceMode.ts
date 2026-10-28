// The check-in wording depends on how the customer is served:
// shop visit = the car comes to the shop; home service = the mechanic goes to the customer's address.
export type ServiceMode = 'shop' | 'home'

export function serviceModeFromDb(value: string | null | undefined): ServiceMode {
  return value === 'home_service' ? 'home' : 'shop'
}

export function arrivalWording(mode: ServiceMode) {
  if (mode === 'home') {
    return {
      button: 'Start home visit',
      busy: 'Starting…',
      notDone: 'Visit not started',
      done: 'Visit started',
      toast: 'Home visit started. The inspection is unlocked.',
      bannerTitle: 'Home Visit Not Started Yet',
      bannerText:
        "The mechanic goes to the customer's address. Press the button when the mechanic arrives there to unlock the inspection.",
      confirmTitle: 'Start the home visit?',
      confirmLabel: 'Start home visit',
      pill: 'Home Visit Started',
      confirmText: (customer: string, vehicle: string, plate: string) =>
        `Confirm that the mechanic has arrived at ${customer}'s address for the ${vehicle} (${plate}). This unlocks the inspection.`,
    }
  }
  return {
    button: 'Check In',
    busy: 'Checking In…',
    notDone: 'Not checked in',
    done: 'Checked in',
    toast: 'Vehicle marked as arrived and stored in the shop!',
    bannerTitle: 'Vehicle Not Checked In Yet',
    bannerText:
      'This job order is approved, but the vehicle has not yet been marked as arrived and stored in the shop. Click the button below once the vehicle is on-site to mark it as stored in the shop.',
    confirmTitle: 'Confirm vehicle arrival?',
    confirmLabel: 'Store in shop & check in',
    pill: 'Vehicle Checked In',
    confirmText: (customer: string, vehicle: string, plate: string) =>
      `Confirm that ${customer}'s ${vehicle} (${plate}) has arrived and is stored in the shop. This unlocks the inspection.`,
  }
}
