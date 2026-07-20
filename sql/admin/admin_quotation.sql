-- get_quotation_for_job_order(p_job_order_id)
CREATE OR REPLACE FUNCTION get_quotation_for_job_order(p_job_order_id INT)
RETURNS TABLE (
    job_order_id    INT,
    grand_total     DECIMAL(10,2),
    quotation_notes TEXT,
    services_total  DECIMAL,
    parts_total     DECIMAL(10,2)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id                AS job_order_id,
        jo.grand_total,
        jo.quotation_notes,
        COALESCE((
            SELECT SUM(jos.amount)
            FROM job_order_services jos
            WHERE jos.job_order_id = jo.id
        ), 0)                AS services_total,
        COALESCE((
            SELECT SUM(jop.total_retail_amount)
            FROM job_order_parts jop
            WHERE jop.job_order_id = jo.id
        ), 0)                AS parts_total
    FROM job_orders jo
    WHERE jo.id = p_job_order_id;
$$;

-- update_quotation_notes(p_job_order_id, p_notes)
CREATE OR REPLACE FUNCTION update_quotation_notes(
    p_job_order_id INT,
    p_notes        TEXT
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE job_orders
    SET quotation_notes = p_notes
    WHERE id = p_job_order_id;
$$;
