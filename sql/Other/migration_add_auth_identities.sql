-- Remembers which Google account belongs to which AutoKita account.
CREATE TABLE IF NOT EXISTS auth_identities (
  id               SERIAL PRIMARY KEY,
  provider         VARCHAR(20)  NOT NULL DEFAULT 'google',
  provider_subject VARCHAR(100) NOT NULL,                        -- Google's permanent id for the person ("sub")
  account_type     VARCHAR(10)  NOT NULL CHECK (account_type IN ('customer', 'staff')),
  account_id       INT          NOT NULL,                        -- users.id or employees.id, depending on account_type
  email            VARCHAR(80)  NOT NULL,                        -- the Google email at the time of linking
  created_at       TIMESTAMP    NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Manila'),
  UNIQUE (provider, provider_subject)
);
CREATE INDEX IF NOT EXISTS auth_identities_account_idx ON auth_identities (account_type, account_id);

-- (employees.can_sign_in already exists from the staff access rule. Do not add it here.)

-- Same protection as every other table in this project: row level security on, no policies.
ALTER TABLE auth_identities ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')          THEN REVOKE ALL ON auth_identities FROM anon;          END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN REVOKE ALL ON auth_identities FROM authenticated; END IF;
END $$;
