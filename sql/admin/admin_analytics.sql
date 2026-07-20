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
