-- Migration: staff-confirmed quotation payments, payment accountability, quoted warranty terms.
--   payments.quotation_selection : the services the customer chose when paying (applied only when staff confirm)
--   payments.verified_by/at      : who verified or rejected, and when
--   payments.rejection_reason    : why a payment was rejected
--   job_order_parts.warranty_months : warranty term quoted per part (NULL = not set yet, 0 = no warranty)
BEGIN;
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS quotation_selection jsonb,
  ADD COLUMN IF NOT EXISTS verified_by integer REFERENCES employees(id),
  ADD COLUMN IF NOT EXISTS verified_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE job_order_parts
  ADD COLUMN IF NOT EXISTS warranty_months integer
  CHECK (warranty_months IS NULL OR warranty_months BETWEEN 0 AND 60);
COMMIT;
