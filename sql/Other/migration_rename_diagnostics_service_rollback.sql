-- Undo for migration_rename_diagnostics_service.sql.

UPDATE services
SET service_name = 'Engine Diagnostics & Electrical Scan'
WHERE service_name = 'Diagnostics';

UPDATE service_progress_tasks
SET task_title = 'Engine Diagnostics & Electrical Scan'
WHERE task_title = 'Diagnostics';

SELECT
  (SELECT COUNT(*) FROM services WHERE service_name = 'Engine Diagnostics & Electrical Scan') AS old_services,
  (SELECT COUNT(*) FROM service_progress_tasks WHERE task_title = 'Engine Diagnostics & Electrical Scan') AS old_tasks;
