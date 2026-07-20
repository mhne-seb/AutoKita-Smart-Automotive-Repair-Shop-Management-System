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
    grand_total     TEXT,
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
        jo.grand_total::text,
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
