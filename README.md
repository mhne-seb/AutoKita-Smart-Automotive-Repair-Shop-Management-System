# AutoKita — Capstone (Next.js Edition)

AutoKita is an automotive repair-shop management system with two connected
frontends — a **Customer** portal (booking, tracking, billing) and an
**Admin** dashboard (job orders, inspections, quotations, analytics,
mechanics, sales & payroll) — built entirely on mock/dummy data, ready to be
wired to a real backend later.

This version has been migrated from Vite + TanStack Start/Router to
**Next.js (App Router)**, per the project requirements.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for styling
- **shadcn/ui** (Radix primitives) for base UI components
- **jsPDF** for PDF invoice generation (with the AutoKita logo)
- **ExcelJS** for Excel report exports (with the AutoKita logo)
- **Recharts** for analytics charts
- **Lucide** icons

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Demo accounts (unified login)

There is a single login page at `/login`. It looks the entered credentials
up against `src/data/users.ts` and automatically redirects based on role:

| Role     | Email                  | Password      | Redirects to |
|----------|-------------------------|----------------|--------------|
| Customer | customer@autocare.com  | password       | `/dashboard` |
| Admin    | admin@autokita.com     | autokita2026   | `/overview`  |

## Project structure

```
app/                        Next.js App Router routes
  layout.tsx                 Root layout (fonts, metadata, <html>/<body>)
  not-found.tsx / error.tsx  Global 404 / error boundary
  login/page.tsx              Unified Customer + Admin login (role auto-detect)
  services/                   Public "Services" pages
  (customer)/                 Route group — pathless, adds no URL segment
    page.tsx                    Home ("/")
    about/, book/, contact/, booking-confirmed/
    dashboard/                  Customer dashboard (auth-gated layout)
      layout.tsx                 DashHeader + ChatWidget + mock auth guard
      page.tsx, billing/, history/, profile/, register-vehicle/
      tracking/                  Per-stage tracking pages
  (admin)/                    Route group — pathless, adds no URL segment
    layout.tsx                  Sidebar shell (AdminLayout) + mock auth guard
    overview/, analytics/, job-queue/, job-orders/, history/,
    mechanics/, sales-payroll/, database/

src/
  components/                Shared UI (site header/footer, dashboard chrome,
                              shadcn/ui primitives in components/ui/)
  layouts/AdminLayout.tsx    Sidebar + topbar shell for the Admin group
  pages/                     The actual screen implementations for Admin
                              routes (Overview, JobOrders, Analytics, ...).
                              app/(admin)/**/page.tsx files are thin wrappers
                              that render these.
  data/                      ALL mock/dummy data lives here, never inline in
                              components (types.ts, mockData.ts, jobOrders.ts,
                              quotations.ts, inspections.ts, serviceProgress.ts,
                              billings.ts, historylogs.ts, services.ts, users.ts)
  controllers/                Mock "API layer" — see below
  hooks/, lib/                Small utilities (cn(), useScrolled, useIsMobile)

public/
  assets/                    Images (was src/assets under Vite)
  autokita-logo.png          Company logo, used in the UI, PDF & Excel exports
```

## Controllers (mock API layer)

`src/controllers/*.ts` sit between pages and `src/data/*.ts`. Every function
is `async` and resolves after a short simulated delay, so pages already call
them the way they'd call a real API:

```ts
import { getJobOrders } from '@/controllers/jobOrderController'

const orders = await getJobOrders() // later: fetch('/api/job-orders')
```

Available controllers (barrel-exported from `src/controllers/index.ts`):
`authController`, `jobOrderController`, `customerController`,
`bookingController`, `quotationController`, `mechanicController`,
`billingController`, `reportController`, `historyController`,
`databaseController`, `inspectionController`, `serviceProgressController`,
`servicesController`.

**Every page that reads transactional mock data now goes through a
controller** instead of importing `src/data/*.ts` directly — Overview,
JobOrders, JobOrderDetail, InspectionReport, Quotation, ServiceProgress,
JobQueue, MechanicsManagement, SalesPayroll, HistoryLogs,
DatabaseAdministration, Analytics, the Customer dashboard, and the Customer
Billing/History pages. A few pages that do heavy *synchronous* filtering in
`useMemo` (HistoryLogs, DatabaseAdministration) use a controller that
re-exports the data array directly rather than an async-wrapped version —
still a single seam to swap for a real fetch, just without an artificial
await for data that's filtered on every keystroke. Small, page-specific
config lists that used to live inside components (form dropdown options,
avatar palettes, seed presets) were also extracted into their own files
under `src/data/`.

**Connecting a real backend later:** keep each function's signature the
same and swap its body for a `fetch(...)` call — nothing in the UI needs to
change.

## How the Customer and Admin sides stay connected

Both sides ultimately read from the same in-memory arrays in `src/data/*.ts`
(imported once, shared as JS module singletons for the life of the browser
tab). `jobOrderController` is the clearest example:

- Admin pages call **write** functions when they act on a job order —
  `advanceJobOrderStage()` (Inspection → Quotation → In Progress → Completed)
  and `assignMechanicToJobOrder()`. These mutate the shared `jobOrders` array
  in place.
- The Customer dashboard (`app/(customer)/dashboard/page.tsx`) calls
  `getJobOrders(customerId)` on load and renders a live card per vehicle —
  so advancing a job order on the Admin side (e.g. clicking "Continue to
  Quotation" on the Inspection Report, or finishing every checklist item on
  Service Progress) is reflected on the Customer dashboard the next time it
  renders, in the same browser session.
- `Overview`'s row actions ("Mark Complete" / "Cancel Order") similarly call
  `customerController.updateCustomerStatus()`, a real write, not a stub.

This only persists for the current browser session (it resets on a full
page reload) since there's no database yet — that's expected for a
frontend-only mock data layer, and is the seam a real backend replaces.

## Authentication (mock)

There's no real backend yet, so "auth" is a `sessionStorage` flag:

- `app/login/page.tsx` calls `controllers/authController.login()`, which
  checks credentials against `src/data/users.ts` and returns a `role`.
- On success, `startSession(role)` sets `autokita_customer` or
  `autokita_admin` in `sessionStorage`, then the page redirects.
- `app/(customer)/dashboard/layout.tsx` and `app/(admin)/layout.tsx` each
  check their respective flag on mount and redirect back to `/login` if it's
  missing — this is what gate-keeps the two dashboards.

Swap this for real session cookies / JWT once the backend exists.

## PDF & Excel exports

- **PDF invoices** — `app/(customer)/dashboard/history/page.tsx` →
  `generateInvoicePDF()`. Builds an A4 invoice with the AutoKita logo
  (loaded from `/autokita-logo.png`), shop details, an itemized table, and
  totals.
- **Excel churn report** — `src/pages/Analytics.tsx` →
  `buildChurnReportWorkbook()`. Embeds the AutoKita logo in the header band,
  styled column headers, autofilter, status-colored cells, and zebra-striped
  rows.

## Notes on this migration

- Every former TanStack Router page (`src/routes/**`) has a matching
  Next.js page under `app/**`. Route groups `(customer)` and `(admin)` are
  pathless in Next.js too, so URLs are unchanged (e.g. `/overview`,
  `/job-orders/[id]/inspection`).
- Components that need browser APIs/hooks are marked `'use client'`;
  purely presentational pages (e.g. `/services`) are left as server
  components with `export const metadata` for SEO.
- This is still a **frontend-only** app — no server actions, API routes, or
  database calls are wired up, by design (Requirement 11). All controllers
  simulate latency but read from local mock data.
