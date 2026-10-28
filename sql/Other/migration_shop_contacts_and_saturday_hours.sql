-- Real shop contacts and Saturday closing time (client interview, Oct 12 2026).
-- Safe to run twice. Touches only the single row of `shops`; no new table, no new column.
--
-- Why:
--  * The shop is open Monday to Saturday, 8:00 to 17:00 (Saturday used to close at 16:00).
--  * `contact_number` is varchar(11), so it can hold ONE number. The other numbers live in
--    src/data/shopProfile.ts (used by the PDF, emails and billing).
--
-- Before running on live: back up (scripts\backup_db.ps1) and read the current values:
--   SELECT id, name, address, contact_number, email, operating_hours FROM shops;
-- `operating_hours` is `json` (not jsonb), so it is cast for jsonb_set and cast back.

UPDATE shops
SET address         = '971 1-B Domingo Santiago St., Brgy. 576, Sampaloc, Manila',
    contact_number  = '09452387889',
    email           = 'albertmarquez76@yahoo.com',
    operating_hours = jsonb_set(operating_hours::jsonb, '{saturday}', '"08:00-17:00"')::json
WHERE (SELECT COUNT(*) FROM shops) = 1;

-- Proof (should show one row, Saturday 08:00-17:00):
SELECT id, address, contact_number, email, operating_hours->>'saturday' AS saturday FROM shops;
