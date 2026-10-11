-- Seed: labels for the existing services, and three maintenance packages
--
-- Run AFTER migration_add_service_type_and_packages.sql. Safe to run twice.
--
-- What this does:
--   1. Labels 21 existing services as 'maintenance' and 3 as 'diagnostics'.
--      Every other service keeps the default 'repair'.
--   2. Adds three packages (Basic, Standard, Major PMS) built ONLY from services that
--      already have job history, so each one has a trained prediction behind it.
--
-- What this does NOT do: it adds no services, no job orders and no history, and it
-- changes no price and no base hours.
--
-- Services are matched by name among the ACTIVE services. If a name is missing
-- (for example the live list was renamed), the script stops and changes nothing.

BEGIN;

-- 0. Stop if any expected service is missing or duplicated.
DO $$
DECLARE
    expected TEXT[] := ARRAY[
        'Change Oil', 'Change ATF / Transmission Fluid', 'Replace Fuel Filter', 'Replace Air Filter',
        'Replace Cabin Filter', 'Fuel Injector Cleaning / Service', 'Cleaning EGR', 'Throttle Body Cleaning',
        'Cleaning EGR & Throttle Body', 'Replace Spark Plugs', 'Brake Service & Cleaning', 'Replace Brake Pads',
        'Replace Brake Shoes', 'Wheel Alignment', 'Wheel Balancing', 'Tire Rotation & Balancing',
        'Air Conditioning Cleaning & Freon Charge', 'Coolant Flush', 'Battery Testing & Replacement',
        'Replace Fan Belt / Serpentine Belt', 'Replace Timing Belt / Chain',
        'Engine Diagnostics & Electrical Scan', 'General Mechanical Inspection & Check-Up', 'OBD-II Diagnostic Scan'
    ];
    missing TEXT;
BEGIN
    SELECT string_agg(e, ', ') INTO missing
    FROM unnest(expected) AS e
    WHERE (SELECT count(*) FROM services s WHERE s.is_active AND s.service_name = e) <> 1;

    IF missing IS NOT NULL THEN
        RAISE EXCEPTION 'Seed stopped. These services are missing or duplicated among the active services: %', missing;
    END IF;
END $$;

-- 1. Labels. Anything not listed stays 'repair'.
UPDATE services SET service_type = 'maintenance'
WHERE is_active AND service_name IN (
    'Change Oil', 'Change ATF / Transmission Fluid', 'Replace Fuel Filter', 'Replace Air Filter',
    'Replace Cabin Filter', 'Fuel Injector Cleaning / Service', 'Cleaning EGR', 'Throttle Body Cleaning',
    'Cleaning EGR & Throttle Body', 'Replace Spark Plugs', 'Brake Service & Cleaning', 'Replace Brake Pads',
    'Replace Brake Shoes', 'Wheel Alignment', 'Wheel Balancing', 'Tire Rotation & Balancing',
    'Air Conditioning Cleaning & Freon Charge', 'Coolant Flush', 'Battery Testing & Replacement',
    'Replace Fan Belt / Serpentine Belt', 'Replace Timing Belt / Chain'
);

UPDATE services SET service_type = 'diagnostics'
WHERE is_active AND service_name IN (
    'Engine Diagnostics & Electrical Scan', 'General Mechanical Inspection & Check-Up', 'OBD-II Diagnostic Scan'
);

-- 2. Packages. package_price is left NULL: the price shown is the sum of the normal prices
--    until the owner sets a package price. Intervals are suggestions the owner can change.
INSERT INTO service_packages (shop_id, package_name, description, interval_km, interval_months, sort_order)
VALUES
    ((SELECT MIN(id) FROM shops), 'Basic PMS',
     'Oil change, tire rotation and a general check-up.', 10000, 6, 1),
    ((SELECT MIN(id) FROM shops), 'Standard PMS',
     'Basic PMS, plus new air and cabin filters and a brake service.', 20000, 12, 2),
    ((SELECT MIN(id) FROM shops), 'Major PMS',
     'Standard PMS, plus transmission fluid, coolant, spark plugs and fuel filter.', 40000, 24, 3)
ON CONFLICT (package_name) DO NOTHING;

-- 3. What is in each package (each package lists all of its services).
INSERT INTO service_package_items (package_id, service_id, sort_order)
SELECT p.id, s.id, x.sort_order
FROM (VALUES
    ('Basic PMS',    'Change Oil',                                1),
    ('Basic PMS',    'General Mechanical Inspection & Check-Up',  2),
    ('Basic PMS',    'Tire Rotation & Balancing',                 3),

    ('Standard PMS', 'Change Oil',                                1),
    ('Standard PMS', 'General Mechanical Inspection & Check-Up',  2),
    ('Standard PMS', 'Tire Rotation & Balancing',                 3),
    ('Standard PMS', 'Replace Air Filter',                        4),
    ('Standard PMS', 'Replace Cabin Filter',                      5),
    ('Standard PMS', 'Brake Service & Cleaning',                  6),

    ('Major PMS',    'Change Oil',                                1),
    ('Major PMS',    'General Mechanical Inspection & Check-Up',  2),
    ('Major PMS',    'Tire Rotation & Balancing',                 3),
    ('Major PMS',    'Replace Air Filter',                        4),
    ('Major PMS',    'Replace Cabin Filter',                      5),
    ('Major PMS',    'Brake Service & Cleaning',                  6),
    ('Major PMS',    'Change ATF / Transmission Fluid',           7),
    ('Major PMS',    'Coolant Flush',                             8),
    ('Major PMS',    'Replace Spark Plugs',                       9),
    ('Major PMS',    'Replace Fuel Filter',                      10)
) AS x(package_name, service_name, sort_order)
JOIN service_packages p ON p.package_name = x.package_name
JOIN services s ON s.is_active AND s.service_name = x.service_name
ON CONFLICT (package_id, service_id) DO NOTHING;

-- 4. Proof (read these before trusting the result).
SELECT service_type, count(*) AS active_services
FROM services WHERE is_active GROUP BY service_type ORDER BY service_type;

SELECT p.package_name,
       count(*)                     AS services,
       sum(s.base_price)            AS normal_prices_total,
       sum(s.base_duration_hours)   AS base_hours_total
FROM service_packages p
JOIN service_package_items i ON i.package_id = p.id
JOIN services s ON s.id = i.service_id
GROUP BY p.package_name, p.sort_order
ORDER BY p.sort_order;

COMMIT;
