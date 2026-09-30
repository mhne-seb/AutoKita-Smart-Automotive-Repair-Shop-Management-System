BEGIN;
ALTER TABLE payments
  DROP COLUMN IF EXISTS quotation_selection,
  DROP COLUMN IF EXISTS verified_by,
  DROP COLUMN IF EXISTS verified_at,
  DROP COLUMN IF EXISTS rejection_reason;
ALTER TABLE job_order_parts DROP COLUMN IF EXISTS warranty_months;
COMMIT;
