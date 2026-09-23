-- Rollback: migration_add_scan_authorizations.sql

BEGIN;

DROP TABLE IF EXISTS scan_authorizations;

COMMIT;
