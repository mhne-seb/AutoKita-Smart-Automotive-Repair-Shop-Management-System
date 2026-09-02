

const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

type BudgetEntry = {
  used: number;
  windowStart: number; 
};


declare global {
  
  var __tokenBudgetStore: Map<string, BudgetEntry> | undefined;
}

const store: Map<string, BudgetEntry> =
  global.__tokenBudgetStore ?? (global.__tokenBudgetStore = new Map());



const BUDGETS: Record<string, number> = {
  customer: parseInt(process.env.CHAT_TOKEN_BUDGET_CUSTOMER ?? '50000', 10),
  admin: parseInt(process.env.CHAT_TOKEN_BUDGET_ADMIN ?? '200000', 10),
};

export type Role = 'customer' | 'admin';

function key(ip: string, role: Role) {
  return `${ip}:${role}`;
}

function getEntry(ip: string, role: Role): BudgetEntry {
  const k = key(ip, role);
  const now = Date.now();
  let entry = store.get(k);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { used: 0, windowStart: now };
    store.set(k, entry);
  }
  return entry;
}


export function hasBudget(ip: string, role: Role): boolean {
  const entry = getEntry(ip, role);
  return entry.used < BUDGETS[role];
}


export function remaining(ip: string, role: Role): number {
  const entry = getEntry(ip, role);
  return Math.max(0, BUDGETS[role] - entry.used);
}

export function deduct(ip: string, role: Role, tokens: number): void {
  const entry = getEntry(ip, role);
  entry.used += tokens;
  store.set(key(ip, role), entry);
}
