-- get_pre_diagnostic(p_job_order_id)
CREATE OR REPLACE FUNCTION get_pre_diagnostic(p_job_order_id INT)
RETURNS TABLE (
    id                        INT,
    mechanic_notes            TEXT,
    customer_approval_status  approval_status,
    datetime_created          TIMESTAMP,
    datetime_approved         TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        pd.id,
        pd.mechanic_notes,
        pd.customer_approval_status,
        pd.datetime_created,
        pd.datetime_approved
    FROM pre_diagnostics pd
    WHERE pd.job_order_id = p_job_order_id
    ORDER BY pd.datetime_created DESC;
$$;

-- update_pre_diagnostic_approval(p_id, p_status)
CREATE OR REPLACE FUNCTION update_pre_diagnostic_approval(
    p_id     INT,
    p_status approval_status
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE pre_diagnostics
    SET customer_approval_status = p_status,
        datetime_approved = CASE
            WHEN p_status = 'approved' THEN NOW()
            ELSE datetime_approved
        END
    WHERE id = p_id;
$$;
