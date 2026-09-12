-- Adds the OBD-II scanner fee as a fixed-price service so it can be attached
-- to a job order as a line item the moment the customer authorizes it.
--
-- Data insert only — no schema change. Run once in the Supabase SQL editor.
-- Safe to re-run: skips if a row with this name already exists.
--
-- The name must match DIAGNOSTIC_SCAN_SERVICE_NAME in src/data/diagnosticScan.ts.

INSERT INTO services (shop_id, service_name, description, base_price, base_duration_hours, is_price_fixed, is_active)
SELECT
  (SELECT id FROM shops ORDER BY id LIMIT 1),
  'OBD-II Diagnostic Scan',
  'Electronic diagnostic scan of the vehicle''s onboard computer. Charged whenever the scanner is used, regardless of whether repairs proceed.',
  1500.00,
  0.50,
  TRUE,
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM services WHERE service_name = 'OBD-II Diagnostic Scan'
);
