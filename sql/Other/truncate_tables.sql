DO $$ 
DECLARE
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
          AND tablename NOT IN ('vehicle_catalog', 'part_catalog', 'part_fitments')
    LOOP
        EXECUTE 'TRUNCATE TABLE public.' || quote_ident(table_record.tablename) || ' RESTART IDENTITY CASCADE;';
        RAISE NOTICE 'Truncated table: %', table_record.tablename;
    END LOOP;
END $$;
