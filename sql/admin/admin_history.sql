-- get_job_order_history()
CREATE OR REPLACE FUNCTION get_job_order_history()
RETURNS TABLE (
    id             INT,
    jo_date        DATE,
    completed_at   TIMESTAMP,
    status         job_orders_status,
    grand_total    DECIMAL(10,2),
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
        jo.grand_total,
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
        COALESCE(SUM(jo.grand_total), 0) AS total_spent,
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
