-- Rollback: migration_jarell_scheduling_columns.sql
-- Roll the code back first: the booking and quotation routes write these columns.
-- Dropping the columns deletes what was saved in them.

BEGIN;

ALTER TABLE service_tickets   DROP COLUMN IF EXISTS booked_service_ids;
ALTER TABLE job_order_parts   DROP COLUMN IF EXISTS estimated_delivery_date;

-- Put the function back as it was (terminated mechanics visible again).
CREATE OR REPLACE FUNCTION get_mechanics_list()
RETURNS TABLE (
    id INT, full_name VARCHAR(70), email VARCHAR(80), contact_number VARCHAR(11),
    status employee_status, branch VARCHAR(100), location VARCHAR(100), rank VARCHAR(50),
    jobs_capacity INTEGER, color VARCHAR(100), active_jobs BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        e.id, e.full_name, e.email, e.contact_number, e.status,
        ep.branch, ep.location, ep.rank, ep.jobs_capacity, ep.color,
        (SELECT COUNT(*) FROM job_orders jo
         WHERE jo.assigned_mechanic_id = e.id
           AND jo.status NOT IN ('completed', 'released', 'cancelled')) AS active_jobs
    FROM employees e
    LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
    WHERE e.role = 'mechanic'
    ORDER BY e.full_name ASC;
$$;

COMMIT;
