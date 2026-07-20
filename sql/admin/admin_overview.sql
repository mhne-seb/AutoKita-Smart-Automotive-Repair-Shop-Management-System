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
    grand_total    DECIMAL(10,2),
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
        jo.grand_total,
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
