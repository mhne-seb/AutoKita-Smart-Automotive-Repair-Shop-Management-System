-- Rollback: migration_add_retention_offers_discount_applied.sql
-- Roll the code back first: the voucher routes read and write this column.

BEGIN;

ALTER TABLE retention_offers DROP COLUMN IF EXISTS discount_applied;

COMMIT;
