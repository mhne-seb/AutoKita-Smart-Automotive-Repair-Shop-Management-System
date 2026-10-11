-- Rollback: migration_add_pending_signups.sql
-- Roll the code back first: the sign-up routes use these tables.

BEGIN;

DROP TABLE IF EXISTS signup_email_log;
DROP TABLE IF EXISTS pending_signups;

COMMIT;
