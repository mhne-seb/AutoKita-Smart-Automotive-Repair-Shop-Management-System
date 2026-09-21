-- Rollback for migration_add_service_findings.sql
--
-- Undoes everything that migration added, in reverse order, and nothing
-- else. Safe to run even if the migration was only partly applied (every
-- statement is IF EXISTS). Any rows in service_findings are lost — that's
-- the point of rolling back; the pre-existing tables keep all their data,
-- only the added finding_id column is removed from each.
--
-- Run this in the Supabase SQL editor if the feature is not approved.

BEGIN;

ALTER TABLE service_progress_tasks DROP COLUMN IF EXISTS finding_id;
ALTER TABLE job_order_parts        DROP COLUMN IF EXISTS finding_id;
ALTER TABLE job_order_services     DROP COLUMN IF EXISTS finding_id;

DROP INDEX IF EXISTS service_findings_job_order_idx;
DROP TABLE IF EXISTS service_findings;

COMMIT;

-- Check it's gone (should return 0 rows):
--   SELECT table_name, column_name FROM information_schema.columns
--   WHERE column_name = 'finding_id' OR table_name = 'service_findings';
