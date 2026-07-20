-- get_job_orders_list()
CREATE OR REPLACE FUNCTION get_job_orders_list()
RETURNS TABLE (
    id             INT,
    jo_date        DATE,
    status         job_orders_status,
    grand_total    DECIMAL(10,2),	
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
        jo.grand_total,
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
    grand_total        DECIMAL(10,2),
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
        jo.grand_total,
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
CREATE OR REPLACE FUNCTION get_job_order_services(p_job_order_id INT)
RETURNS TABLE (
    id                  INT,
    service_name        VARCHAR(70),
    description_of_work TEXT,
    estimated_duration  TIME,
    actual_duration     TIME,
    estimated_hours     INT,
    actual_hours        INT,
    amount              DECIMAL
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
        jos.amount
    FROM job_order_services jos
    JOIN services s ON s.id = jos.service_id
    WHERE jos.job_order_id = p_job_order_id
    ORDER BY jos.id ASC;
$$;

	
-- get_job_order_parts(p_job_order_id)

CREATE OR REPLACE FUNCTION get_job_order_parts(p_job_order_id INT)
RETURNS TABLE (
    id                  INT,
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
    p_estimated_hours  INT DEFAULT NULL
)
RETURNS TABLE (
    id                  INT,
    job_order_id        INT,
    service_id          INT,
    description_of_work TEXT,
    amount              DECIMAL
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO job_order_services (
        job_order_id, service_id, description_of_work,
        amount, estimated_duration, estimated_hours
    ) VALUES (
        p_job_order_id, p_service_id, p_description,
        p_amount, p_estimated_duration, p_estimated_hours
    )
    RETURNING
        job_order_services.id,
        job_order_services.job_order_id,
        job_order_services.service_id,
        job_order_services.description_of_work,
        job_order_services.amount;
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
