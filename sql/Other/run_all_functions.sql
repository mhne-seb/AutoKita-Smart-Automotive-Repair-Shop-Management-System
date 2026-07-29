-- This file includes all SQL function definitions compiled into one file.

-- ============================================================
-- FILE: admin/admin_analytics.sql
-- ============================================================
-- get_churn_list()
	CREATE OR REPLACE FUNCTION get_churn_list()
RETURNS TABLE (
    user_id          INT,
    first_name       VARCHAR(40),
    last_name        VARCHAR(40),
    contact_number   VARCHAR(11),
    tier             user_tiers,
    vehicle_model    VARCHAR(40),
    plate_number     VARCHAR(10),
    mileage          DECIMAL(10,2),
    last_checkup     TIMESTAMP,
    service_count    BIGINT,
    churn_status     TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        u.id             AS user_id,
        u.first_name,
        u.last_name,
        u.contact_number,
        u.tier,
        v.vehicle_model,
        v.plate_number,
        v.mileage,
        MAX(jo.completed_at)  AS last_checkup,
        COUNT(jo.id)          AS service_count,
        CASE
            WHEN MAX(jo.completed_at) IS NULL THEN 'No Service'
            WHEN MAX(jo.completed_at) < NOW() - INTERVAL '180 days' THEN 'High Risk'
            WHEN MAX(jo.completed_at) < NOW() - INTERVAL '90 days'  THEN 'At Risk'
            ELSE 'Active'
        END                   AS churn_status
    FROM users u
    LEFT JOIN vehicles v   ON v.user_id = u.id
    LEFT JOIN job_orders jo ON jo.user_id = u.id
                           AND jo.status IN ('completed', 'released')
    GROUP BY u.id, u.first_name, u.last_name, u.contact_number, u.tier,
             v.vehicle_model, v.plate_number, v.mileage
    ORDER BY last_checkup ASC NULLS FIRST;
$$;


-- get_analytics_revenue_trend(p_months)

CREATE OR REPLACE FUNCTION get_analytics_revenue_trend(p_months INT DEFAULT 6)
RETURNS TABLE (
    month           DATE,
    total_revenue   DECIMAL,
    jobs_completed  BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        DATE_TRUNC('month', p.payment_date)::DATE AS month,
        COALESCE(SUM(p.amount_paid), 0)           AS total_revenue,
        COUNT(DISTINCT jo.id)                      AS jobs_completed
    FROM payments p
    JOIN job_orders jo ON jo.id = p.job_order_id
    WHERE p.payment_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
      AND p.verification_status = 'verified'
    GROUP BY DATE_TRUNC('month', p.payment_date)
    ORDER BY month ASC;
$$;


-- ============================================================
-- FILE: admin/admin_database.sql
-- ============================================================
-- get_audit_log(p_limit, p_offset)
CREATE OR REPLACE FUNCTION get_audit_log(
    p_limit  INT DEFAULT 50,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    id               INT,
    action_performed audit_action_enum,
    entity_type      VARCHAR(50),
    entity_id        INT,
    old_values       TEXT,
    new_values       TEXT,
    action_date      TIMESTAMP,
    user_nickname    VARCHAR(40),
    employee_name    VARCHAR(70)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        sal.id,
        sal.action_performed,
        sal.entity_type,
        sal.entity_id,
        sal.old_values,
        sal.new_values,
        sal.action_date,
        u.nickname       AS user_nickname,
        e.full_name      AS employee_name
    FROM system_audit_logs sal
    LEFT JOIN users u     ON u.id = sal.user_id
    LEFT JOIN employees e ON e.id = sal.employees_id
    ORDER BY sal.action_date DESC
    LIMIT p_limit
    OFFSET p_offset;
$$;

-- get_audit_log_count()
CREATE OR REPLACE FUNCTION get_audit_log_count()
RETURNS BIGINT
LANGUAGE SQL STABLE
AS $$
    SELECT COUNT(*) FROM system_audit_logs;
$$;


-- ============================================================
-- FILE: admin/admin_history.sql
-- ============================================================
-- get_job_order_history()
CREATE OR REPLACE FUNCTION get_job_order_history()
RETURNS TABLE (
    id             INT,
    jo_date        DATE,
    completed_at   TIMESTAMP,
    status         job_orders_status,
    actual_grand_total    DECIMAL(10,2),
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    vehicle_model  VARCHAR(40)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id,
        jo.jo_date,
        jo.completed_at,
        jo.status,
        jo.actual_grand_total,
        u.first_name,
        u.last_name,
        v.vehicle_model
    FROM job_orders jo
    JOIN users u    ON u.id = jo.user_id
    JOIN vehicles v ON v.id = jo.vehicle_id
    ORDER BY jo.jo_date DESC;
$$;


-- get_job_order_history_summary()
CREATE OR REPLACE FUNCTION get_job_order_history_summary()
RETURNS TABLE (
    status      job_orders_status,
    count       BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.status,
        COUNT(jo.id) AS count
    FROM job_orders jo
    GROUP BY jo.status
    ORDER BY jo.status ASC;
$$;

-- get_ticket_history()
CREATE OR REPLACE FUNCTION get_ticket_history()
RETURNS TABLE (
    id              INT,
    service_mode    service_mode,
    ticket_status   ticket_status,
    request_date    TIMESTAMP,
    first_name      VARCHAR(40),
    last_name       VARCHAR(40),
    vehicle_model   VARCHAR(40)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        st.id,
        st.service_mode,
        st.ticket_status,
        st.request_date,
        u.first_name,
        u.last_name,
        v.vehicle_model
    FROM service_tickets st
    JOIN users u    ON u.id = st.user_id
    JOIN vehicles v ON v.id = st.vehicle_id
    ORDER BY st.request_date DESC;
$$;

-- get_ticket_history_summary()
CREATE OR REPLACE FUNCTION get_ticket_history_summary()
RETURNS TABLE (
    ticket_status  ticket_status,
    count          BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        st.ticket_status,
        COUNT(st.id) AS count
    FROM service_tickets st
    GROUP BY st.ticket_status
    ORDER BY st.ticket_status ASC;
$$;

-- get_customer_history()
CREATE OR REPLACE FUNCTION get_customer_history()
RETURNS TABLE (
    user_id        INT,
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    tier           user_tiers,
    loyalty_points INTEGER,
    total_spent    DECIMAL,
    total_jobs     BIGINT,
    last_service   TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        u.id             AS user_id,
        u.first_name,
        u.last_name,
        u.tier,
        u.loyalty_points,
        COALESCE(SUM(jo.actual_grand_total), 0) AS total_spent,
        COUNT(jo.id)                      AS total_jobs,
        MAX(jo.completed_at)              AS last_service
    FROM users u
    LEFT JOIN job_orders jo ON jo.user_id = u.id
    GROUP BY u.id, u.first_name, u.last_name, u.tier, u.loyalty_points
    ORDER BY total_spent DESC;
$$;


-- get_customer_history_summary()
CREATE OR REPLACE FUNCTION get_customer_history_summary()
RETURNS TABLE (
    total_customers BIGINT,
    total_revenue   DECIMAL,
    avg_spent       DECIMAL
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        COUNT(DISTINCT u.id)             AS total_customers,
        COALESCE(SUM(p.amount_paid), 0)  AS total_revenue,
        CASE
            WHEN COUNT(DISTINCT u.id) > 0
            THEN ROUND(COALESCE(SUM(p.amount_paid), 0) / COUNT(DISTINCT u.id), 2)
            ELSE 0
        END                              AS avg_spent
    FROM users u
    LEFT JOIN job_orders jo ON jo.user_id = u.id
    LEFT JOIN payments p   ON p.job_order_id = jo.id
                           AND p.verification_status = 'verified';
$$;


-- ============================================================
-- FILE: admin/admin_inspection.sql
-- ============================================================
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


-- ============================================================
-- FILE: admin/admin_job_orders.sql
-- ============================================================
-- get_job_orders_list()
CREATE OR REPLACE FUNCTION get_job_orders_list()
RETURNS TABLE (
    id             INT,
    jo_date        DATE,
    status         job_orders_status,
    actual_grand_total    DECIMAL(10,2),	
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id,
        jo.jo_date,
        jo.status,
        jo.actual_grand_total,
        u.first_name,
        u.last_name,
        v.vehicle_model,
        v.plate_number
    FROM job_orders jo
    JOIN users u    ON u.id = jo.user_id
    JOIN vehicles v ON v.id = jo.vehicle_id
    ORDER BY jo.jo_date DESC;
$$;


-- get_job_order_detail(p_job_order_id)
CREATE OR REPLACE FUNCTION get_job_order_detail(p_job_order_id INT)
RETURNS TABLE (
    id                 INT,
    jo_date            DATE,
    date_arrived       TIMESTAMP,
    date_promised      TIMESTAMP,
    started_at         TIMESTAMP,
    completed_at       TIMESTAMP,
    released_at        TIMESTAMP,
    estimated_duration TIME,
    actual_duration    TIME,
    actual_grand_total        DECIMAL(10,2),
    partial_payment    DECIMAL(10,2),
    balance            DECIMAL(10,2),
    status             job_orders_status,
    quotation_notes    TEXT,
    user_id            INT,
    first_name         VARCHAR(40),
    last_name          VARCHAR(40),
    email              VARCHAR(80),
    contact_number     VARCHAR(11),
    tier               user_tiers,
    loyalty_points     INTEGER,
    vehicle_id         INT,
    vehicle_model      VARCHAR(40),
    plate_number       VARCHAR(10),
    vin                CHAR(17),
    vehicle_year       INT,
    mileage            DECIMAL(10,2)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id,
        jo.jo_date,
        jo.date_arrived,
        jo.date_promised,
        jo.started_at,
        jo.completed_at,
        jo.released_at,
        jo.estimated_duration,
        jo.actual_duration,
        jo.actual_grand_total,
        jo.partial_payment,
        jo.balance,
        jo.status,
        jo.quotation_notes,
        u.id             AS user_id,
        u.first_name,
        u.last_name,
        u.email,
        u.contact_number,
        u.tier,
        u.loyalty_points,
        v.id             AS vehicle_id,
        v.vehicle_model,
        v.plate_number,
        v.vin,
        v.vehicle_year,
        v.mileage
    FROM job_orders jo
    JOIN users u    ON u.id = jo.user_id
    JOIN vehicles v ON v.id = jo.vehicle_id
    WHERE jo.id = p_job_order_id;
$$;


-- get_job_order_services(p_job_order_id)
DROP FUNCTION IF EXISTS get_job_order_services(INT);
CREATE OR REPLACE FUNCTION get_job_order_services(p_job_order_id INT)
RETURNS TABLE (
    id                  INT,
    service_name        VARCHAR(70),
    description_of_work TEXT,
    estimated_duration  TIME,
    actual_duration     TIME,
    estimated_hours NUMERIC,
    actual_hours NUMERIC,
    actual_amount              DECIMAL,
    estimated_amount           DECIMAL,
    service_id                 INT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jos.id,
        s.service_name,
        jos.description_of_work,
        jos.estimated_duration,
        jos.actual_duration,
        jos.estimated_hours,
        jos.actual_hours,
        jos.actual_amount,
        jos.estimated_amount,
        jos.service_id
    FROM job_order_services jos
    JOIN services s ON s.id = jos.service_id
    WHERE jos.job_order_id = p_job_order_id
    ORDER BY jos.id ASC;
$$;

	
-- get_job_order_parts(p_job_order_id)

CREATE OR REPLACE FUNCTION get_job_order_parts(p_job_order_id INT)
RETURNS TABLE (
    id                  INT,
    job_order_service_id INT,
    status              job_order_parts_status,
    part_number         VARCHAR(60),
    description         TEXT,
    quantity            INT,
    retail_unit_price   DECIMAL(10,2),
    total_retail_amount DECIMAL(10,2)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jop.id,
        jop.job_order_service_id,
        jop.status,
        jop.part_number,
        jop.description,
        jop.quantity,
        jop.retail_unit_price,
        jop.total_retail_amount
    FROM job_order_parts jop
    WHERE jop.job_order_id = p_job_order_id
    ORDER BY jop.id ASC;
$$;


-- add_job_order_service(...)
CREATE OR REPLACE FUNCTION add_job_order_service(
    p_job_order_id     INT,
    p_service_id       INT,
    p_description      TEXT,
    p_amount           DECIMAL,
    p_estimated_duration TIME DEFAULT NULL,
    p_estimated_hours NUMERIC DEFAULT NULL
)
RETURNS TABLE (
    id                  INT,
    job_order_id        INT,
    service_id          INT,
    description_of_work TEXT,
    actual_amount              DECIMAL
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO job_order_services (
        job_order_id, service_id, description_of_work,
        actual_amount, estimated_duration, estimated_hours
    ) VALUES (
        p_job_order_id, p_service_id, p_description,
        p_amount, p_estimated_duration, p_estimated_hours
    )
    RETURNING
        job_order_services.id,
        job_order_services.job_order_id,
        job_order_services.service_id,
        job_order_services.description_of_work,
        job_order_services.actual_amount;
$$;

-- add_job_order_part(...)
CREATE OR REPLACE FUNCTION add_job_order_part(
    p_job_order_id   INT,
    p_part_number    VARCHAR(60),
    p_description    TEXT,
    p_quantity       INT,
    p_unit_price     DECIMAL(10,2)
)
RETURNS TABLE (
    id                  INT,
    job_order_id        INT,
    part_number         VARCHAR(60),
    description         TEXT,
    quantity            INT,
    retail_unit_price   DECIMAL(10,2),
    total_retail_amount DECIMAL(10,2)
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO job_order_parts (
        job_order_id, part_number, description,
        quantity, retail_unit_price, total_retail_amount
    ) VALUES (
        p_job_order_id, p_part_number, p_description,
        p_quantity, p_unit_price, p_quantity * p_unit_price
    )
    RETURNING
        job_order_parts.id,
        job_order_parts.job_order_id,
        job_order_parts.part_number,
        job_order_parts.description,
        job_order_parts.quantity,
        job_order_parts.retail_unit_price,
        job_order_parts.total_retail_amount;
$$;

-- advance_job_order_stage(p_job_order_id, p_new_status)
CREATE OR REPLACE FUNCTION advance_job_order_stage(
    p_job_order_id INT,
    p_new_status   job_orders_status
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_old_status job_orders_status;
BEGIN
    SELECT status INTO v_old_status
    FROM job_orders
    WHERE id = p_job_order_id;

    UPDATE job_orders
    SET status       = p_new_status,
        started_at   = CASE WHEN p_new_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
        released_at  = CASE WHEN p_new_status = 'released'  THEN NOW() ELSE released_at  END
    WHERE id = p_job_order_id;

    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, NULL, 'status_changed',
        'job_orders', p_job_order_id,
        json_build_object('status', v_old_status::TEXT)::TEXT,
        json_build_object('status', p_new_status::TEXT)::TEXT,
        NOW()
    );
END;
$$;

-- assign_mechanic_to_job_order(p_job_order_id, p_employee_id)
CREATE OR REPLACE FUNCTION assign_mechanic_to_job_order(
    p_job_order_id INT,
    p_employee_id  INT
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
BEGIN
    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, p_employee_id, 'updated',
        'job_orders', p_job_order_id,
        NULL,
        json_build_object('assigned_mechanic_id', p_employee_id)::TEXT,
        NOW()
    );
END;
$$;


-- ============================================================
-- FILE: admin/admin_job_queue.sql
-- ============================================================
-- get_service_tickets_queue()

CREATE OR REPLACE FUNCTION get_service_tickets_queue()
RETURNS TABLE (
    id                   INT,
    service_mode         service_mode,
    customer_concern     TEXT,
    ticket_status        ticket_status,
    request_date         TIMESTAMP,
    first_name           VARCHAR(40),
    last_name            VARCHAR(40),
    contact_number       VARCHAR(11),
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        st.id,
        st.service_mode,
        st.customer_concern,
        st.ticket_status,
        st.request_date,
        u.first_name,
        u.last_name,
        u.contact_number,
        v.vehicle_model,
        v.plate_number
    FROM service_tickets st
    JOIN users u    ON u.id = st.user_id
    JOIN vehicles v ON v.id = st.vehicle_id
    WHERE st.ticket_status IN ('pending', 'queued')
    ORDER BY st.request_date ASC;
$$;


-- update_ticket_status(p_ticket_id, p_new_status)
CREATE OR REPLACE FUNCTION update_ticket_status(
    p_ticket_id  INT,
    p_new_status ticket_status
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_old_status ticket_status;
BEGIN
    SELECT ticket_status INTO v_old_status
    FROM service_tickets
    WHERE id = p_ticket_id;

    UPDATE service_tickets
    SET ticket_status = p_new_status
    WHERE id = p_ticket_id;

    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, NULL, 'status_changed',
        'service_tickets', p_ticket_id,
        json_build_object('ticket_status', v_old_status::TEXT)::TEXT,
        json_build_object('ticket_status', p_new_status::TEXT)::TEXT,
        NOW()
    );
END;
$$;


-- create_job_order_from_ticket(p_ticket_id, p_mechanic_id)
CREATE OR REPLACE FUNCTION create_job_order_from_ticket(
    p_ticket_id   INT,
    p_mechanic_id INT DEFAULT NULL
)
RETURNS TABLE (
    id          INT,
    ticket_id   INT,
    user_id     INT,
    vehicle_id  INT,
    jo_date     DATE,
    status      job_orders_status
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_user_id    INT;
    v_vehicle_id INT;
    v_jo_id      INT;
BEGIN
    -- Get the ticket details
    SELECT st.user_id, st.vehicle_id
    INTO v_user_id, v_vehicle_id
    FROM service_tickets st
    WHERE st.id = p_ticket_id;

    -- Mark the ticket as approved
    UPDATE service_tickets
    SET ticket_status = 'approved'
    WHERE service_tickets.id = p_ticket_id;

    -- Create the job order
    INSERT INTO job_orders (
        ticket_id, user_id, vehicle_id, jo_date,
        date_arrived, actual_grand_total, partial_payment, balance, status
    ) VALUES (
        p_ticket_id, v_user_id, v_vehicle_id, CURRENT_DATE,
        NOW(), 0, 0, 0, 'inspecting'
    )
    RETURNING job_orders.id INTO v_jo_id;

    -- Log the creation
    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, p_mechanic_id, 'created',
        'job_orders', v_jo_id,
        NULL,
        json_build_object(
            'ticket_id', p_ticket_id,
            'user_id', v_user_id,
            'vehicle_id', v_vehicle_id
        )::TEXT,
        NOW()
    );

    RETURN QUERY
    SELECT
        jo.id, jo.ticket_id, jo.user_id, jo.vehicle_id, jo.jo_date, jo.status
    FROM job_orders jo
    WHERE jo.id = v_jo_id;
END;
$$;


-- ============================================================
-- FILE: admin/admin_mechanics.sql
-- ============================================================
-- get_mechanics_list()
CREATE OR REPLACE FUNCTION get_mechanics_list()
RETURNS TABLE (
    id              INT,
    full_name       VARCHAR(70),
    email           VARCHAR(80),
    contact_number  VARCHAR(11),
    status          employee_status,
    branch          VARCHAR(100),
    location        VARCHAR(100),
    rank            VARCHAR(50),
    jobs_capacity   INTEGER,
    color           VARCHAR(100),
    active_jobs     BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        e.id,
        e.full_name,
        e.email,
        e.contact_number,
        e.status,
        ep.branch,
        ep.location,
        ep.rank,
        ep.jobs_capacity,
        ep.color,
        (SELECT COUNT(*)
         FROM system_audit_logs sal
         WHERE sal.employees_id = e.id
           AND sal.entity_type = 'job_orders'
           AND sal.action_performed = 'created'
        ) AS active_jobs
    FROM employees e
    LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
    WHERE e.role = 'mechanic'
    ORDER BY e.full_name ASC;
$$;


-- get_mechanic_detail(p_employee_id)
CREATE OR REPLACE FUNCTION get_mechanic_detail(p_employee_id INT)
RETURNS TABLE (
    id                 INT,
    full_name          VARCHAR(70),
    email              VARCHAR(80),
    contact_number     VARCHAR(11),
    hire_date          DATE,
    status             employee_status,
    branch             VARCHAR(100),
    location           VARCHAR(100),
    rank               VARCHAR(50),
    base_salary        DECIMAL(10,2),
    commission_percent DECIMAL(5,2),
    jobs_capacity      INTEGER,
    color              VARCHAR(100)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        e.id,
        e.full_name,
        e.email,
        e.contact_number,
        e.hire_date,
        e.status,
        ep.branch,
        ep.location,
        ep.rank,
        ep.base_salary,
        ep.commission_percent,
        ep.jobs_capacity,
        ep.color
    FROM employees e
    LEFT JOIN employee_profiles ep ON ep.employee_id = e.id
    WHERE e.id = p_employee_id;
$$;


-- get_mechanic_job_history(p_employee_id)
CREATE OR REPLACE FUNCTION get_mechanic_job_history(p_employee_id INT)
RETURNS TABLE (
    job_order_id   INT,
    jo_date        DATE,
    status         job_orders_status,
    actual_grand_total    DECIMAL(10,2),
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10),
    service_names  TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id          AS job_order_id,
        jo.jo_date,
        jo.status,
        jo.actual_grand_total,
        u.first_name,
        u.last_name,
        v.vehicle_model,
        v.plate_number,
        STRING_AGG(DISTINCT s.service_name, ', ') AS service_names
    FROM system_audit_logs sal
    JOIN job_orders jo ON jo.id = sal.entity_id
    JOIN users u       ON u.id = jo.user_id
    JOIN vehicles v    ON v.id = jo.vehicle_id
    LEFT JOIN job_order_services jos ON jos.job_order_id = jo.id
    LEFT JOIN services s             ON s.id = jos.service_id
    WHERE sal.employees_id = p_employee_id
      AND sal.entity_type = 'job_orders'
    GROUP BY jo.id, jo.jo_date, jo.status, jo.actual_grand_total,
             u.first_name, u.last_name, v.vehicle_model, v.plate_number
    ORDER BY jo.jo_date DESC;
$$;


-- ============================================================
-- FILE: admin/admin_overview.sql
-- ============================================================
-- get_admin_kpi_summary()
CREATE OR REPLACE FUNCTION get_admin_kpi_summary()
RETURNS TABLE (
    total_pending_tickets BIGINT,
    total_active_jobs     BIGINT,
    total_mechanics       BIGINT,
    total_revenue         DECIMAL
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        (SELECT COUNT(*) FROM service_tickets
         WHERE ticket_status = 'pending')
            AS total_pending_tickets,

        (SELECT COUNT(*) FROM job_orders
         WHERE status NOT IN ('completed', 'released'))
            AS total_active_jobs,

        (SELECT COUNT(*) FROM employees
         WHERE role = 'mechanic' AND status = 'active')
            AS total_mechanics,

        (SELECT COALESCE(SUM(amount_paid), 0) FROM payments
         WHERE payment_date >= DATE_TRUNC('month', CURRENT_DATE)
           AND verification_status = 'verified')
            AS total_revenue;
$$;


-- get_admin_revenue_trend(p_months)
CREATE OR REPLACE FUNCTION get_admin_revenue_trend(p_months INT DEFAULT 6)
RETURNS TABLE (
    month           DATE,
    total_revenue   DECIMAL,
    jobs_completed  BIGINT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        DATE_TRUNC('month', p.payment_date)::DATE AS month,
        COALESCE(SUM(p.amount_paid), 0)           AS total_revenue,
        COUNT(DISTINCT jo.id)                      AS jobs_completed
    FROM payments p
    JOIN job_orders jo ON jo.id = p.job_order_id
    WHERE p.payment_date >= DATE_TRUNC('month', CURRENT_DATE) - (p_months || ' months')::INTERVAL
      AND p.verification_status = 'verified'
    GROUP BY DATE_TRUNC('month', p.payment_date)
    ORDER BY month ASC;
$$;

-- get_admin_service_mix()
CREATE OR REPLACE FUNCTION get_admin_service_mix()
RETURNS TABLE (
    service_name   VARCHAR(70),
    service_count  BIGINT,
    percentage     NUMERIC
)
LANGUAGE SQL STABLE
AS $$
    WITH quarter_services AS (
        SELECT
            s.service_name,
            COUNT(jos.id) AS service_count
        FROM job_order_services jos
        JOIN services s ON s.id = jos.service_id
        JOIN job_orders jo ON jo.id = jos.job_order_id
        WHERE jo.jo_date >= DATE_TRUNC('quarter', CURRENT_DATE)
        GROUP BY s.service_name
    ),
    total AS (
        SELECT COALESCE(SUM(service_count), 1) AS cnt FROM quarter_services
    )
    SELECT
        qs.service_name,
        qs.service_count,
        ROUND((qs.service_count * 100.0) / t.cnt, 1) AS percentage
    FROM quarter_services qs
    CROSS JOIN total t
    ORDER BY qs.service_count DESC;
$$;


-- get_admin_active_customers()
CREATE OR REPLACE FUNCTION get_admin_active_customers()
RETURNS TABLE (
    job_order_id   INT,
    actual_grand_total    DECIMAL(10,2),
    balance        DECIMAL(10,2),
    status         job_orders_status,
    first_name     VARCHAR(40),
    last_name      VARCHAR(40),
    contact_number VARCHAR(11),
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id          AS job_order_id,
        jo.actual_grand_total,
        jo.balance,
        jo.status,
        u.first_name,
        u.last_name,
        u.contact_number,
        v.vehicle_model,
        v.plate_number
    FROM job_orders jo
    JOIN users u    ON u.id = jo.user_id
    JOIN vehicles v ON v.id = jo.vehicle_id
    WHERE jo.status NOT IN ('completed', 'released')
    ORDER BY jo.jo_date DESC;
$$;


-- update_job_order_status(p_job_order_id, p_new_status)
CREATE OR REPLACE FUNCTION update_job_order_status(
    p_job_order_id INT,
    p_new_status   job_orders_status
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_old_status job_orders_status;
BEGIN
    SELECT status INTO v_old_status
    FROM job_orders
    WHERE id = p_job_order_id;

    UPDATE job_orders
    SET status       = p_new_status,
        completed_at = CASE WHEN p_new_status = 'completed' THEN NOW() ELSE completed_at END,
        released_at  = CASE WHEN p_new_status = 'released'  THEN NOW() ELSE released_at  END,
        started_at   = CASE WHEN p_new_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END
    WHERE id = p_job_order_id;

    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, NULL, 'status_changed',
        'job_orders', p_job_order_id,
        json_build_object('status', v_old_status::TEXT)::TEXT,
        json_build_object('status', p_new_status::TEXT)::TEXT,
        NOW()
    );
END;
$$;


-- ============================================================
-- FILE: admin/admin_pre_diagnostics.sql
-- ============================================================
-- get_pre_diagnostic(p_job_order_id)
CREATE OR REPLACE FUNCTION get_pre_diagnostic(p_job_order_id INT)
RETURNS TABLE (
    id                        INT,
    mechanic_notes            TEXT,
    customer_approval_status  approval_status,
    datetime_created          TIMESTAMP,
    datetime_approved         TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        pd.id,
        pd.mechanic_notes,
        pd.customer_approval_status,
        pd.datetime_created,
        pd.datetime_approved
    FROM pre_diagnostics pd
    WHERE pd.job_order_id = p_job_order_id
    ORDER BY pd.datetime_created DESC;
$$;

-- update_pre_diagnostic_approval(p_id, p_status)
CREATE OR REPLACE FUNCTION update_pre_diagnostic_approval(
    p_id     INT,
    p_status approval_status
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE pre_diagnostics
    SET customer_approval_status = p_status,
        datetime_approved = CASE
            WHEN p_status = 'approved' THEN NOW()
            ELSE datetime_approved
        END
    WHERE id = p_id;
$$;


-- ============================================================
-- FILE: admin/admin_quotation.sql
-- ============================================================
-- get_quotation_for_job_order(p_job_order_id)
CREATE OR REPLACE FUNCTION get_quotation_for_job_order(p_job_order_id INT)
RETURNS TABLE (
    job_order_id    INT,
    actual_grand_total     DECIMAL(10,2),
    quotation_notes TEXT,
    services_total  DECIMAL,
    parts_total     DECIMAL(10,2)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id                AS job_order_id,
        jo.actual_grand_total,
        jo.quotation_notes,
        COALESCE((
            SELECT SUM(jos.actual_amount)
            FROM job_order_services jos
            WHERE jos.job_order_id = jo.id
        ), 0)                AS services_total,
        COALESCE((
            SELECT SUM(jop.total_retail_amount)
            FROM job_order_parts jop
            WHERE jop.job_order_id = jo.id
        ), 0)                AS parts_total
    FROM job_orders jo
    WHERE jo.id = p_job_order_id;
$$;

-- update_quotation_notes(p_job_order_id, p_notes)
CREATE OR REPLACE FUNCTION update_quotation_notes(
    p_job_order_id INT,
    p_notes        TEXT
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE job_orders
    SET quotation_notes = p_notes
    WHERE id = p_job_order_id;
$$;


-- ============================================================
-- FILE: admin/admin_sales_payroll.sql
-- ============================================================

-- get_payment_records()
CREATE OR REPLACE FUNCTION get_payment_records()
RETURNS TABLE (
    payment_id          INT,
    payment_method      payment_method,
    amount_paid         DECIMAL,
    payment_date        TIMESTAMP,
    verification_status payment_verification_status,
    job_order_id        INT,
    first_name          VARCHAR(40),
    last_name           VARCHAR(40)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        p.id              AS payment_id,
        p.payment_method,
        p.amount_paid,
        p.payment_date,
        p.verification_status,
        jo.id             AS job_order_id,
        u.first_name,
        u.last_name
    FROM payments p
    JOIN job_orders jo ON jo.id = p.job_order_id
    JOIN users u       ON u.id = jo.user_id
    ORDER BY p.payment_date DESC;
$$;

-- get_weekly_service_summary()
CREATE OR REPLACE FUNCTION get_weekly_service_summary()
RETURNS TABLE (
    service_name    VARCHAR(70),
    total_completed BIGINT,
    total_revenue   DECIMAL
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        s.service_name,
        COUNT(jos.id)          AS total_completed,
        COALESCE(SUM(jos.actual_amount), 0) AS total_revenue
    FROM job_order_services jos
    JOIN services s    ON s.id = jos.service_id
    JOIN job_orders jo ON jo.id = jos.job_order_id
    WHERE jo.completed_at >= DATE_TRUNC('week', CURRENT_DATE)
      AND jo.status IN ('completed', 'released')
    GROUP BY s.service_name
    ORDER BY total_revenue DESC;
$$;

-- get_payroll_summaries()
CREATE OR REPLACE FUNCTION get_payroll_summaries()
RETURNS TABLE (
    payroll_id      INT,
    full_name       VARCHAR(70),
    period_start    DATE,
    period_end      DATE,
    base_pay        DECIMAL(10,2),
    commission_pay  DECIMAL(10,2),
    deductions      DECIMAL(10,2),
    net_pay         DECIMAL(10,2),
    status          payroll_status_enum,
    payment_date    TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        ps.id           AS payroll_id,
        e.full_name,
        ps.period_start,
        ps.period_end,
        ps.base_pay,
        ps.commission_pay,
        ps.deductions,
        ps.net_pay,
        ps.status,
        ps.payment_date
    FROM payroll_summaries ps
    JOIN employees e ON e.id = ps.employee_id
    ORDER BY ps.period_end DESC, e.full_name ASC;
$$;


-- get_mechanic_payroll_detail(p_employee_id, p_period_start, p_period_end)
CREATE OR REPLACE FUNCTION get_mechanic_payroll_detail(
    p_employee_id  INT,
    p_period_start DATE,
    p_period_end   DATE
)
RETURNS TABLE (
    payroll_id      INT,
    full_name       VARCHAR(70),
    period_start    DATE,
    period_end      DATE,
    base_pay        DECIMAL(10,2),
    commission_pay  DECIMAL(10,2),
    deductions      DECIMAL(10,2),
    net_pay         DECIMAL(10,2),
    status          payroll_status_enum,
    date_generated  TIMESTAMP,
    payment_date    TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        ps.id           AS payroll_id,
        e.full_name,
        ps.period_start,
        ps.period_end,
        ps.base_pay,
        ps.commission_pay,
        ps.deductions,
        ps.net_pay,
        ps.status,
        ps.date_generated,
        ps.payment_date
    FROM payroll_summaries ps
    JOIN employees e ON e.id = ps.employee_id
    WHERE ps.employee_id = p_employee_id
      AND ps.period_start >= p_period_start
      AND ps.period_end   <= p_period_end
    ORDER BY ps.period_start ASC;
$$;


-- ============================================================
-- FILE: admin/admin_service_progress.sql
-- ============================================================
-- get_service_progress(p_job_order_id)
CREATE OR REPLACE FUNCTION get_service_progress(p_job_order_id INT)
RETURNS TABLE (
    id                    INT,
    activity_description  TEXT,
    log_time              TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        rpl.id,
        rpl.activity_description,
        rpl.log_time
    FROM repair_progress_logs rpl
    WHERE rpl.job_order_id = p_job_order_id
    ORDER BY rpl.log_time ASC;
$$;

-- add_progress_log(p_job_order_id, p_description)
CREATE OR REPLACE FUNCTION add_progress_log(
    p_job_order_id INT,
    p_description  TEXT
)
RETURNS TABLE (
    id                    INT,
    job_order_id          INT,
    activity_description  TEXT,
    log_time              TIMESTAMP
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO repair_progress_logs (
        job_order_id, activity_description, log_time
    ) VALUES (
        p_job_order_id, p_description, NOW()
    )
    RETURNING
        repair_progress_logs.id,
        repair_progress_logs.job_order_id,
        repair_progress_logs.activity_description,
        repair_progress_logs.log_time;
$$;

-- get_service_progress_tasks(p_job_order_id)
DROP FUNCTION IF EXISTS get_service_progress_tasks(INT);
CREATE OR REPLACE FUNCTION get_service_progress_tasks(p_job_order_id INT)
RETURNS TABLE (
    id            INT,
    section_id    section_type,
    task_title    VARCHAR(100),
    note          TEXT,
    task_status   VARCHAR,
    completed_at  TIMESTAMP,
    price         DECIMAL(10,2),
    billable      BOOLEAN,
    scheduled_date TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        spt.id,
        spt.section_id,
        spt.task_title,
        spt.note,
        spt.task_status,
        spt.completed_at,
        spt.scheduled_date
    FROM service_progress_tasks spt
    WHERE spt.job_order_id = p_job_order_id
    ORDER BY spt.section_id ASC, spt.id ASC;
$$;


-- update_service_progress_task(p_task_id, p_status)
CREATE OR REPLACE FUNCTION update_service_progress_task(
    p_task_id INT,
    p_status  VARCHAR
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE service_progress_tasks
    SET task_status  = p_status,
        completed_at = CASE
            WHEN p_status = 'completed' THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_task_id;
$$;

-- schedule_service_task_with_status
CREATE OR REPLACE FUNCTION schedule_service_task_with_status(
    p_task_id INT,
    p_scheduled_date TIMESTAMP,
    p_status  VARCHAR
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE service_progress_tasks
    SET task_status  = p_status,
        scheduled_date = p_scheduled_date,
        completed_at = CASE
            WHEN p_status = 'completed' THEN NOW()
            ELSE NULL
        END
    WHERE id = p_task_id;
$$;


-- ============================================================
-- FILE: customer/customer_billing.sql
-- ============================================================
-- get_customer_billing_services
CREATE OR REPLACE FUNCTION get_customer_billing_services(p_user_id INT)
RETURNS TABLE (
    job_order_id   INT,
    status         job_orders_status,
    actual_grand_total    DECIMAL(10,2),
    partial_payment DECIMAL(10,2),
    balance        DECIMAL(10,2),
    completed_at   TIMESTAMP,
    released_at    TIMESTAMP,
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10),
    payment_id     INT,
    payment_method payment_method,
    amount_paid    DECIMAL,
    payment_date   TIMESTAMP,
    verification_status payment_verification_status
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id          AS job_order_id,
        jo.status,
        jo.actual_grand_total,
        jo.partial_payment,
        jo.balance,
        jo.completed_at,
        jo.released_at,
        v.vehicle_model,
        v.plate_number,
        p.id           AS payment_id,
        p.payment_method,
        p.amount_paid,
        p.payment_date,
        p.verification_status
    FROM job_orders AS jo
    JOIN vehicles AS v 
	ON v.id = jo.vehicle_id
    LEFT JOIN payments AS p 
	ON p.job_order_id = jo.id
    WHERE jo.user_id = p_user_id
    ORDER BY jo.completed_at DESC NULLS LAST, p.payment_date DESC NULLS LAST;
$$;

-- get_customer_warranties(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_warranties(p_user_id INT)
RETURNS TABLE (
    warranty_id          INT,
    coverage_description TEXT,
    start_date           DATE,
    expiration_date      DATE,
    status               warranty_status,
    job_order_id         INT,
    completed_at         TIMESTAMP,
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        w.id           AS warranty_id,
        w.coverage_description,
        w.start_date,
        w.expiration_date,
        w.status,
        jo.id          AS job_order_id,
        jo.completed_at,
        v.vehicle_model,
        v.plate_number
    FROM warranties AS w
    JOIN job_orders AS jo 
	ON jo.id = w.job_order_id
    JOIN vehicles AS v    
	ON v.id  = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND w.status IN ('active', 'nearing_expiration')
    ORDER BY w.expiration_date ASC;
$$;


-- get_customer_warranty_history(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_warranty_history(p_user_id INT)
RETURNS TABLE (
    warranty_id          INT,
    coverage_description TEXT,
    start_date           DATE,
    expiration_date      DATE,
    status               warranty_status,
    job_order_id         INT,
    completed_at         TIMESTAMP,
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        w.id           AS warranty_id,
        w.coverage_description,
        w.start_date,
        w.expiration_date,
        w.status,
        jo.id          AS job_order_id,
        jo.completed_at,
        v.vehicle_model,
        v.plate_number
    FROM warranties AS w
    JOIN job_orders AS jo 
	ON jo.id = w.job_order_id
    JOIN vehicles AS v    
	ON v.id  = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND w.status IN ('expired', 'voided', 'claimed')
    ORDER BY w.expiration_date DESC;
$$;


-- get_customer_rewards(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_rewards(p_user_id INT)
RETURNS TABLE (
    loyalty_points  INTEGER,
    tier            user_tiers,
    reward_id       INT,
    reward_name     VARCHAR(100),
    cost_in_points  INTEGER,
    image_url       TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        u.loyalty_points,
        u.tier,
        rc.id          AS reward_id,
        rc.name        AS reward_name,
        rc.cost_in_points,
        rc.image_url
    FROM users AS u
    CROSS JOIN rewards_catalog AS rc
    WHERE u.id = p_user_id
    ORDER BY rc.cost_in_points ASC;
$$;


-- ============================================================
-- FILE: customer/customer_booking.sql
-- ============================================================
-- create_service_ticket()
CREATE OR REPLACE FUNCTION create_service_ticket(
    p_user_id          INT,
    p_vehicle_id       INT,
    p_service_mode     service_mode,
    p_home_address     VARCHAR(255),
    p_customer_concern TEXT
)
RETURNS TABLE (
    id                    INT,
    user_id               INT,
    vehicle_id            INT,
    service_mode          service_mode,
    home_service_address  VARCHAR(255),
    customer_concern      TEXT,
    ticket_status         ticket_status,
    request_date          TIMESTAMP
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO service_tickets (
        user_id,
        vehicle_id,
        service_mode,
        home_service_address,
        customer_concern,
        ticket_status,
        request_date
    ) VALUES (
        p_user_id,
        p_vehicle_id,
        p_service_mode,
        COALESCE(p_home_address, 'None'),
        p_customer_concern,
        'pending'::ticket_status,
        NOW()
    )
    RETURNING
        service_tickets.id,
        service_tickets.user_id,
        service_tickets.vehicle_id,
        service_tickets.service_mode,
        service_tickets.home_service_address,
        service_tickets.customer_concern,
        service_tickets.ticket_status,
        service_tickets.request_date;
$$;

-- get_customer_vehicles_for_booking(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_vehicles_for_booking(p_user_id INT)
RETURNS TABLE (
    id             INT,
    vehicle_model  VARCHAR(40),
    vehicle_year   INT,
    plate_number   VARCHAR(10),
    vehicle_type   VARCHAR(40)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        v.id,
        v.vehicle_model,
        v.vehicle_year,
        v.plate_number,
        v.vehicle_type
    FROM vehicles v
    WHERE v.user_id = p_user_id
    ORDER BY v.vehicle_model ASC;
$$;


-- get_available_services()
CREATE OR REPLACE FUNCTION get_available_services()
RETURNS TABLE (
    id                  INT,
    service_name        VARCHAR(70),
    description         TEXT,
    base_price          DECIMAL(10,2),
    base_duration_hours DECIMAL(10,2),
    is_price_fixed      BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        s.id,
        s.service_name,
        s.description,
        s.base_price,
        s.base_duration_hours,
        s.is_price_fixed
    FROM services s
    WHERE s.is_active = TRUE
    ORDER BY s.service_name ASC;
$$;


-- ============================================================
-- FILE: customer/customer_service_history.sql
-- ============================================================
-- get_customer_service_history(p_user_id)

CREATE OR REPLACE FUNCTION get_customer_service_history(p_user_id INT)
RETURNS TABLE (
    job_order_id   INT,
    jo_date        DATE,
    started_at     TIMESTAMP,
    completed_at   TIMESTAMP,
    status         job_orders_status,
    actual_grand_total    DECIMAL(10,2),
    vehicle_model  VARCHAR(40),
    vehicle_year   INT,
    plate_number   VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id          AS job_order_id,
        jo.jo_date,
        jo.started_at,
        jo.completed_at,
        jo.status,
        jo.actual_grand_total,
        v.vehicle_model,
        v.vehicle_year,
        v.plate_number
    FROM job_orders jo
    JOIN vehicles v ON v.id = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND jo.status IN ('completed', 'released')
    ORDER BY jo.completed_at DESC NULLS LAST;
$$;


-- get_shop_info()

CREATE OR REPLACE FUNCTION get_shop_info()
RETURNS TABLE (
    id               INT,
    name             VARCHAR(40),
    address          VARCHAR(255),
    contact_number   VARCHAR(11),
    email            VARCHAR(80),
    operating_hours  JSON
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        s.id,
        s.name,
        s.address,
        s.contact_number,
        s.email,
        s.operating_hours
    FROM shops s
    LIMIT 1;
$$;


-- ============================================================
-- FILE: Authenticate_user.sql
-- ============================================================
CREATE OR REPLACE FUNCTION get_authenticate_user(p_email VARCHAR, p_password VARCHAR)
RETURNS TABLE (
    id              INTEGER,
    email           VARCHAR,
    name            VARCHAR,
    role            VARCHAR
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY 
    SELECT 
        u.id, 
        u.email, 
        COALESCE(
            NULLIF(TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')), ''),
            u.nickname
        )::VARCHAR AS name,
        'customer'::VARCHAR AS role
    FROM users u
    WHERE u.email = p_email 
      AND u.password = p_password 
      AND TRIM(u.role) = 'customer';

    IF FOUND THEN
        RETURN;
    END IF;

    RETURN QUERY 
    SELECT
        e.id,
        e.email,
        e.full_name::VARCHAR AS name,
        'admin'::VARCHAR AS role
    FROM employees e
    WHERE e.email = p_email 
      AND e.password = p_password
      AND e.status = 'active';
END;
$$;

-- ============================================================
-- FILE: dashboard_functions.sql
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_user(p_user_id INTEGER)
RETURNS TABLE (
    id              INTEGER,
    nickname        VARCHAR,
    first_name      VARCHAR,
    last_name       VARCHAR,
    email           VARCHAR,
    contact_number  VARCHAR,
    address         VARCHAR,
    loyalty_points  INTEGER,
    tier            user_tiers
)
LANGUAGE sql STABLE
AS $$
    SELECT u.id, u.nickname, u.first_name, u.last_name, u.email,
           u.contact_number, u.address, u.loyalty_points, u.tier
    FROM users u
    WHERE u.id = p_user_id;
$$;



CREATE OR REPLACE FUNCTION get_dashboard_vehicles(p_user_id INTEGER)
RETURNS TABLE (
    id              INTEGER,
    vehicle_model   VARCHAR,
    vehicle_year    INTEGER,
    plate_number    VARCHAR,
    vehicle_type    VARCHAR,
    mileage         DECIMAL
)
LANGUAGE sql STABLE
AS $$
    SELECT DISTINCT ON (v.id)
        v.id, v.vehicle_model, v.vehicle_year, v.plate_number,
        v.vehicle_type, v.mileage
    FROM vehicles v
    LEFT JOIN job_orders jo ON jo.vehicle_id = v.id AND jo.user_id = p_user_id
    WHERE v.user_id = p_user_id OR jo.user_id = p_user_id
    ORDER BY v.id;
$$;



CREATE OR REPLACE FUNCTION get_dashboard_active_job_orders(p_user_id INTEGER)
RETURNS TABLE (
    id              INTEGER,
    status          TEXT,
    actual_grand_total     TEXT,
    balance         TEXT,
    jo_date         TEXT,
    vehicle_model   VARCHAR,
    vehicle_year    INTEGER,
    plate_number    VARCHAR,
    service_name    VARCHAR
)
LANGUAGE sql STABLE
AS $$
    SELECT
        jo.id,
        jo.status::text,
        jo.actual_grand_total::text,
        jo.balance::text,
        jo.jo_date::text,
        v.vehicle_model,
        v.vehicle_year,
        v.plate_number,
        (
            SELECT s.service_name
            FROM job_order_services jos
            JOIN services s ON s.id = jos.service_id
            WHERE jos.job_order_id = jo.id
            LIMIT 1
        ) AS service_name
    FROM job_orders jo
    JOIN vehicles v ON v.id = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND jo.status NOT IN ('released')
    ORDER BY jo.jo_date DESC
    LIMIT 6;
$$;


CREATE OR REPLACE FUNCTION get_dashboard_recent_activity(p_user_id INTEGER)
RETURNS TABLE (
    id              INTEGER,
    type            TEXT,
    title           TEXT,
    description     TEXT,
    job_time        TIMESTAMP,
    job_order_id    INTEGER
)
LANGUAGE sql STABLE
AS $$
    (
        SELECT
            p.id,
            'payment'::text AS type,
            'Payment Confirmed'::text AS title,
            ('Your payment of ₱ ' || TRIM(TO_CHAR(p.amount_paid, 'FM999,999,999.00'))
                || ' for Job Order #JO-' || p.job_order_id
                || ' (' || INITCAP(REPLACE(p.payment_method::text, '_', ' '))
                || ') has been successfully processed.')::text AS description,
            p.payment_date AS job_time,
            p.job_order_id
        FROM payments p
        JOIN job_orders jo ON jo.id = p.job_order_id
        WHERE jo.user_id = p_user_id AND p.verification_status = 'verified'
    )
    UNION ALL
    (
        SELECT
            rpl.id,
            'progress_log'::text AS type,
            'Repair Update'::text AS title,
            rpl.activity_description::text AS description,
            rpl.log_time AS job_time,
            rpl.job_order_id
        FROM repair_progress_logs rpl
        JOIN job_orders jo ON jo.id = rpl.job_order_id
        WHERE jo.user_id = p_user_id
    )
    UNION ALL
    (
        SELECT
            sal.id,
            'status_change'::text AS type,
            'Status Updated'::text AS title,
            ('Job Order #JO-' || sal.entity_id
                || ' status changed from '
                || COALESCE(sal.old_values::json->>'status', 'unknown')
                || ' to '
                || COALESCE(sal.new_values::json->>'status', 'unknown')
                || '.')::text AS description,
            sal.action_date AS job_time,
            sal.entity_id AS job_order_id
        FROM system_audit_logs sal
        WHERE sal.entity_type = 'job_orders'
          AND sal.action_performed = 'status_changed'
          AND sal.entity_id IN (SELECT jox.id FROM job_orders jox WHERE jox.user_id = p_user_id)
    )
    ORDER BY job_time DESC
    LIMIT 10;
$$;



CREATE OR REPLACE FUNCTION get_dashboard_shop()
RETURNS TABLE (
    id              INTEGER,
    name            VARCHAR,
    address         VARCHAR,
    contact_number  VARCHAR,
    email           VARCHAR,
    operating_hours JSON
)
LANGUAGE sql STABLE
AS $$
    SELECT s.id, s.name, s.address, s.contact_number, s.email, s.operating_hours
    FROM shops s
    ORDER BY s.id
    LIMIT 1;
$$;


-- ============================================================
-- FILE: new.sql
-- ============================================================
-- 1. Migrations
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS quotation_approved BOOLEAN DEFAULT false;
ALTER TABLE service_progress_tasks ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_progress_tasks ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

-- 2. Quotation Functions
CREATE OR REPLACE FUNCTION get_job_order_quotation(p_job_order_id integer)
RETURNS TABLE (
job_order_id INTEGER, quotation_notes TEXT, actual_grand_total TEXT, balance TEXT,
approval_status TEXT, mechanic_notes TEXT, datetime_created TEXT, datetime_approved TEXT
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.quotation_notes, jo.actual_grand_total::text, jo.balance::text,
pd.customer_approval_status::text, pd.mechanic_notes,
pd.datetime_created::text, pd.datetime_approved::text
FROM job_orders jo
LEFT JOIN pre_diagnostics pd ON pd.job_order_id = jo.id
WHERE jo.id = p_job_order_id
ORDER BY pd.datetime_created DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_job_order_quotation_services(p_job_order_id integer)
RETURNS TABLE (id INTEGER, service_name VARCHAR, description_of_work TEXT, estimated_hours NUMERIC, estimated_amount DECIMAL, actual_amount DECIMAL)
LANGUAGE sql STABLE
AS $$
SELECT jos.id, s.service_name, jos.description_of_work, jos.estimated_hours, jos.estimated_amount, jos.actual_amount
FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_parts_summary(p_job_order_id integer)
RETURNS TABLE (status TEXT, part_count BIGINT)
LANGUAGE sql STABLE
AS $$
SELECT status::text, COUNT(*)
FROM job_order_parts
WHERE job_order_id = p_job_order_id
GROUP BY status;
$$;

CREATE OR REPLACE FUNCTION set_quotation_approval(p_job_order_id integer, p_approved boolean)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE job_orders SET quotation_approved = p_approved WHERE id = p_job_order_id;
  
  IF p_approved THEN
    -- 1. DELETE pending tasks that are no longer in the quotation
    DELETE FROM service_progress_tasks
    WHERE job_order_id = p_job_order_id
      AND section_id = 'in_progress'
      AND task_status = 'pending'
      AND task_title NOT IN (
        SELECT service_name FROM get_job_order_quotation_services(p_job_order_id)
      );

    -- 2. UPDATE existing pending tasks with new price/note
    -- Include part totals in the price
    UPDATE service_progress_tasks spt
    SET price = sq.actual_amount::numeric + COALESCE((SELECT SUM(total_retail_amount) FROM job_order_parts WHERE job_order_service_id = sq.id), 0),
        note = sq.description_of_work
    FROM get_job_order_quotation_services(p_job_order_id) sq
    WHERE spt.job_order_id = p_job_order_id
      AND spt.section_id = 'in_progress'
      AND spt.task_status = 'pending'
      AND spt.task_title = sq.service_name;

    -- 3. INSERT new tasks
    INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable)
    SELECT p_job_order_id, 'in_progress', s.service_name, s.description_of_work, 'pending', s.actual_amount::numeric + COALESCE((SELECT SUM(total_retail_amount) FROM job_order_parts WHERE job_order_service_id = s.id), 0), true
    FROM get_job_order_quotation_services(p_job_order_id) s
    WHERE NOT EXISTS (
      SELECT 1 FROM service_progress_tasks 
      WHERE job_order_id = p_job_order_id AND task_title = s.service_name AND section_id = 'in_progress'
    );
  END IF;
END;
$$;

-- 3. Order Fetching Functions
CREATE OR REPLACE FUNCTION get_job_order_by_id(p_job_order_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, quotation_approved BOOLEAN, date_arrived TEXT,
started_at TEXT, date_promised TEXT, estimated_duration TEXT, actual_duration TEXT,
estimated_grand_total DECIMAL, actual_grand_total DECIMAL, balance TEXT, vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR, user_id INTEGER
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.quotation_approved, jo.date_arrived::text,
jo.started_at::text, jo.date_promised::text, jo.estimated_duration::text,
jo.actual_duration::text,
jo.estimated_grand_total, jo.actual_grand_total, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number, jo.user_id
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_customer_active_job_order(p_user_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, date_arrived TEXT, started_at TEXT, date_promised TEXT,
estimated_duration TEXT, actual_duration TEXT, actual_grand_total TEXT, balance TEXT,
vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.date_arrived::text, jo.started_at::text, jo.date_promised::text,
jo.estimated_duration::text, jo.actual_duration::text, jo.actual_grand_total::text, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.user_id = p_user_id
AND jo.status NOT IN ('released', 'completed')
ORDER BY jo.started_at DESC NULLS LAST
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_customer_completed_job_order(p_user_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, date_arrived TEXT, started_at TEXT, date_promised TEXT,
estimated_duration TEXT, actual_duration TEXT, actual_grand_total TEXT, balance TEXT,
vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.date_arrived::text, jo.started_at::text, jo.date_promised::text,
jo.estimated_duration::text, jo.actual_duration::text, jo.actual_grand_total::text, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.user_id = p_user_id
AND jo.status IN ('completed', 'released')
ORDER BY jo.started_at DESC NULLS LAST
LIMIT 1;
$$;

-- 4. In Progress & Inspection
CREATE OR REPLACE FUNCTION get_job_order_tasks(p_job_order_id INTEGER)
RETURNS TABLE (
id INTEGER, section_id TEXT, task_title VARCHAR, note TEXT, task_status TEXT,
completed_at TEXT, price TEXT, billable BOOLEAN, scheduled_date TIMESTAMP
)
LANGUAGE sql STABLE
AS $$
SELECT spt.id, spt.section_id::text, spt.task_title, spt.note,
spt.task_status, spt.completed_at::text, spt.price::text, spt.billable, spt.scheduled_date
FROM service_progress_tasks spt
WHERE spt.job_order_id = p_job_order_id
ORDER BY spt.id ASC;
$$;

DROP FUNCTION IF EXISTS get_service_progress_tasks(integer);
CREATE OR REPLACE FUNCTION get_service_progress_tasks(p_job_order_id integer)
RETURNS TABLE(id integer, section_id text, task_title text, note text, task_status text, completed_at timestamp without time zone, price numeric, billable boolean)
LANGUAGE sql
STABLE
AS $$
    SELECT
        spt.id,
        spt.section_id,
        spt.task_title,
        spt.note,
        spt.task_status,
        spt.completed_at,
        spt.price,
        spt.billable,
        spt.scheduled_date
    FROM service_progress_tasks spt
    WHERE spt.job_order_id = p_job_order_id
    ORDER BY spt.section_id ASC, spt.id ASC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_ticket_notes(p_job_order_id integer)
RETURNS TABLE (customer_concern TEXT)
LANGUAGE sql STABLE
AS $$
SELECT st.customer_concern
FROM job_orders jo
JOIN service_tickets st ON st.id = jo.ticket_id
WHERE jo.id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_vehicle_service_history(p_vehicle_id integer, p_exclude_job_order_id integer)
RETURNS TABLE (jo_date TEXT, service_name TEXT, actual_grand_total TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jo.jo_date::text,
(
SELECT s.service_name FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = jo.id LIMIT 1
) AS service_name,
jo.actual_grand_total::text
FROM job_orders jo
WHERE jo.vehicle_id = p_vehicle_id
AND jo.id != p_exclude_job_order_id
AND jo.status = 'released'
ORDER BY jo.jo_date DESC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_inspections(p_job_order_id integer)
RETURNS TABLE (
id INTEGER, name VARCHAR, status VARCHAR, photo TEXT, findings_description TEXT, logged_date TEXT
)
LANGUAGE sql STABLE
AS $$
SELECT vi.id, vi.name, vi.status, vi.photo, vi.findings_description, vi.logged_date::text
FROM vehicle_inspections vi
WHERE vi.job_order_id = p_job_order_id
ORDER BY vi.logged_date ASC;
$$;

-- 5. Payments
CREATE OR REPLACE FUNCTION submit_job_order_payment(p_job_order_id integer, p_payment_method payment_method, p_amount_paid numeric)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
v_payment_id integer;
BEGIN
INSERT INTO payments (job_order_id, payment_method, amount_paid, payment_date, verification_status)
VALUES (p_job_order_id, p_payment_method, p_amount_paid, NOW(), 'pending')
RETURNING id INTO v_payment_id;
RETURN v_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION get_job_order_payment_status(p_job_order_id integer)
RETURNS TABLE (id integer, payment_method text, amount_paid text, verification_status text, payment_date text)
LANGUAGE sql STABLE
AS $function$
SELECT p.id, p.payment_method::text, p.amount_paid::text, p.verification_status::text, p.payment_date::text
FROM payments p
WHERE p.job_order_id = p_job_order_id
ORDER BY p.payment_date DESC
LIMIT 1;
$function$;

-- 6. Completed
CREATE OR REPLACE FUNCTION get_job_order_repair_logs(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, activity_description TEXT, log_time TIMESTAMP)
LANGUAGE sql STABLE
AS $$
SELECT rpl.id, rpl.activity_description, rpl.log_time
FROM repair_progress_logs rpl
WHERE rpl.job_order_id = p_job_order_id
ORDER BY rpl.log_time ASC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_warranties(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, coverage_description TEXT, start_date TEXT, expiration_date TEXT, status TEXT)
LANGUAGE sql STABLE
AS $$
SELECT w.id, w.coverage_description, w.start_date::text, w.expiration_date::text, w.status::text
FROM warranties w
WHERE w.job_order_id = p_job_order_id
ORDER BY w.id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_invoice_services(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, service_name VARCHAR, description_of_work TEXT, estimated_hours NUMERIC, actual_hours NUMERIC, actual_amount TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jos.id, s.service_name, jos.description_of_work, jos.estimated_hours, jos.actual_hours, jos.actual_amount::text
FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = p_job_order_id
ORDER BY jos.id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_invoice_parts(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, description TEXT, quantity INTEGER, retail_unit_price TEXT, total_retail_amount TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jop.id, jop.description, jop.quantity, jop.retail_unit_price::text, jop.total_retail_amount::text
FROM job_order_parts jop
WHERE jop.job_order_id = p_job_order_id
ORDER BY jop.id;
$$;


