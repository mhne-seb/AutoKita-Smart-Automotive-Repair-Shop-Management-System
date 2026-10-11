-- Migration: pending email sign-ups and the sends log
--
-- Email sign-up (name, email, password, then a 6-digit code):
--   * pending_signups   one row per email that asked for a code and has not confirmed it yet.
--                       Holds the bcrypt hash of the chosen password and a keyed hash of the code
--                       (never the code itself). The account is only created when the code is right.
--   * signup_email_log  one row per code email sent, so a person cannot make the shop's email
--                       quota burn: limits per email and per IP are counted from here, in the
--                       database (in-memory counters do not hold across Vercel instances).
--
-- All timestamps are Manila time (timestamp without time zone), like the rest of the database.
-- Row-level security on, no policies, no access for anon / authenticated.
-- Safe to run twice.

BEGIN;

CREATE TABLE IF NOT EXISTS pending_signups (
    id             SERIAL PRIMARY KEY,
    email          VARCHAR(80)  NOT NULL UNIQUE,                 -- lower case
    first_name     VARCHAR(40)  NOT NULL,
    last_name      VARCHAR(40)  NOT NULL,
    password_hash  VARCHAR(100) NOT NULL,                        -- bcrypt, same as users.password
    code_hash      VARCHAR(64)  NOT NULL,                        -- HMAC-SHA256 hex of the 6-digit code
    attempts       INT          NOT NULL DEFAULT 0,              -- wrong tries for the current code
    expires_at     TIMESTAMP    NOT NULL,
    last_sent_at   TIMESTAMP    NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE TABLE IF NOT EXISTS signup_email_log (
    id       SERIAL PRIMARY KEY,
    email    VARCHAR(80) NOT NULL,
    ip       VARCHAR(64),
    sent_at  TIMESTAMP   NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila')
);

CREATE INDEX IF NOT EXISTS signup_email_log_email_idx ON signup_email_log (email, sent_at);
CREATE INDEX IF NOT EXISTS signup_email_log_ip_idx    ON signup_email_log (ip, sent_at);

ALTER TABLE pending_signups  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signup_email_log ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON pending_signups, signup_email_log FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON pending_signups, signup_email_log FROM authenticated;
    END IF;
END $$;

COMMIT;
