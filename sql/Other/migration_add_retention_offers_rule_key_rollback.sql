-- Undo for migration_add_retention_offers_rule_key.sql.
-- Do NOT run this on a database where vouchers are in use: it deletes which offer each row is.

ALTER TABLE retention_offers DROP COLUMN IF EXISTS rule_key;
