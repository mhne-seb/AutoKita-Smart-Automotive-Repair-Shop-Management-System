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
