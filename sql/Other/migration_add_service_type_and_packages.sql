-- Migration: service type (maintenance / repair / diagnostics) and maintenance packages
--
-- Booking asks the customer "What do you need?" with three plain choices:
--   maintenance  - due for service, nothing is broken, fixed scope
--   repair       - something is worn, leaking, noisy or broken; scope depends on inspection
--   diagnostics  - finding out what is wrong (scan, check-up)
--
--   * services.service_type is a LABEL only. The prediction models do not read it
--     (their inputs are the service, base price/hours, vehicle age, type and mileage).
--     New and custom services default to 'repair', because that is what staff add by hand.
--   * A package is a bundle of services that already exist. Nothing new is predicted:
--     each service in a package is predicted the way it is today.
--   * job_order_services.package_id remembers which package a service line came from,
--     so package jobs can be reported, and left out of retraining if their times look wrong.
--   * package_price NULL means "the sum of the normal prices" (no package discount yet;
--     the owner decides the price).
--   * The column is VARCHAR + CHECK, not an enum, so a value can be changed later.
--
-- Safe to run twice. Run seed_service_type_and_packages.sql after this file.

BEGIN;

ALTER TABLE services
    ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) NOT NULL DEFAULT 'repair';

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_service_type_check') THEN
        ALTER TABLE services
            ADD CONSTRAINT services_service_type_check
            CHECK (service_type IN ('maintenance', 'repair', 'diagnostics'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS service_packages (
    id              SERIAL PRIMARY KEY,
    shop_id         INT REFERENCES shops(id),
    package_name    VARCHAR(60) NOT NULL UNIQUE,
    description     TEXT,
    interval_km     INT CHECK (interval_km IS NULL OR interval_km > 0),         -- suggested: every N km
    interval_months INT CHECK (interval_months IS NULL OR interval_months > 0), -- or every N months
    package_price   NUMERIC(10,2) CHECK (package_price IS NULL OR package_price >= 0),
    sort_order      INT NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE IF NOT EXISTS service_package_items (
    id          SERIAL PRIMARY KEY,
    package_id  INT NOT NULL REFERENCES service_packages(id) ON DELETE CASCADE,
    service_id  INT NOT NULL REFERENCES services(id),
    sort_order  INT NOT NULL DEFAULT 0,
    UNIQUE (package_id, service_id)
);

ALTER TABLE job_order_services
    ADD COLUMN IF NOT EXISTS package_id INT REFERENCES service_packages(id) ON DELETE SET NULL;

-- Same protection as every other table in this project: row level security on, no policies.
ALTER TABLE service_packages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_package_items ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON service_packages, service_package_items FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON service_packages, service_package_items FROM authenticated;
    END IF;
END $$;

COMMIT;
