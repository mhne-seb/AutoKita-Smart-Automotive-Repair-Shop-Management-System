-- Migration: mid-inspection OBD-II scan fee authorization
--
-- Only 2 of 8 booking categories (Engine Diagnostics, General Maintenance)
-- ask the customer about the OBD-II scan fee up front. Every other category
-- — including "Others" — never warns them, so if a mechanic decides mid-
-- inspection that the scanner is needed anyway, the customer was never asked
-- and never agreed to the PHP 1,500 fee.
--
-- This table is that missing consent step: the admin asks (one row, pending),
-- the customer approves or declines with one plain click (no OTP — the fee
-- is fixed and disclosed the same way every time, so being logged in is
-- enough; see NIST's "Security Fatigue", Stanton et al. 2016, on why
-- repeating a code prompt for an unchanging known amount trains customers to
-- stop reading rather than making them safer). Approving is what lets
-- app/api/job-orders/[id]/scan-authorization/route.ts and
-- app/api/tracking/inspecting/scan-authorization/*.
--
--   * decision reuses approval_status (pending | approved | disputed) like
--     pre_diagnostics / service_findings / pull_out_requests. 'disputed' =
--     declined.
--   * One open request per job order (partial unique index below) — same
--     shape as pull_out_requests.

BEGIN;

CREATE TABLE IF NOT EXISTS scan_authorizations (
    id            SERIAL PRIMARY KEY,
    job_order_id  INT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    admin_note    TEXT,
    decision      approval_status NOT NULL DEFAULT 'pending',
    requested_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    decided_at    TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS scan_authorizations_one_pending
    ON scan_authorizations (job_order_id)
    WHERE decision = 'pending';

ALTER TABLE scan_authorizations ENABLE ROW LEVEL SECURITY;

COMMIT;
