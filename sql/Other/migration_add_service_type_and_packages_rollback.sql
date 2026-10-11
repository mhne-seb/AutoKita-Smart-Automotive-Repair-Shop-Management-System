-- Rollback: migration_add_service_type_and_packages.sql (and its seed)
-- Roll the code back first: code that reads these columns fails once they are gone.

BEGIN;

ALTER TABLE job_order_services DROP COLUMN IF EXISTS package_id;

DROP TABLE IF EXISTS service_package_items;
DROP TABLE IF EXISTS service_packages;

ALTER TABLE services DROP CONSTRAINT IF EXISTS services_service_type_check;
ALTER TABLE services DROP COLUMN IF EXISTS service_type;

COMMIT;
