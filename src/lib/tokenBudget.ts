// src/lib/tokenBudget.ts
// ---------------------------------------------------------------------------
// Multi-Tier Token Budget & Malicious Bot Fast-Rate Failsafe System
//
// Defends against two distinct attack vectors:
// 1. Long-term Daily Exhaustion: 24-hour token budget limit per IP/role (50k for customers, 200k for admin).
// 2. High-Frequency Fast-Rate Bot Attacks:
//    - Burst Throttling: Max 5 requests per 10 seconds.
//    - Rapid-Fire Spacing: Minimum 1.0s gap between consecutive requests.
//    - Active In-Flight Concurrency Lock: Max 1 active in-flight LLM call per IP at a time (stops parallel burst floods).
//    - Penalty Lockout: 60-second cooldown lock if rapid spamming continues.
// ---------------------------------------------------------------------------

const DAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const BURST_WINDOW_MS = 10 * 1000;         // 10 seconds
const MAX_BURST_REQUESTS = 5;              // Max 5 queries within 10 seconds
const MIN_REQUEST_INTERVAL_MS = 1000;      // Minimum 1 second between consecutive messages
const PENALTY_LOCK_MS = 60 * 1000;         // 60-second temporary lockout for aggressive spamming
// Safety timeout: if a request has been in-flight for longer than this,
// it is considered leaked (hot-reload, crash, etc.) and will be auto-cleared.
const IN_FLIGHT_MAX_AGE_MS = 120 * 1000;   // 120 seconds

type BudgetEntry = {
  used: number;
  windowStart: number;
  // Fast-rate bot defense tracking
  recentTimestamps: number[];
  lastRequestTime: number;
  inFlight: number;
  lockedUntil: number;
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

  if (!entry || now - entry.windowStart > DAY_WINDOW_MS) {
    entry = {
      used: 0,
      windowStart: now,
      recentTimestamps: [],
      lastRequestTime: 0,
      inFlight: 0,
      lockedUntil: 0,
    };
    store.set(k, entry);
  }
  // Safety valve: if inFlight is stuck (> 0 for too long), auto-heal it.
  // This handles hot-reloads, unhandled exceptions, and server restarts
  // where recordRequestEnd was never called.
  if (entry.inFlight > 0 && entry.lastRequestTime > 0 && Date.now() - entry.lastRequestTime > IN_FLIGHT_MAX_AGE_MS) {
    entry.inFlight = 0;
    store.set(k, entry);
  }

  return entry;
}

/**
 * Validates whether the incoming IP is allowed to proceed, checking:
 * 1. Temporary penalty lockout
 * 2. Active in-flight concurrency (prevents parallel burst race conditions)
 * 3. Rapid-fire interval threshold (< 1.0s gap)
 * 4. 10-second burst volume threshold (max 5 requests per 10s)
 * 5. Daily token budget quota (50k customer, 200k admin)
 */
export function checkRateLimit(ip: string, role: Role): {
  allowed: boolean;
  reason?: string;
  retryAfterSeconds?: number;
} {
  const entry = getEntry(ip, role);
  const now = Date.now();

  // 1. Check temporary lockout from previous spam violations
  if (entry.lockedUntil > now) {
    const remainingSec = Math.ceil((entry.lockedUntil - now) / 1000);
    return {
      allowed: false,
      reason: `Too many rapid requests. Automated bot protection active. Please wait ${remainingSec} seconds.`,
      retryAfterSeconds: remainingSec,
    };
  }

  // 2. Check in-flight concurrency (bot sending 20 simultaneous async requests)
  const maxInFlight = role === 'admin' ? 3 : 1;
  if (entry.inFlight >= maxInFlight) {
    return {
      allowed: false,
      reason: 'Please wait for your previous message to finish generating before sending another.',
      retryAfterSeconds: 2,
    };
  }

  // 3. Check rapid-fire interval (< 1.0 second between consecutive requests)
  if (role === 'customer' && entry.lastRequestTime > 0 && now - entry.lastRequestTime < MIN_REQUEST_INTERVAL_MS) {
    return {
      allowed: false,
      reason: 'You are sending messages too quickly. Please wait a moment.',
      retryAfterSeconds: 1,
    };
  }

  // 4. Check burst window (clean up timestamps older than 10 seconds)
  entry.recentTimestamps = entry.recentTimestamps.filter((ts) => now - ts < BURST_WINDOW_MS);
  if (entry.recentTimestamps.length >= MAX_BURST_REQUESTS) {
    // Escalate to temporary 60-second cooldown penalty
    entry.lockedUntil = now + PENALTY_LOCK_MS;
    store.set(key(ip, role), entry);
    return {
      allowed: false,
      reason: `Rapid request threshold exceeded (max ${MAX_BURST_REQUESTS} requests per 10s). Cooldown active for 60 seconds.`,
      retryAfterSeconds: 60,
    };
  }

  // 5. Check daily total token budget
  if (entry.used >= BUDGETS[role]) {
    return {
      allowed: false,
      reason: "You've reached your daily chat limit. Please try again tomorrow.",
      retryAfterSeconds: Math.ceil((entry.windowStart + DAY_WINDOW_MS - now) / 1000),
    };
  }

  return { allowed: true };
}

/**
 * Increments active in-flight counter when a request begins processing.
 */
export function recordRequestStart(ip: string, role: Role): void {
  const entry = getEntry(ip, role);
  const now = Date.now();
  entry.inFlight = Math.max(0, entry.inFlight + 1);
  entry.lastRequestTime = now;
  entry.recentTimestamps.push(now);
  store.set(key(ip, role), entry);
}

/**
 * Decrements in-flight counter and deducts the actual tokens consumed.
 */
export function recordRequestEnd(ip: string, role: Role, tokensUsed: number): void {
  const entry = getEntry(ip, role);
  entry.inFlight = Math.max(0, entry.inFlight - 1);
  if (tokensUsed > 0) {
    entry.used += tokensUsed;
  }
  store.set(key(ip, role), entry);
}

// ─── Legacy Backward-Compatible Helpers ─────────────────────────────────────
export function hasBudget(ip: string, role: Role): boolean {
  const entry = getEntry(ip, role);
  return entry.used < BUDGETS[role] && entry.lockedUntil <= Date.now();
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
