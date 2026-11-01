# AutoKita — Detailed Change Documentation

> Every change is mapped to its exact file(s), the specific lines or patterns involved, and the precise modification to be made. This document is the ground truth for implementation.

---

## Change Index

| # | Title | Priority | Status |
|---|-------|----------|--------|
| [1](#1-inquiry-emails-never-sent-to-admin) | Inquiry emails never sent to admin | 🔴 Critical | ✅ Completed |
| [2](#2-otp-expires-immediately-after-sending) | OTP expires immediately after sending | 🔴 Critical | ✅ Completed |
| [3](#3-overview-page-shows-0-technicians) | Overview page shows 0 technicians | 🔴 Critical | ✅ Completed |
| [4](#4-inspection-report-accessible-before-vehicle-check-in) | Inspection report accessible before check-in | 🔴 Critical | ✅ Completed |
| [5](#5-scheduling-conflict-false-positive-with-lunch-break) | Scheduling conflict — lunch break false positive | 🔴 Critical | ✅ Completed |
| [6](#6-negative-financial-values-display-incorrectly) | Negative financial values display incorrectly | 🔴 Critical | ✅ Completed |
| [7](#7-mechanic-leave-history-lost-on-status-change) | Mechanic leave history lost on status change | 🔴 Critical | ✅ Completed |
| [8](#8-google-maps-location-update) | Google Maps location update | 🟡 Medium | ✅ Completed |
| [9](#9-password-eye-icon--live-requirements-checklist) | Password eye icon + live requirements checklist | 🟡 Medium | ✅ Completed |
| [10](#10-job-orders--queue-default-sort-newest-first) | Job orders/queue default sort: newest first | 🟡 Medium | ✅ Completed |
| [11](#11-obd-ii-limit-to-10-most-recent-emails) | OBD-II limit to 10 most recent emails | 🟡 Medium | ✅ Completed |
| [12](#12-schedule-job-modal--no-parts--shortest-first-preset-card) | Schedule Job modal — preset card for services without parts | 🟡 Medium | ✅ Completed |
| [13](#13-job-queue-filter-by-scheduled-date) | Job queue — filter by scheduled date | 🟡 Medium | ✅ Completed |
| [14](#14-notifications-only-show-on-full-job-completion) | Notifications — only on full job completion | 🟡 Medium | ✅ Completed |
| [15](#15-rename-parts-sold--profit-to-parts-sold-revenue) | Rename "Parts Sold & Profit" to "Parts Sold Revenue" | 🟢 Low | ✅ Completed |
| [16](#16-audit-logs-bold-employeeuser-name-consistently) | Audit logs — bold employee name consistently | 🟢 Low | ✅ Completed |
| [17](#17-quotation-page-grid-layout-fix) | Quotation page grid layout fix | 🟢 Low | ✅ Completed |

---

## 1. Inquiry Emails Never Sent to Admin

**Source:** PDF Page 1  
**Root Cause:** The contact form at `/contact` uses a `setTimeout` simulation (line 210) — it never calls any API. There is no backend route for contact form submissions.

### Files to Change

#### `app/(customer)/contact/page.tsx`

**Lines 207–218** — The `handleSubmit` function fakes a network call with `setTimeout`. Replace with a real `fetch` to a new API endpoint:

```diff
- setSubmitting(true)
- setTimeout(() => {
-   setSubmitting(false)
-   setSubmitted(true)
-   setName('')
-   setEmail('')
-   setMessage('')
-   setInquiry('General')
-   setErrors({})
- }, 900)
+ setSubmitting(true)
+ try {
+   const res = await fetch('/api/contact', {
+     method: 'POST',
+     headers: { 'Content-Type': 'application/json' },
+     body: JSON.stringify({ name, email, message, inquiry }),
+   })
+   if (!res.ok) throw new Error('Server error')
+   setSubmitted(true)
+   setName('')
+   setEmail('')
+   setMessage('')
+   setInquiry('General')
+   setErrors({})
+ } catch {
+   setErrors({ message: "Couldn't send your message. Please try again." })
+ } finally {
+   setSubmitting(false)
+ }
```

> **IMPORTANT:** Also change `function handleSubmit(e: React.FormEvent)` → `async function handleSubmit(e: React.FormEvent)` on line 197.

#### NEW FILE: `app/api/contact/route.ts`

Create a new API route that:
1. Validates the input fields
2. Calls `sendAdminContactEmail()` (to be added in `src/lib/mail.ts`) to send the submission to `proserv.autokita@gmail.com`
3. Returns `{ success: true }` or an error response

#### `src/lib/mail.ts`

Add a new export `sendAdminContactEmail({ name, email, message, inquiry })` that sends the inquiry to `proserv.autokita@gmail.com` using the existing nodemailer transporter.

---

## 2. OTP Expires Immediately After Sending

**Source:** PDF Page 4  
**Root Cause:** The current auth system uses a **link-based** reset (not 6-digit OTP). The `forgot-password` route at `app/api/auth/forgot-password/route.ts` sends a URL token via `createResetToken()`. The PDF refers to a 6-digit code flow — this must be either a separate OTP flow (e.g., for signup verification) or a token that is expiring due to a timezone/clock issue.

### Files to Investigate & Change

#### `app/api/auth/signup/request/route.ts`
- Locate OTP/code generation and DB insertion
- Check that `expires_at` is set to `NOW() + INTERVAL '10 minutes'` (not already expired)
- Confirm the DB query to store the OTP commits **before** the email is sent

#### `app/api/auth/signup/verify/route.ts`
- Check the expiry comparison: must use `NOW()` (server time), not client-supplied time
- Add a clear error message: `"Code has expired. Request a new one."`

#### `src/lib/passwordPolicy.ts` _(enhancement as part of Change #9)_
- Expand the current minimal policy (only checks length and email match) to add rules for uppercase, lowercase, digit, and special character — see [Change #9](#9-password-eye-icon--live-requirements-checklist)

---

## 3. Overview Page Shows 0 Technicians

**Source:** PDF Page 4  
**Root Cause:** The query fetching the technician count likely filters by a role string that doesn't match the actual stored value.

### Files to Change

#### `app/(admin)/overview/page.tsx` and/or `app/api/dashboard/` routes
- Find the query that counts technicians/mechanics
- Check that it filters by the correct DB role value (e.g., `'mechanic'`, `'technician'`, or integer role ID)
- Cross-reference with the `employees` or `users` table schema in `sql/`
- Fix the filter predicate to match the actual stored role value

---

## 4. Inspection Report Accessible Before Vehicle Check-In

**Source:** PDF Page 6  
**Root Cause:** The inspection page (`app/(admin)/job-orders/[id]/inspection/page.tsx`) loads and renders the full inspection form regardless of the job order's check-in status.

### Files to Change

#### `app/(admin)/job-orders/[id]/inspection/page.tsx`

The `jobOrder` state is fetched at line 41 via `getJobOrderById`. After it loads, add a guard before rendering the form:

```diff
// After jobOrder loads (around line 60+), add:
+ const isCheckedIn = jobOrder?.checkedIn === true || jobOrder?.status !== 'inspecting'
```

In the JSX, wrap the inspection form in a conditional:

```diff
+ {!isCheckedIn ? (
+   <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
+     <AlertCircle className="mx-auto mb-2 h-5 w-5" />
+     The vehicle must be checked in before an inspection report can be filed.
+   </div>
+ ) : (
    {/* existing inspection form JSX */}
+ )}
```

> **NOTE:** Check the exact field name for check-in status on `JobOrderCard` in `src/data/types.ts` — it may be `isCheckedIn`, `checked_in`, or derived from `status`.

#### `src/data/types.ts`
- Confirm the `JobOrderCard` type has a `checkedIn` / `isCheckedIn` boolean field. If not, add it and ensure the DB query in `src/controllers/jobOrderController.ts` selects it.

---

## 5. Scheduling Conflict — Lunch Break False Positive

**Source:** PDF Page 7  
**Root Cause:** Located in `src/lib/autoSchedule.ts`. When the conflict detection checks busy intervals widened by `TASK_GAP_MINUTES`, it may be incorrectly flagging a gap that straddles the lunch break as insufficient — because the `gapMs` extension on each busy interval overlaps into or past the lunch block without accounting for the break itself as a valid buffer.

### Files to Change

#### `src/lib/autoSchedule.ts`

**Lines 303–337** — The conflict-checking loop widens each busy interval by `gapMs` on both sides:
```typescript
const bStart = b.start - gapMs
const bEnd = b.end + gapMs
```

**The fix:** When `bEnd` falls within or past the lunch start, and the next task starts after the lunch end, the lunch break itself should satisfy the gap requirement. Add a check:

```diff
  if (Math.max(chunk.start, bStart) < Math.min(chunk.end, bEnd)) {
-   if (bEnd > conflictEnd) conflictEnd = bEnd
+   // If the only reason bEnd conflicts is that it extends into lunch break,
+   // and the proposed slot starts after lunch, treat lunch as the buffer.
+   const effectiveBEnd = (bEnd > lunchStartMs && chunk.start >= lunchEndMs)
+     ? Math.min(bEnd, lunchStartMs)
+     : bEnd
+   if (effectiveBEnd > conflictEnd) conflictEnd = effectiveBEnd
  }
```

> **WARNING:** The `lunchStartMs` and `lunchEndMs` variables are already computed at lines 273–274 in the same function scope. Ensure the fix is inserted within the same closure that has access to those variables.

---

## 6. Negative Financial Values Display Incorrectly

**Source:** PDF Page 9  
**Root Cause:** The sales/payroll page renders cost values without checking their sign.

### Files to Change

#### `app/(admin)/sales-payroll/page.tsx`

**Line 769 area** — The KPI card for parts renders:
```tsx
label="Parts Sold & Profit"
sub={`Cost: ${currency(kpi.partsAdminCost || 0)} · Profit: +${currency(kpi.partsProfit || 0)}`}
```

**Fix:** Remove the hardcoded `+` prefix and conditionally color negative values:

```diff
- sub={`Cost: ${currency(kpi.partsAdminCost || 0)} · Profit: +${currency(kpi.partsProfit || 0)}`}
+ sub={`Cost: ${currency(kpi.partsAdminCost || 0)} · Profit: ${(kpi.partsProfit || 0) >= 0 ? '+' : ''}${currency(kpi.partsProfit || 0)}`}
```

For the parts breakdown **table** rows (around line 650–700), wherever a `profit` or `cost` value is rendered:

```diff
- <td>{currency(p.profit)}</td>
+ <td className={(p.profit || 0) < 0 ? 'text-red-600 font-medium' : ''}>
+   {(p.profit || 0) < 0 ? `−${currency(Math.abs(p.profit))}` : currency(p.profit)}
+ </td>
```

Apply the same pattern to any other monetary cells that could be negative (net profit, admin cost deltas, etc.).

---

## 7. Mechanic Leave History Lost on Status Change

**Source:** PDF Page 10  
**Root Cause:** The mechanics API likely overwrites the availability status without logging the change. The mechanic history endpoint exists at `app/api/admin/mechanics/[id]/history/route.ts`.

### Files to Change

#### `app/api/admin/mechanics/[id]/history/route.ts`
- Verify this endpoint returns leave history across all statuses (past and current)
- Ensure the query does **not** filter out `on_leave` entries where the end date has passed
- If leave records are point-in-time (e.g., a `status_changes` log table), make sure past leave periods are included in the response regardless of current status

#### `app/(admin)/mechanics/page.tsx` (mechanic detail/calendar view)
- Find where the mechanic's schedule or availability is displayed
- Ensure the leave history section shows **all past leave periods** — not just the current status
- Add a "Leave History" accordion or section showing: start date, end date (or "ongoing"), and duration

#### `app/api/admin/mechanics/[id]/route.ts` (PATCH handler)
- When the status changes from `on_leave` → `available`, add an audit/history record logging the leave end date
- Do **not** delete or overwrite existing leave log entries

---

## 8. Google Maps Location Update

**Source:** PDF Page 2

### Files to Change

#### `app/(customer)/contact/page.tsx`

**Lines 10–12** — Replace the current address-based embed with the direct Place embed:

```diff
- const ADDRESS = "971-B Domingo Santiago St, Sampaloc, Manila, 1008 Metro Manila, Philippines"
- const MAPS_EMBED_SRC = `https://www.google.com/maps?q=${encodeURIComponent(ADDRESS)}&z=16&output=embed`
- const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ADDRESS)}`
+ const MAPS_EMBED_SRC = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3861....!2d120.9991714!3d14.6060199!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3397c9e516addab9%3A0xe606bd94dff46a95!2sPROSERV%20AUTOMOTIVE%20MECHANICAL%20SERVICES!5e0!3m2!1sen!2sph!4v...`
+ const MAPS_DIRECTIONS_URL = `https://www.google.com/maps/place/PROSERV+AUTOMOTIVE+MECHANICAL+SERVICES/@14.6060199,120.9991714,17z/data=!3m1!4b1!4m6!3m5!1s0x3397c9e516addab9:0xe606bd94dff46a95!8m2!3d14.6060148!4d121.0037795!16s%2Fg%2F11z22w95by`
```

> **TIP:** To get the proper `MAPS_EMBED_SRC`, open the PROSERV place in Google Maps → Share → Embed a map → copy the `src` value from the `<iframe>` tag. Use that URL directly.

Also update the address label in the overlay card:

**Line 390:**
```diff
- 971-B Domingo Santiago St., Sampaloc, Manila, 1008
+ 971 Domingo Santiago, Sampaloc, Manila, 1008
```

---

## 9. Password Eye Icon + Live Requirements Checklist

**Source:** PDF Pages 3–4  
**Scope:** All pages with password fields — reset-password, signup, setup, and any change-password modal.

### Files to Change

#### `src/lib/passwordPolicy.ts` — Expand rules

The current policy only checks length and email match. Add the new requirements:

```diff
- export const PASSWORD_MIN_LENGTH = 8
- export const PASSWORD_MAX_LENGTH = 72
- export const PASSWORD_RULE_TEXT = "Your password must be 8 to 72 characters..."
- export function passwordProblem(password, email?) { ... }

+ export const PASSWORD_RULES = {
+   minLength:   { label: 'At least 8 characters',                  test: (p: string) => p.length >= 8 },
+   uppercase:   { label: 'At least one uppercase letter (A–Z)',     test: (p: string) => /[A-Z]/.test(p) },
+   lowercase:   { label: 'At least one lowercase letter (a–z)',     test: (p: string) => /[a-z]/.test(p) },
+   digit:       { label: 'At least one numeric digit (0–9)',        test: (p: string) => /[0-9]/.test(p) },
+   special:     { label: 'At least one special symbol (!@#$%^&*)',  test: (p: string) => /[!@#$%^&*]/.test(p) },
+ } as const
+
+ export function passwordProblem(password: string, email?: string | null): string | null {
+   for (const rule of Object.values(PASSWORD_RULES)) {
+     if (!rule.test(password)) return `Missing: ${rule.label}`
+   }
+   if (password.length > 72) return 'Password cannot exceed 72 characters.'
+   if (email && password.toLowerCase() === email.trim().toLowerCase()) return 'Password cannot be your email address.'
+   return null
+ }
```

> **IMPORTANT:** Keep `PASSWORD_MIN_LENGTH`, `PASSWORD_MAX_LENGTH`, and the old `PASSWORD_RULE_TEXT` as exports or update all their consumers.

#### NEW FILE: `src/components/auth/PasswordInput.tsx`

Create a reusable component with:
- A password `<input>` that toggles between `type="password"` and `type="text"`
- An eye icon button (use `Eye` / `EyeOff` from `lucide-react`) positioned inside the input
- A `<PasswordChecklist>` rendered below the input when `showChecklist` prop is true
- Props: `value`, `onChange`, `autoComplete`, `showChecklist`, `className`

#### `app/reset-password/page.tsx`

**Lines 96–106** — Both password inputs (`pw` and `pw2`) currently use plain `<input type="password">`. Replace with the new `<PasswordInput>` component:

```diff
- <input type="password" autoComplete="new-password" value={pw}
-   onChange={(e) => { setPw(e.target.value); if (err) setErr('') }} className={inputClass} />
+ <PasswordInput value={pw} onChange={(e) => { setPw(e.target.value); if (err) setErr('') }}
+   autoComplete="new-password" showChecklist />

- <input type="password" autoComplete="new-password" value={pw2}
-   onChange={(e) => { setPw2(e.target.value); if (err) setErr('') }} className={inputClass} />
+ <PasswordInput value={pw2} onChange={(e) => { setPw2(e.target.value); if (err) setErr('') }}
+   autoComplete="new-password" showChecklist />
```

Also remove the static `PASSWORD_RULE_TEXT` paragraph (line 99) since the live checklist replaces it.

#### `app/signup/page.tsx`
- Find the password input field and replace with `<PasswordInput showChecklist />`

#### `app/setup/page.tsx` (if it contains a password field)
- Same replacement

---

## 10. Job Orders / Queue Default Sort: Newest First

**Source:** PDF Page 5

### Files to Change

#### `app/(admin)/job-orders/page.tsx`

**Line 74** — The fetch call `getJobOrders(1, 1000000)` retrieves all records. The default sort on the result must be newest first.

Find where `jobOrders` is used to render cards (via `useMemo` or direct `.filter()/.sort()` chain) and add/confirm a descending sort by `created_at` or `jo_date`:

```diff
+ .sort((a, b) => new Date(b.jo_date ?? b.createdAt ?? 0).getTime()
+               - new Date(a.jo_date ?? a.createdAt ?? 0).getTime())
```

Alternatively, update the API query in `src/controllers/jobOrderController.ts` to `ORDER BY jo_date DESC` by default.

#### `app/(admin)/job-queue/page.tsx`
- Apply the same default descending sort to the job queue list

---

## 11. OBD-II Limit to 10 Most Recent Emails

**Source:** PDF Page 5

### Files to Change

#### `Email_parser/gmail_fetcher.py` (Python ML server)

The `POST /gmail/sync` endpoint (called by `app/api/diagnostics/sync-gmail/route.ts`) fetches emails. Find the Gmail API call and add a `maxResults=10` parameter:

```python
# Before:
messages = service.users().messages().list(userId='me', ...).execute()

# After:
messages = service.users().messages().list(userId='me', ..., maxResults=10).execute()
```

#### UI Component — `app/(admin)/job-orders/[id]/inspection/page.tsx`

Find the Gmail sync trigger button and add a note beneath it:

```diff
+ <p className="mt-1 text-xs text-muted-foreground">
+   Only the 10 most recent emails are checked for OBD-II reports.
+ </p>
```

---

## 12. Schedule Job Modal — "No parts / shortest first" Preset Card

**Source:** PDF Page 6 (Clarified by user: add preset button/card in the Schedule Job modal next to "Maintenance / short first", reordering services so that services with no parts run first sorted by duration shortest to longest, followed by services with parts sorted shortest to longest).

### Files to Change

#### `src/lib/autoSchedule.ts`

Add sorting helper:
```typescript
export function sortNoPartsShortestFirst<
  T extends { hours: number; hasParts?: boolean; blockedBy?: string | null },
>(tasks: T[]): T[] {
  return tasks
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      const aHasParts = Boolean(a.task.hasParts || a.task.blockedBy) ? 1 : 0
      const bHasParts = Boolean(b.task.hasParts || b.task.blockedBy) ? 1 : 0
      return aHasParts - bHasParts || a.task.hours - b.task.hours || a.index - b.index
    })
    .map((entry) => entry.task)
}
```

#### `app/api/job-orders/[id]/progress/suggest-schedule/route.ts`

Expose `hasParts: matchingParts.length > 0` on tasks passed to the planning modal.

#### `src/components/admin/ScheduleJobModal.tsx`

Add the preset button next to "Maintenance / short first":
```tsx
<button
  type="button"
  onClick={() => {
    if (data?.planning) {
      setOrder(sortNoPartsShortestFirst(data.planning.tasks).map((t) => t.id))
    }
  }}
  title="Shortest service with no parts to longest service with no parts, then shortest service with parts to longest service with parts"
  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
>
  No parts / shortest first
</button>
```

---

## 13. Job Queue — Filter by Scheduled Date

**Source:** PDF Page 7

### Files to Change

#### `app/(admin)/job-queue/page.tsx`

Add a sort toggle button next to the existing controls:

```tsx
const [sortByDate, setSortByDate] = useState(false)

const sortedQueue = sortByDate
  ? [...jobQueue].sort((a, b) =>
      new Date(a.scheduledDate ?? 0).getTime() - new Date(b.scheduledDate ?? 0).getTime()
    )
  : jobQueue
```

Add the toggle button in the toolbar:

```tsx
<button
  onClick={() => setSortByDate(v => !v)}
  className={`rounded-md border px-3 py-1.5 text-sm ${sortByDate ? 'bg-brand text-white' : 'bg-card'}`}
>
  <Calendar className="mr-1.5 inline h-3.5 w-3.5" />
  {sortByDate ? 'Sorted by Date ✓' : 'Sort by Scheduled Date'}
</button>
```

---

## 14. Notifications — Only Show on Full Job Completion

**Source:** PDF Page 8  
**Root Cause:** `notifyCustomer()` is called from multiple API routes for individual task events. These need to be suppressed; only the billing/completion trigger should remain.

### Files Involved (from codebase scan)

The `notifyCustomer` function is defined in `src/lib/customerNotify.ts` and called from:

| File | Action |
|------|--------|
| `app/api/job-orders/[id]/billing/route.ts` | ✅ Keep — this is job completion |
| `app/api/job-orders/[id]/parts/route.ts` | ❌ Remove — parts arrived notification |
| `app/api/job-orders/[id]/progress/schedule/route.ts` | ❌ Remove — service scheduled notification |
| `app/api/job-orders/[id]/road-test/route.ts` | ❌ Remove — road test started/completed |
| `app/api/job-orders/[id]/scan-authorization/route.ts` | 🔍 Review — may be kept if user-initiated |
| `app/api/job-orders/[id]/service-findings/route.ts` | 🔍 Review — keep if customer approval needed |
| `app/api/job-orders/[id]/warranty-claim/route.ts` | 🔍 Review — keep if customer needs to know |
| `app/api/tracking/.../scan-authorization/route.ts` | 🔍 Review |

**For each file marked ❌:** Find the `notifyCustomer({...})` call and remove or comment it out.

> **CAUTION:** Do **not** remove `notifyCustomer` calls that are tied to customer-approval flows (pre-diagnostics approval, service findings approval). Those are necessary for the customer to act. Only remove calls for internal shop events (task started, task finished, parts arrived).

---

## 15. Rename "Parts Sold & Profit" to "Parts Sold Revenue"

**Source:** PDF Page 9

### Files to Change

#### `app/(admin)/sales-payroll/page.tsx`

| Line | Current Text | New Text |
|------|-------------|----------|
| 43 | `'Parts Sold & Profit Breakdown'` (tab label) | `'Parts Sold Revenue'` |
| 608 | `// ---------- Parts Sold & Profit Breakdown: search ...` (comment) | `// ---------- Parts Sold Revenue: search ...` |
| 769 | `label="Parts Sold & Profit"` | `label="Parts Sold Revenue"` |

Run a search for `"parts sold"` (case-insensitive) across the entire codebase to catch any additional instances.

---

## 16. Audit Logs — Bold Employee/User Name Consistently

**Source:** PDF Page 10  
**Root Cause:** The `ServiceHistory` component in `src/components/admin/ServiceHistory.tsx` (which powers `/history`) only bolds the employee name for ticket acceptance, not all log types.

### Files to Change

#### `src/components/admin/ServiceHistory.tsx`

Find where audit log entries render the employee/user name. Currently it might look like:
```tsx
<span>{log.employeeName}</span>
```

Change all such renders to:
```tsx
<strong className="font-semibold">{log.employeeName}</strong>
```

Ensure this wrapping applies uniformly to **every** row type in the log table — not conditionally. The name should always be bold regardless of the action type.

#### `app/api/admin/history/route.ts` (if needed)
- Confirm the API response always includes the `employeeName` (or `first_name` + `last_name`) field in every row, not just accepted-ticket rows

---

## 17. Quotation Page Grid Layout Fix

**Source:** PDF Page 10 (explicit line numbers provided)

### File to Change

#### `app/(admin)/job-orders/[id]/quotation/page.tsx`

**Line 686** — Current:
```tsx
<div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 xl:grid-cols-7 sm:gap-6 items-start">
```
**Issue:** `xl:grid-cols-7` is an unusual column count. Verify whether this should be `xl:grid-cols-6` or another value for the quotation summary layout.  
**Action:** Inspect visually at XL breakpoint and adjust to the correct column count.

**Line 726** — Current:
```tsx
<div className="col-span-2 sm:col-span-2 xl:col-span-1 text-left sm:text-right">
```
**Issue:** `xl:col-span-1` may be too narrow within a 7-column grid, causing text alignment issues.  
**Action:** Adjust `xl:col-span-1` to the appropriate span (likely `xl:col-span-2` or `xl:col-span-3`) so the column is legible and aligns correctly.

---

## Implementation Notes

### Recommended Order

1. **#15, #17** — Pure text/style changes, zero risk
2. **#8, #10, #13** — Simple data/URL swaps
3. **#9** — Build reusable `<PasswordInput>` first, then apply everywhere
4. **#14** — Carefully audit each `notifyCustomer` callsite before removing
5. **#1, #3, #4, #6, #16** — Moderate logic changes
6. **#5, #7** — Complex logic requiring careful testing
7. **#2, #11, #12** — Require coordination with Python/ML server or DB schema

> **WARNING:** Changes #5 (scheduling conflict) and #7 (mechanic leave history) involve business-critical data. Test thoroughly against real job order data before deploying.

