-- Migration: vehicle pull-out requests (paper: UC 15, Request Vehicle Pull-Out)
--
-- A customer can ask to take the vehicle back mid-repair. The shop reviews
-- it: approve → unstarted tasks are cancelled, finished/ongoing work is
-- billed, the job goes to Billing; deny → work resumes and the customer
-- sees the shop's note.
--
--   * decision reuses approval_status (pending | approved | disputed) like
--     pre_diagnostics and service_findings; 'disputed' = denied.
--   * One open request per job order (partial unique index below).
--   * Cancelled tasks are marked in service_progress_tasks.task_status
--     ('cancelled') — that column is free text, so no enum change.

BEGIN;

CREATE TABLE IF NOT EXISTS pull_out_requests (
    id            SERIAL PRIMARY KEY,
    job_order_id  INT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    reason        TEXT,
    decision      approval_status NOT NULL DEFAULT 'pending',
    admin_note    TEXT,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    decided_at    TIMESTAMP WITH TIME ZONE
);

CREATE UNIQUE INDEX IF NOT EXISTS pull_out_requests_one_open_per_job
    ON pull_out_requests (job_order_id) WHERE decision = 'pending';

ALTER TABLE pull_out_requests ENABLE ROW LEVEL SECURITY;

COMMIT;

-- To undo: run migration_add_pull_out_requests_rollback.sql (same folder).
