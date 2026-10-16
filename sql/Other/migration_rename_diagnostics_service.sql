-- Rename the service "Engine Diagnostics & Electrical Scan" to "Diagnostics" (owner, Oct 16 2026).
-- Safe to run twice.
--
-- Why two UPDATEs: service_progress_tasks.task_title stores the service NAME as text, and the code joins
-- tasks to services by name (estimated hours, parts, scheduling). Renaming only `services` would orphan the
-- 17 existing tasks (on the local copy). Both are changed in one transaction.
--
-- The code keeps accepting BOTH names for the scan-fee rule and the SCAN10 voucher, so the order of
-- "run SQL" and "deploy code" does not matter for the fee.
--
-- Not changed on purpose: free text written in the past (service_tickets.customer_concern, audit logs).

UPDATE services
SET service_name = 'Diagnostics'
WHERE service_name = 'Engine Diagnostics & Electrical Scan';

UPDATE service_progress_tasks
SET task_title = 'Diagnostics'
WHERE task_title = 'Engine Diagnostics & Electrical Scan';

-- Proof: the old name must have no rows left, the new name must have the service and its tasks.
SELECT
  (SELECT COUNT(*) FROM services WHERE service_name = 'Engine Diagnostics & Electrical Scan') AS old_services,
  (SELECT COUNT(*) FROM services WHERE service_name = 'Diagnostics')        AS new_services,
  (SELECT COUNT(*) FROM service_progress_tasks WHERE task_title = 'Engine Diagnostics & Electrical Scan') AS old_tasks,
  (SELECT COUNT(*) FROM service_progress_tasks WHERE task_title = 'Diagnostics')        AS new_tasks;
