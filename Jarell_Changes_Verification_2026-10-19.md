# Jarell changes: what we applied and how to confirm them (2026-10-19)

Source: `origin/develop` commits d745ce1, 60c6fc4, b04a5c2, merged into `review/new-develop`.
Jarell was asleep, so conflicts were resolved by taking his side. Confirm with him later.

## 1. How the conflicts were resolved
- Whole file from Jarell: `job-orders/page.tsx` and `job-queue/page.tsx` (a per-hunk merge left broken JSX).
- His side per hunk: inspection page, tracking quotation page and route, `jobOrderController.ts`, `types.ts`, `api/job-orders/route.ts`.
- Kept from our branch so the code still compiles and loads: `serviceMode`, `homeAddress`, `readyBy`, `queueNo`, `request` on the job order type and controller; `queue_no`, `service_mode`, `customer_concern` in the job-orders query (with the matching GROUP BY / ORDER BY); `service_mode` on the tracking quotation.

## 2. Lost from our branch (decide whether to bring back)
- Job orders page: expandable table, Priority by check-in order, readable request list, new approve pop-up, scan notice, home-visit wording (commits 992f232, 4789d24).
- Job queue: tab reorder, mechanic assignment removal, required cancel reason (7193b1f). His version has mechanic assignment and the feasibility modal.
- The data (queueNo, request, readyBy) is still loaded, but his pages do not show it.
- Recover a file with: `git show 4789d24:"app/(admin)/job-orders/page.tsx"`.

## 3. Database (dry run first)
1. Run `sql/Other/migration_jarell_scheduling_columns.sql`. It adds `service_tickets.booked_service_ids`, adds `job_order_parts.estimated_delivery_date`, and replaces `get_mechanics_list()`.
2. Rollback if needed: `sql/Other/migration_jarell_scheduling_columns_rollback.sql` (roll the code back first).

Confirm after running:
```sql
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE (table_name='service_tickets' AND column_name='booked_service_ids')
   OR (table_name='job_order_parts' AND column_name='estimated_delivery_date');
-- expect 2 rows: ARRAY and date
SELECT count(*) FROM get_mechanics_list() WHERE status::text = 'terminated';  -- expect 0
```
Deploy order: migration first, then the code on Vercel. Code first means bookings and quotation saves fail.

## 4. Check on the live site
| # | Do this | Expect |
|---|---|---|
| 1 | Book with 2 services | Booking saves; `booked_service_ids` has both ids |
| 2 | Open that job order's Quotation | Both services pre-filled; no duplicates after reload |
| 3 | Save a quotation with a to-order part and delivery date | Saves; customer tracking shows the date and the promised date |
| 4 | Booking calendar, a day with tasks after 4 PM | Day is not shifted to the next day (see 5.1) |
| 5 | Job queue: assign a mechanic who is on leave | Blocked with a message |
| 6 | Sales and payroll | Parts cards load; terminated staff hidden |
| 7 | Job orders list, inspection, customer tracking | Load without errors; home-visit jobs still show their mode |

## 5. Known issues in Jarell's code (not fixed here)
1. `src/lib/bookingSlots.ts` parses naive timestamp text with `new Date(...)`: wrong day after 4 PM Manila on Vercel (UTC). Use `parseNaiveTimestamp`.
2. `/api/customer/booking/occupied-slots` is public and now returns `mechanicName`.
3. `src/lib/db.ts` turns TLS off when `DB_HOST` is unset. Keep the original unless local-only.
4. Service name matching is fuzzy; "Tire Replacement" maps to "Tire Rotation & Balancing".
5. Quotation GET inserts rows; two parallel loads can duplicate services.
6. Net Profit is now services profit plus parts profit; parts with no supplier cost count as zero cost.
7. `document.md` has inaccuracies (purchase order join, `awaiting_arrival` described as a status).
8. Not read in depth: `MechanicCalendar.tsx` (3,193 lines), `MechanicScheduleModal.tsx`.
