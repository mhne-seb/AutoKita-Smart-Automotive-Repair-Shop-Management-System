-- get_inspection_data(p_job_order_id)
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


-- get_inspection_findings(p_job_order_id)
CREATE OR REPLACE FUNCTION get_inspection_findings(p_job_order_id INT)
RETURNS TABLE (
    id                    INT,
    name                  VARCHAR(100),
    notes                 TEXT,
    status                VARCHAR(50),
    photo                 TEXT,
    findings_description  TEXT,
    logged_date           TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        vi.id,
        vi.name,
        vi.notes,
        vi.status,
        vi.photo,
        vi.findings_description,
        vi.logged_date
    FROM vehicle_inspections vi
    WHERE vi.job_order_id = p_job_order_id
    ORDER BY vi.logged_date ASC;
$$;


-- add_inspection_finding(...)
CREATE OR REPLACE FUNCTION add_inspection_finding(
    p_job_order_id  INT,
    p_name          VARCHAR(100),
    p_notes         TEXT,
    p_status        VARCHAR(50),
    p_photo         TEXT,
    p_description   TEXT
)
RETURNS TABLE (
    id                    INT,
    job_order_id          INT,
    name                  VARCHAR(100),
    notes                 TEXT,
    status                VARCHAR(50),
    photo                 TEXT,
    findings_description  TEXT,
    logged_date           TIMESTAMP
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO vehicle_inspections (
        job_order_id, name, notes, status, photo,
        findings_description, logged_date
    ) VALUES (
        p_job_order_id, p_name, p_notes, p_status, p_photo,
        p_description, NOW()
    )
    RETURNING
        vehicle_inspections.id,
        vehicle_inspections.job_order_id,
        vehicle_inspections.name,
        vehicle_inspections.notes,
        vehicle_inspections.status,
        vehicle_inspections.photo,
        vehicle_inspections.findings_description,
        vehicle_inspections.logged_date;
$$;
