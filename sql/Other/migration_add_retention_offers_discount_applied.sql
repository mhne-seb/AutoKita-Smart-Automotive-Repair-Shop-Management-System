    -- Migration: retention_offers.discount_applied
    --
    -- The voucher feature (Billing page, "vouchers the customer applies") writes the peso amount
    -- that was taken off to this column when an offer is claimed:
    --   app/api/tracking/completed/voucher/route.ts   UPDATE ... SET discount_applied = $3
    --   app/api/tracking/completed/route.ts           SELECT ... discount_applied::float
    --
    -- The column was never added by a file in sql/, so a database restored from an older backup
    -- does not have it and /api/tracking/completed fails with
    --   column "discount_applied" does not exist
    -- which also breaks the service report pop-up. This file records the column.
    --
    -- Safe to run twice. NULL means no discount was applied (unclaimed offers).
    
    BEGIN;
    
    ALTER TABLE retention_offers
        ADD COLUMN IF NOT EXISTS discount_applied NUMERIC(10,2);
    
    COMMIT;
