-- get_customer_service_history(p_user_id)

CREATE OR REPLACE FUNCTION get_customer_service_history(p_user_id INT)
RETURNS TABLE (
    job_order_id   INT,
    jo_date        DATE,
    started_at     TIMESTAMP,
    completed_at   TIMESTAMP,
    status         job_orders_status,
    grand_total    DECIMAL(10,2),
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
        jo.grand_total,
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
