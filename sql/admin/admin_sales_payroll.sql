
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
        COALESCE(SUM(jos.amount), 0) AS total_revenue
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
