-- Rollback: migration_plate_number_format.sql
-- Drops the CHECK constraint. Does NOT undo the formatting normalization
-- (uppercase, dashes/spaces stripped) — that tidy-up is harmless and safe to
-- keep either way.

BEGIN;

ALTER TABLE vehicles
    DROP CONSTRAINT IF EXISTS vehicles_plate_number_format;

COMMIT;
