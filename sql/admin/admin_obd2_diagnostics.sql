-- get_obd2_report_for_job_order(p_job_order_id)
-- Returns the OBD-II diagnostic report linked to a specific job order,
-- along with all its DTC error codes.
-- Returns NULL if no report has been linked yet.
CREATE OR REPLACE FUNCTION get_obd2_report_for_job_order(p_job_order_id INT)
RETURNS TABLE (
    report_id         INT,
    scanner_tool      VARCHAR(80),
    scanner_software  VARCHAR(50),
    report_date       TIMESTAMP,
    test_mileage      DECIMAL(10,2),
    reported_vin      CHAR(17),
    reported_plate    VARCHAR(20),
    reported_make     VARCHAR(40),
    reported_model    VARCHAR(40),
    reported_year     INT,
    reported_engine   VARCHAR(50),
    filename          VARCHAR(255),
    source            VARCHAR(20),
    pdf_storage_url   TEXT,
    linked_at         TIMESTAMP,
    linked_by_name    VARCHAR(70),
    datetime_created  TIMESTAMP,
    dtc_id            INT,
    dtc_code          VARCHAR(30),
    dtc_description   TEXT,
    dtc_state         VARCHAR(50),
    dtc_system        VARCHAR(150)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        r.id                AS report_id,
        r.scanner_tool,
        r.scanner_software,
        r.report_date,
        r.test_mileage,
        r.reported_vin,
        r.reported_plate,
        r.reported_make,
        r.reported_model,
        r.reported_year,
        r.reported_engine,
        r.filename,
        r.source,
        r.pdf_storage_url,
        r.linked_at,
        e.full_name         AS linked_by_name,
        r.datetime_created,
        d.id                AS dtc_id,
        d.dtc_code,
        d.description       AS dtc_description,
        d.state             AS dtc_state,
        d.system            AS dtc_system
    FROM obd2_diagnostic_reports r
    LEFT JOIN obd2_dtc_codes d ON d.report_id = r.id
    LEFT JOIN employees e      ON e.id = r.linked_by
    WHERE r.job_order_id = p_job_order_id
    ORDER BY d.datetime_logged ASC;
$$;


-- unlink_obd2_report(p_report_id)
-- Removes the job order link from an OBD-II report so it can be re-assigned.
-- Preserves all report data and DTC codes.
CREATE OR REPLACE FUNCTION unlink_obd2_report(p_report_id INT)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE obd2_diagnostic_reports
    SET job_order_id = NULL,
        linked_by    = NULL,
        linked_at    = NULL
    WHERE id = p_report_id;
$$;


-- get_obd2_code_details(p_code)
-- Deterministic lookup for an OBD-II diagnostic trouble code from obd2_codes.
-- Returns verified description, symptoms, causes, seriousness, driving safety,
-- diagnosis steps, and parent/sibling code relationships.
CREATE OR REPLACE FUNCTION get_obd2_code_details(p_code VARCHAR)
RETURNS TABLE (
    code                  VARCHAR(10),
    category              VARCHAR(50),
    description           TEXT,
    meaning               TEXT,
    symptoms              TEXT,
    causes                TEXT,
    seriousness           TEXT,
    can_i_still_drive     TEXT,
    how_to_diagnose       TEXT,
    inspection_difficulty TEXT,
    more_about            TEXT,
    related_codes         TEXT[],
    is_primary            BOOLEAN,
    parent_code           VARCHAR(10),
    source_url            TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        c.code,
        c.category,
        c.description,
        c.meaning,
        c.symptoms,
        c.causes,
        c.seriousness,
        c.can_i_still_drive,
        c.how_to_diagnose,
        c.inspection_difficulty,
        c.more_about,
        c.related_codes,
        c.is_primary,
        c.parent_code,
        c.source_url
    FROM obd2_codes c
    WHERE c.code = UPPER(TRIM(p_code))
       OR UPPER(TRIM(p_code)) = ANY(c.related_codes)
    ORDER BY (c.code = UPPER(TRIM(p_code))) DESC, c.is_primary DESC
    LIMIT 1;
$$;


-- search_obd2_codes(p_query, p_limit)
-- Full-text / ILIKE keyword search across code, description, symptoms, and causes.
CREATE OR REPLACE FUNCTION search_obd2_codes(p_query VARCHAR, p_limit INT DEFAULT 5)
RETURNS TABLE (
    code        VARCHAR(10),
    category    VARCHAR(50),
    description TEXT,
    is_primary  BOOLEAN,
    parent_code VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        c.code,
        c.category,
        c.description,
        c.is_primary,
        c.parent_code
    FROM obd2_codes c
    WHERE c.code ILIKE '%' || TRIM(p_query) || '%'
       OR c.description ILIKE '%' || TRIM(p_query) || '%'
       OR c.symptoms ILIKE '%' || TRIM(p_query) || '%'
       OR c.causes ILIKE '%' || TRIM(p_query) || '%'
    ORDER BY (c.code ILIKE TRIM(p_query)) DESC, c.is_primary DESC
    LIMIT LEAST(p_limit, 10);
$$;

