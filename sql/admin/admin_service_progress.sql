-- get_service_progress(p_job_order_id)
CREATE OR REPLACE FUNCTION get_service_progress(p_job_order_id INT)
RETURNS TABLE (
    id                    INT,
    activity_description  TEXT,
    log_time              TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        rpl.id,
        rpl.activity_description,
        rpl.log_time
    FROM repair_progress_logs rpl
    WHERE rpl.job_order_id = p_job_order_id
    ORDER BY rpl.log_time ASC;
$$;

-- add_progress_log(p_job_order_id, p_description)
CREATE OR REPLACE FUNCTION add_progress_log(
    p_job_order_id INT,
    p_description  TEXT
)
RETURNS TABLE (
    id                    INT,
    job_order_id          INT,
    activity_description  TEXT,
    log_time              TIMESTAMP
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO repair_progress_logs (
        job_order_id, activity_description, log_time
    ) VALUES (
        p_job_order_id, p_description, NOW()
    )
    RETURNING
        repair_progress_logs.id,
        repair_progress_logs.job_order_id,
        repair_progress_logs.activity_description,
        repair_progress_logs.log_time;
$$;

-- get_service_progress_tasks(p_job_order_id)
CREATE OR REPLACE FUNCTION get_service_progress_tasks(p_job_order_id INT)
RETURNS TABLE (
    id            INT,
    section_id    section_type,
    task_title    VARCHAR(100),
    note          TEXT,
    task_status   VARCHAR,
    completed_at  TIMESTAMP
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        spt.id,
        spt.section_id,
        spt.task_title,
        spt.note,
        spt.task_status,
        spt.completed_at
    FROM service_progress_tasks spt
    WHERE spt.job_order_id = p_job_order_id
    ORDER BY spt.section_id ASC, spt.id ASC;
$$;


-- update_service_progress_task(p_task_id, p_status)
CREATE OR REPLACE FUNCTION update_service_progress_task(
    p_task_id INT,
    p_status  VARCHAR
)
RETURNS VOID
LANGUAGE SQL VOLATILE
AS $$
    UPDATE service_progress_tasks
    SET task_status  = p_status,
        completed_at = CASE
            WHEN p_status = 'completed' THEN NOW()
            ELSE completed_at
        END
    WHERE id = p_task_id;
$$;
