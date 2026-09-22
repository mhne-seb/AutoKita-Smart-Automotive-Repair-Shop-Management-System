-- Rollback for migration_add_pull_out_requests.sql
-- Drops only what that migration added. Tasks already marked 'cancelled'
-- keep that text status; nothing else in the schema changed.

BEGIN;

DROP INDEX IF EXISTS pull_out_requests_one_open_per_job;
DROP TABLE IF EXISTS pull_out_requests;

COMMIT;
