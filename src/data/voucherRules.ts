// voucherRules.ts - the offers the shop can send, in ONE place.
// The Send Offer screen, the offer route and the Billing "apply voucher" route all read from here.
// A voucher lowers the labor price of ONE service on the job order: the most expensive
// service on it that appears in the rule's `services` list.

export type VoucherRuleKey = 'SCAN10' | 'OILFREE' | 'BRAKE200' | 'PMS10'

export interface VoucherRule {
  key: VoucherRuleKey
  label: string        // short name shown to the admin and the customer
  description: string  // one plain sentence
  services: string[]   // exact names from the services table this voucher can be used on
  kind: 'percent' | 'fixed'
  value: number        // percent (1-100) or pesos
  cap: number | null   // the most pesos a percent voucher can take off, or null for no cap
  offerType: 'percentage_discount' | 'fixed_discount' | 'free_service' // promo_offer_type in the database
}

export const VOUCHER_RULES: Record<VoucherRuleKey, VoucherRule> = {
  SCAN10: {
    key: 'SCAN10',
    label: '10% off the diagnostic scan',
    description: 'Takes 10% off one diagnostic scan.',
    services: ['OBD-II Diagnostic Scan', 'Engine Diagnostics & Electrical Scan'],
    kind: 'percent', value: 10, cap: null,
    offerType: 'percentage_discount',
  },
  OILFREE: {
    key: 'OILFREE',
    label: 'Free labor on an oil change',
    description: 'The oil change labor is free. You still pay for the oil and filter.',
    services: ['Change Oil'],
    kind: 'percent', value: 100, cap: null,
    offerType: 'free_service',
  },
  BRAKE200: {
    key: 'BRAKE200',
    label: '₱200 off brake cleaning',
    description: 'Takes ₱200 off the labor for Brake Service & Cleaning.',
    services: ['Brake Service & Cleaning'],
    kind: 'fixed', value: 200, cap: null,
    offerType: 'fixed_discount',
  },
  PMS10: {
    key: 'PMS10',
    label: '10% off maintenance labor',
    description: 'Takes 10% off the labor of one maintenance service, up to ₱500.',
    services: [
      'Change Oil',
      'Change ATF / Transmission Fluid',
      'Coolant Flush',
      'Replace Air Filter',
      'Replace Cabin Filter',
      'Replace Fuel Filter',
      'Replace Spark Plugs',
      'Fuel Injector Cleaning / Service',
      'Throttle Body Cleaning',
      'Brake Service & Cleaning',
      'Tire Rotation & Balancing',
      'Wheel Alignment',
      'Wheel Balancing',
      'Air Conditioning Cleaning & Freon Charge',
      'General Mechanical Inspection & Check-Up',
    ],
    kind: 'percent', value: 10, cap: 500,
    offerType: 'percentage_discount',
  },
}

export function getVoucherRule(key: string | null | undefined): VoucherRule | null {
  return key && key in VOUCHER_RULES ? VOUCHER_RULES[key as VoucherRuleKey] : null
}

// How many pesos a voucher takes off a service whose labor price is `labor`.
// Never more than the cap, and never more than the labor price itself.
export function voucherDiscount(rule: VoucherRule, labor: number): number {
  const raw = rule.kind === 'percent' ? (labor * rule.value) / 100 : rule.value
  const capped = rule.cap != null ? Math.min(raw, rule.cap) : raw
  return Math.round(Math.min(capped, labor) * 100) / 100
}

// The code the customer types: letters, digits and dashes only.
export const VOUCHER_CODE_PATTERN = /^[A-Za-z0-9-]{4,30}$/
