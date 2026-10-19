-- Migration: retention_offers.rule_key
--
-- The voucher feature stores which of the four fixed offers a row is (SCAN10, OILFREE, BRAKE200, PMS10)
-- in this column. Code that reads or writes it:
--   app/api/admin/retention-offers/route.ts          SELECT / INSERT rule_key
--   app/api/tracking/completed/voucher/route.ts      SELECT rule_key, then getVoucherRule()
--   app/api/job-orders/[id]/billing/route.ts         SELECT promo_code, rule_key (the "Voucher applied" tag)
--
-- No file in sql/ ever created it, so a database restored from an older backup does not have it and
-- the admin Billing page fails with
--   column "rule_key" does not exist
-- Same lesson as migration_add_retention_offers_discount_applied.sql. This file records the column.
--
-- Safe to run twice. NULL means an old offer that is not one of the four fixed rules (it cannot be applied
-- as a voucher, and the billing tag falls back to the word "Voucher").
--
-- Before running on LIVE, check whether it already exists (it probably does; it was added by hand):
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'retention_offers' AND column_name = 'rule_key';
-- One row = nothing to do.

BEGIN;

ALTER TABLE retention_offers
    ADD COLUMN IF NOT EXISTS rule_key VARCHAR(30);

COMMIT;
