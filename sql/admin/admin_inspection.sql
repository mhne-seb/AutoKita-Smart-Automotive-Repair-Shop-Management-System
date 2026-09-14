-- get_inspection_data(p_job_order_id)
-- Returns job order header info for the inspection page.
CREATE OR REPLACE FUNCTION get_inspection_data(p_job_order_id INT)
RETURNS TABLE (
    id             INT,
    jo_date        DATE,
    status         job_orders_status,
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10),
    vin            CHAR(17),
    mileage        DECIMAL(10,2)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id,
        jo.jo_date,
        jo.status,
        u.first_name,
        u.last_name,
        v.vehicle_model,
        v.plate_number,
        v.vin,
        v.mileage
    FROM job_orders jo
    JOIN users u    ON u.id = jo.user_id
    JOIN vehicles v ON v.id = jo.vehicle_id
    WHERE jo.id = p_job_order_id;
$$;


-- get_or_create_inspection(p_job_order_id)
-- Returns the vehicle_inspections header row for a job order,
-- creating it on first call so the inspection session exists before
-- any findings or photos are attached.
CREATE OR REPLACE FUNCTION get_or_create_inspection(p_job_order_id INT)
RETURNS TABLE (
    id           INT,
    job_order_id INT,
    started_at   TIMESTAMP,
    fulfilled_at TIMESTAMP
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_id INT;
BEGIN
    SELECT vi.id INTO v_id
    FROM vehicle_inspections vi
    WHERE vi.job_order_id = p_job_order_id
    LIMIT 1;

    IF v_id IS NULL THEN
        INSERT INTO vehicle_inspections (job_order_id, started_at)
        VALUES (p_job_order_id, NOW())
        RETURNING vehicle_inspections.id INTO v_id;
    END IF;

    RETURN QUERY
    SELECT vi.id, vi.job_order_id, vi.started_at, vi.fulfilled_at
    FROM vehicle_inspections vi
    WHERE vi.id = v_id;
END;
$$;


-- complete_inspection(p_job_order_id)
-- Marks the inspection as fulfilled (sets fulfilled_at to NOW()).
-- Called when the admin clicks "Continue to Quotation".
CREATE OR REPLACE FUNCTION complete_inspection(p_job_order_id INT)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE vehicle_inspections
    SET fulfilled_at = NOW()
    WHERE job_order_id = p_job_order_id
      AND fulfilled_at IS NULL;
$$;


-- get_inspection_findings(p_job_order_id)
-- Returns all mechanical findings for a job order through the
-- inspection_photos table (which stores both walkaround photos and findings).
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
      AND p.status IS NOT NULL
    ORDER BY p.logged_at ASC;
$$;


-- get_inspection_photos(p_job_order_id)
-- Returns all walkaround reference photos for a job order.
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
      AND p.status IS NULL
    ORDER BY p.logged_at ASC;
$$;


-- add_inspection_finding(p_job_order_id, p_name, p_description, p_status, p_photo)
-- Inserts a new mechanical finding under the job order's inspection,
-- storing it into inspection_photos with its finding status.
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
