-- Undo for migration_shop_contacts_and_saturday_hours.sql.
-- The old values below are the ones seen on the LOCAL copy (placeholders). Check the values you read
-- from live BEFORE running the migration and use those if they differ.

UPDATE shops
SET address         = '123 Main St',
    contact_number  = '09123456789',
    email           = 'contact@autokita.com',
    operating_hours = jsonb_set(operating_hours::jsonb, '{saturday}', '"08:00-16:00"')::json
WHERE (SELECT COUNT(*) FROM shops) = 1;

SELECT id, address, contact_number, email, operating_hours->>'saturday' AS saturday FROM shops;
