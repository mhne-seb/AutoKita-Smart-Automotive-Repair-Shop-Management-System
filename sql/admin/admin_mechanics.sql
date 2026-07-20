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
    grand_total    DECIMAL(10,2),
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
        jo.grand_total,
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
    GROUP BY jo.id, jo.jo_date, jo.status, jo.grand_total,
             u.first_name, u.last_name, v.vehicle_model, v.plate_number
    ORDER BY jo.jo_date DESC;
$$;
