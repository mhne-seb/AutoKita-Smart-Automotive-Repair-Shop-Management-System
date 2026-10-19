-- Migration: columns and function change needed by the scheduling work on origin/develop (b04a5c2, by Jarell)
--
--   service_tickets.booked_service_ids       int[]  the service ids the customer picked at booking.
--                                                   Written by POST /api/customer/booking, read by
--                                                   src/lib/syncBookedServices.ts (quotation auto-fill)
--                                                   and /api/admin/job-queue/availability.
--   job_order_parts.estimated_delivery_date  date   when a part that must be ordered is expected.
--                                                   Written by the quotation save, read by the tracking
--                                                   page and suggest-schedule.
--   get_mechanics_list()                            now hides terminated mechanics (same as the code's
--                                                   other mechanic lists).
--
-- Both columns are nullable with no default, so existing rows are untouched and need no backfill.
-- Safe to run twice. Dry run first: replace COMMIT with ROLLBACK, run, then run it for real.
-- Verify: see Jarell_Changes_Verification_2026-10-19.md (section 3).

BEGIN;

ALTER TABLE service_tickets
    ADD COLUMN IF NOT EXISTS booked_service_ids integer[];

ALTER TABLE job_order_parts
    ADD COLUMN IF NOT EXISTS estimated_delivery_date date;

-- Same body as sql/admin/admin_mechanics.sql. Before running, compare with the live one:
--   SELECT pg_get_functiondef('get_mechanics_list()'::regprocedure);
CREATE OR REPLACE FUNCTION get_mechanics_list()
RETURNS TABLE (
    id              INT,
    full_name       VARCHAR(70),
    email           VARCHAR(80),
    contact_number  VARCHAR(11),
    status          employee_status,
    branch          VARCHAR(100),
    location        VARCHAR(100),
    rank            VARCHAR(50),
    jobs_capacity   INTEGER,
    color           VARCHAR(100),
    active_jobs     BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        e.id, e.full_name, e.email, e.contact_number, e.status,
        ep.branch, ep.location, ep.rank, ep.jobs_capacity, ep.color,
        (SELECT COUNT(*)
         FROM job_orders jo
         WHERE jo.assigned_mechanic_id = e.id
           AND jo.status NOT IN ('completed', 'released', 'cancelled')
        ) AS active_jobs
    FROM employees e
    LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
    WHERE e.role = 'mechanic' AND e.status != 'terminated'
    ORDER BY e.full_name ASC;
$$;

COMMIT;
