// warrantyTerms.ts - the shop's written warranty terms, in ONE place.
// The job order PDF, its on-screen preview, the quotation page and the Warranties tab all read from here,
// so the wording can never differ between screens. The shop owner must approve this text.

// How many business days the shop takes to reply to a warranty claim. SHOP OWNER TO CONFIRM.
export const WARRANTY_RESPONSE_DAYS = 3

export type WarrantySection = { title: string; text?: string; bullets?: string[] }

export const WARRANTY_TERMS: WarrantySection[] = [
  {
    title: "What's covered",
    text: 'The parts we install and our workmanship on the services in this job order, for the period shown beside each item. The warranty starts on the day the vehicle is released.',
  },
  {
    title: "What we'll do",
    text: 'If a covered part fails or our work was faulty, we repair or replace it. Parts and labor are free for the rest of the warranty period.',
  },
  {
    title: "What's not covered",
    bullets: [
      'Damage from misuse, accidents, racing, or off-road use',
      'Repairs or changes made by another shop',
      'Normal wear and supplies, such as brake pads, bulbs, batteries, filters, and fluids',
      'Parts you supplied, and used parts unless written on this job order',
    ],
  },
  {
    title: 'How to make a claim',
    text: 'Open Service History, then Warranties, and select Report a Problem beside the part, or call the shop. Bring your vehicle in, or ask for Home Service. Our mechanic checks the part first, then approves the claim or explains why not.',
  },
  {
    title: 'How fast we respond',
    text: `We reply to your claim within ${WARRANTY_RESPONSE_DAYS} business days. A claim does not extend your warranty.`,
  },
]
