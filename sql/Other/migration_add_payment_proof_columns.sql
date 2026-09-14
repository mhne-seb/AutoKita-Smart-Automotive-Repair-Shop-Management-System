-- Adds the columns needed for the manual bank/e-wallet payment flow: which
-- channel the customer sent to (GCash, Maya, BDO, ...) and the transaction
-- reference number they typed in. The screenshot itself still goes in the
-- existing proof_of_payment_image column.
--
-- Approved by Jubert. Run once against the live database (Supabase SQL
-- editor). Safe to re-run: IF NOT EXISTS makes it a no-op if the columns are
-- already there.
--
-- Capstone_postgres_fixed.sql already includes these columns for fresh installs.

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(30);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number VARCHAR(50);
