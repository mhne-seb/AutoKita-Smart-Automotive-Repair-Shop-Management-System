-- Migration: enforce Philippine (LTO) plate number format on vehicles
--
-- Formats accepted (per https://en.wikipedia.org/wiki/Vehicle_registration_plates_of_the_Philippines):
--   private / government / PUV / EV / trailer / vintage, current (2018–):
--     3 letters + 4 digits, e.g. ABC1234
--   same categories, 1981 series (still valid until reissued):
--     3 letters + 3 digits, e.g. ABC123
--   legacy reversed ordering, older government/PUV plates:
--     3 digits + 3 letters, e.g. 123ABC
--   diplomatic, pre-2014 series: 3-5 digits only, e.g. 10000
--   diplomatic, current series:  7 digits only, e.g. 0011234
--
-- Motorcycles/tricycles use different, more varied formats and are out of
-- scope — this shop's fleet (checked against 506 real vehicles) is 100%
-- 4-wheeled private cars. The app already validates this
-- (src/lib/plateNumber.ts) at every entry point (customer booking, vehicle
-- registration, admin new ticket); this constraint is the database-level
-- backstop, and mirrors that file's rule exactly.
--
-- Storage is normalized: uppercase, no spaces or dashes (ABC1234, not
-- ABC-1234 or abc 1234) — matches how the vast majority of existing rows are
-- already stored.
--
-- Checked against production data before writing this: 504 of 506 existing
-- vehicles already conform once normalized (dashes/case stripped). Two do
-- not — see the SELECT below. This migration will refuse to add the
-- constraint while non-conforming rows exist, rather than silently changing
-- or deleting your data.

BEGIN;

-- 1. Normalize formatting only (case + separators) — does not touch rows
--    whose letters/digits are already fine, just tidies ABC-1234 -> ABC1234.
UPDATE vehicles
   SET plate_number = UPPER(REPLACE(REPLACE(plate_number, '-', ''), ' ', ''))
 WHERE plate_number IS NOT NULL;

-- 2. Surface anything that still won't pass any of the standard formats, so
--    it can be reviewed before the constraint goes on. If this returns rows,
--    fix or remove them (SQL editor), then re-run this migration.
--    Run this SELECT on its own first if you want to check before applying:
--
--    SELECT id, plate_number FROM vehicles
--     WHERE plate_number !~ '^[A-Z]{3}[0-9]{3,4}$'
--       AND plate_number !~ '^[0-9]{3}[A-Z]{3}$'
--       AND plate_number !~ '^[0-9]{3,5}$'
--       AND plate_number !~ '^[0-9]{7}$';

DO $$
DECLARE
    bad_count INT;
BEGIN
    SELECT COUNT(*) INTO bad_count FROM vehicles
     WHERE plate_number !~ '^[A-Z]{3}[0-9]{3,4}$'
       AND plate_number !~ '^[0-9]{3}[A-Z]{3}$'
       AND plate_number !~ '^[0-9]{3,5}$'
       AND plate_number !~ '^[0-9]{7}$';

    IF bad_count > 0 THEN
        RAISE EXCEPTION
            'Migration stopped: % vehicle row(s) do not match any standard PH plate format. Run: SELECT id, plate_number FROM vehicles WHERE plate_number !~ ''^[A-Z]{3}[0-9]{3,4}$'' AND plate_number !~ ''^[0-9]{3}[A-Z]{3}$'' AND plate_number !~ ''^[0-9]{3,5}$'' AND plate_number !~ ''^[0-9]{7}$''; to see them, fix or delete those rows, then re-run this migration.',
            bad_count;
    END IF;
END $$;

-- 3. Now safe to add — every row already conforms.
ALTER TABLE vehicles
    ADD CONSTRAINT vehicles_plate_number_format
    CHECK (
        plate_number ~ '^[A-Z]{3}[0-9]{3,4}$'  -- private / government / PUV / EV / trailer / vintage
        OR plate_number ~ '^[0-9]{3}[A-Z]{3}$' -- legacy reversed government/PUV
        OR plate_number ~ '^[0-9]{3,5}$'       -- diplomatic, pre-2014
        OR plate_number ~ '^[0-9]{7}$'         -- diplomatic, current
    );

COMMIT;
