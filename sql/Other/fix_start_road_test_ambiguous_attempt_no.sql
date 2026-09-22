-- Fix: start_road_test() failed with
--   column reference "attempt_no" is ambiguous
-- The function RETURNS TABLE (road_test_id INT, attempt_no INT), so inside
-- the body `attempt_no` can mean the OUT column or the road_tests column.
-- Qualifying the table column (rt.attempt_no) removes the ambiguity.
-- Body is otherwise identical to the original.

CREATE OR REPLACE FUNCTION start_road_test(
    p_job_order_id INT,
    p_tester_id    INT
)
RETURNS TABLE (road_test_id INT, attempt_no INT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unfinished_count INT;
    v_next_attempt     INT;
    v_new_id           INT;
BEGIN
    SELECT COUNT(*) INTO v_unfinished_count
    FROM service_progress_tasks spt
    WHERE spt.job_order_id = p_job_order_id AND spt.task_status NOT IN ('completed');
    IF v_unfinished_count > 0 THEN
        RAISE EXCEPTION 'Cannot start road test: % task(s) are still unfinished.', v_unfinished_count;
    END IF;
    IF EXISTS (SELECT 1 FROM road_tests rt WHERE rt.job_order_id = p_job_order_id AND rt.ended_at IS NULL) THEN
        RAISE EXCEPTION 'A road test attempt is already in progress for this job order.';
    END IF;
    SELECT COALESCE(MAX(rt.attempt_no), 0) + 1 INTO v_next_attempt
    FROM road_tests rt
    WHERE rt.job_order_id = p_job_order_id;
    INSERT INTO road_tests (job_order_id, attempt_no, tester_id, started_at)
    VALUES (p_job_order_id, v_next_attempt, p_tester_id, NOW())
    RETURNING id INTO v_new_id;

    PERFORM advance_job_order_stage(p_job_order_id, 'testing'::job_orders_status);

    INSERT INTO system_audit_logs (
        employees_id,
        action_performed,
        entity_type,
        entity_id,
        new_values,
        action_date
    ) VALUES (
        p_tester_id,
        'created'::audit_action_enum,
        'road_tests',
        v_new_id,
        jsonb_build_object(
            'event', 'road_test_started',
            'job_order_id', p_job_order_id,
            'attempt_no', v_next_attempt,
            'tester_id', p_tester_id
        )::text,
        NOW()
    );
    RETURN QUERY SELECT v_new_id, v_next_attempt;
END;
$$;
