// Mock "what changed" field pool for the Admin Database Administration audit
// log detail view.

export const FIELD_POOL = [
  { field: 'Status', from: 'Pending', to: 'Approved' },
  { field: 'Total Cost', from: '₱45,000', to: '₱52,500' },
  { field: 'Assigned Mechanic', from: 'Unassigned', to: 'Jose S.' },
  { field: 'Balance Due', from: '₱12,000', to: '₱0' },
]
