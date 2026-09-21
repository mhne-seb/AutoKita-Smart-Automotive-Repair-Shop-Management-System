-- Migration: mid-service findings that need customer approval
--
-- While a job is In Progress a mechanic may find something the approved
-- quotation didn't cover (worn pads noticed during a brake job, a torn CV
-- boot noticed while the car was on the lift). The shop reports it, the
-- customer approves or declines from the tracking page, and only on approval
-- does the extra work become real services/parts on the job order.
--
-- Design notes
--   * task_id is NULL for a "general inspection" finding (reported from the
--     sidebar, not from a specific task card).
--   * The proposed services and parts are kept as JSON on the finding until
--     the customer decides. They are NOT inserted into job_order_services /
--     job_order_parts while pending, so labor hours, the bill, and the
--     customer's balance never include work that hasn't been approved.
--     On approval the app inserts the real rows and tags them with
--     finding_id so the UI can show "Added mid-service".
--   * decision reuses approval_status (pending | approved | disputed), the
--     same enum pre_diagnostics and road_tests.extra_decision use.
--     'disputed' means the customer declined. A declined finding stays on
--     the job order as a "recommended, not done" advisory.
--
-- Shape of the JSON columns (what the app writes):
--   proposed_services: [{ "serviceId": 12, "name": "CV Boot Replacement",
--                         "hours": 1.0, "price": 900 }]
--   proposed_parts:    [{ "name": "CV boot kit, outer", "partNo": "PRT-5521",
--                         "qty": 1, "unitPrice": 650, "serviceName": "CV Boot Replacement" }]

BEGIN;

CREATE TABLE IF NOT EXISTS service_findings (
    id                 SERIAL PRIMARY KEY,
    job_order_id       INT NOT NULL REFERENCES job_orders(id) ON DELETE CASCADE,
    task_id            INT REFERENCES service_progress_tasks(id) ON DELETE SET NULL,
    reported_by        INT REFERENCES employees(id),
    findings           TEXT NOT NULL,
    photo_url          TEXT,
    proposed_services  JSONB NOT NULL DEFAULT '[]'::jsonb,
    proposed_parts     JSONB NOT NULL DEFAULT '[]'::jsonb,
    extra_cost         NUMERIC(10, 2) NOT NULL DEFAULT 0,
    decision           approval_status NOT NULL DEFAULT 'pending',
    decided_at         TIMESTAMP WITH TIME ZONE,
    created_at         TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS service_findings_job_order_idx
    ON service_findings (job_order_id, created_at DESC);

-- Same as every other table in the project. The app connects as the
-- postgres role, which bypasses RLS, so this only shuts the anon REST key out.
ALTER TABLE service_findings ENABLE ROW LEVEL SECURITY;

-- Rows created from an approved finding point back to it, so the Service
-- Progress page can label them and the finding can list what it added.
ALTER TABLE job_order_services
    ADD COLUMN IF NOT EXISTS finding_id INT REFERENCES service_findings(id) ON DELETE SET NULL;

ALTER TABLE job_order_parts
    ADD COLUMN IF NOT EXISTS finding_id INT REFERENCES service_findings(id) ON DELETE SET NULL;

ALTER TABLE service_progress_tasks
    ADD COLUMN IF NOT EXISTS finding_id INT REFERENCES service_findings(id) ON DELETE SET NULL;

COMMIT;

-- To undo: run migration_add_service_findings_rollback.sql (same folder).
