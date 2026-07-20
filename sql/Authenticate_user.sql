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