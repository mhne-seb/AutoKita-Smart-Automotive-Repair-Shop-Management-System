-- Apply to Supabase before deploying the generated-password claim endpoint.
-- Existing customers need no backfill. Only newly generated Google passwords
-- receive a one-time claim after their first sign-in.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS generated_password_claimed_at timestamp without time zone;
