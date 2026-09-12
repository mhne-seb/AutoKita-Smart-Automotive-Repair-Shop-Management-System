-- Adds 'cancelled' to job_orders_status so a customer can withdraw an accepted
-- booking the shop hasn't started on. Approved by Jubert.
--
-- Run once against the live database (Supabase SQL editor). Safe to re-run:
-- IF NOT EXISTS makes it a no-op if the value is already there.
--
-- Capstone_postgres_fixed.sql already includes the value for fresh installs.

ALTER TYPE job_orders_status ADD VALUE IF NOT EXISTS 'cancelled';
