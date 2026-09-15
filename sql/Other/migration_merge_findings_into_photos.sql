-- =============================================================================
-- Migration: Merge inspection_findings into inspection_photos and drop inspection_findings
-- =============================================================================
-- Run this in Supabase SQL Editor (Query tab).
-- =============================================================================

BEGIN;

-- Step 1: Add status column to inspection_photos
ALTER TABLE inspection_photos
    ADD COLUMN IF NOT EXISTS status finding_status;

-- Step 2: Migrate any existing findings data into inspection_photos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'inspection_findings') THEN
        INSERT INTO inspection_photos (inspection_id, title, note, status, photo_url, logged_at)
        SELECT
            f.inspection_id,
            COALESCE(NULLIF(f.name, ''), 'Inspection Finding'),
            f.description,
            f.status,
            f.photo,
            COALESCE(f.logged_at, NOW())
        FROM inspection_findings f;

        -- Step 3: Drop inspection_findings table
        DROP TABLE inspection_findings CASCADE;
    END IF;
END
$$;


-- Step 4: Update Stored Functions

-- 4a. get_inspection_findings
CREATE OR REPLACE FUNCTION get_inspection_findings(p_job_order_id INT)
RETURNS TABLE (
    id          INT,
    name        VARCHAR(100),
    description TEXT,
    status      finding_status,
    photo       TEXT,
    logged_at   TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        p.id,
        p.title AS name,
        p.note AS description,
        p.status,
        p.photo_url AS photo,
        p.logged_at
    FROM inspection_photos p
    JOIN vehicle_inspections vi ON vi.id = p.inspection_id
    WHERE vi.job_order_id = p_job_order_id
      AND (p.status IS NOT NULL OR p.title NOT IN ('Front Quarter', 'Engine Bay', 'Underchassis'))
    ORDER BY p.logged_at ASC;
$$;

-- 4b. get_inspection_photos (walkaround photos)
CREATE OR REPLACE FUNCTION get_inspection_photos(p_job_order_id INT)
RETURNS TABLE (
    id        INT,
    title     VARCHAR(100),
    note      TEXT,
    photo_url TEXT,
    logged_at TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        p.id,
        p.title,
        p.note,
        p.photo_url,
        p.logged_at
    FROM inspection_photos p
    JOIN vehicle_inspections vi ON vi.id = p.inspection_id
    WHERE vi.job_order_id = p_job_order_id
      AND (p.status IS NULL OR p.title IN ('Front Quarter', 'Engine Bay', 'Underchassis'))
    ORDER BY p.logged_at ASC;
$$;

-- 4c. add_inspection_finding
CREATE OR REPLACE FUNCTION add_inspection_finding(
    p_job_order_id INT,
    p_name         VARCHAR(100),
    p_description  TEXT,
    p_status       finding_status,
    p_photo        TEXT
)
RETURNS TABLE (
    id            INT,
    inspection_id INT,
    name          VARCHAR(100),
    description   TEXT,
    status        finding_status,
    photo         TEXT,
    logged_at     TIMESTAMP
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_inspection_id INT;
BEGIN
    SELECT vi.id INTO v_inspection_id
    FROM vehicle_inspections vi
    WHERE vi.job_order_id = p_job_order_id
    LIMIT 1;

    IF v_inspection_id IS NULL THEN
        INSERT INTO vehicle_inspections (job_order_id, started_at)
        VALUES (p_job_order_id, NOW())
        RETURNING vehicle_inspections.id INTO v_inspection_id;
    END IF;

    RETURN QUERY
    INSERT INTO inspection_photos (inspection_id, title, note, status, photo_url, logged_at)
    VALUES (v_inspection_id, p_name, p_description, p_status, p_photo, NOW())
    RETURNING
        inspection_photos.id,
        inspection_photos.inspection_id,
        inspection_photos.title AS name,
        inspection_photos.note AS description,
        inspection_photos.status,
        inspection_photos.photo_url AS photo,
        inspection_photos.logged_at;
END;
$$;

-- 4d. get_job_order_inspections (customer tracking view)
CREATE OR REPLACE FUNCTION get_job_order_inspections(p_job_order_id integer)
RETURNS TABLE (
    id INTEGER, name VARCHAR, status VARCHAR, photo TEXT, findings_description TEXT, logged_date TEXT
)
LANGUAGE sql STABLE
AS $$
    SELECT p.id, p.title AS name, p.status::text, p.photo_url AS photo, p.note AS findings_description, p.logged_at::text AS logged_date
    FROM inspection_photos p
    JOIN vehicle_inspections vi ON vi.id = p.inspection_id
    WHERE vi.job_order_id = p_job_order_id
      AND (p.status IS NOT NULL OR p.title NOT IN ('Front Quarter', 'Engine Bay', 'Underchassis'))
    ORDER BY p.logged_at ASC;
$$;

-- Step 5: Ensure RLS is enabled on inspection_photos
ALTER TABLE inspection_photos ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verification
SELECT 'inspection_photos' AS tbl, COUNT(*) FROM inspection_photos
UNION ALL SELECT 'vehicle_inspections', COUNT(*) FROM vehicle_inspections
UNION ALL SELECT 'pre_diagnostics', COUNT(*) FROM pre_diagnostics;
