-- Rollback: migration_add_users_setup_completed_at.sql
-- Roll the code back first: the customer pages read this column.

BEGIN;

ALTER TABLE users DROP COLUMN IF EXISTS setup_completed_at;

COMMIT;
