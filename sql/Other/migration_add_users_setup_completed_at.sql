-- Migration: users.setup_completed_at (new-account setup)
--
-- A customer who has just created an account goes through a short setup (details, then at least
-- one vehicle) before the dashboard. This column remembers whether they finished it:
--   NULL      = setup not finished yet (the customer pages send them to /setup)
--   a date    = finished (or an account that existed before this feature)
--
-- The first time this runs, every EXISTING customer is marked finished, so nobody who already
-- has an account is ever sent through the setup. Accounts created after that start as NULL.
-- Running the file again changes nothing (the backfill only happens when the column is added).

BEGIN;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'setup_completed_at'
    ) THEN
        ALTER TABLE users ADD COLUMN setup_completed_at TIMESTAMP;
        UPDATE users SET setup_completed_at = (NOW() AT TIME ZONE 'Asia/Manila');
    END IF;
END $$;

COMMIT;
