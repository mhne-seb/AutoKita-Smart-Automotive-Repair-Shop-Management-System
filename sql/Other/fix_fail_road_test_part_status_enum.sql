-- Fix: fail_road_test() failed with
--   type "part_status" does not exist
-- The warranty-replacement INSERT cast the status as ::part_status, but the
-- enum on job_order_parts.status is named job_order_parts_status. That's the
-- only change; the body is otherwise the deployed original.

CREATE OR REPLACE FUNCTION fail_road_test(p_road_test_id integer, p_notes text, p_rework_task_ids integer[], p_failed_part_ids integer[] DEFAULT '{}'::integer[], p_photo_url text DEFAULT NULL::text, p_extra_cost numeric DEFAULT 0, p_extra_service_ids integer[] DEFAULT '{}'::integer[], p_extra_part_ids integer[] DEFAULT '{}'::integer[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_job_order_id INT;
    v_tester_id    INT;
    v_attempt_no   INT;
    v_prev_photos  TEXT[];
    v_part_record  RECORD;
    v_task_id      INT;
    v_new_part_id  INT;
BEGIN
    SELECT job_order_id, tester_id, attempt_no 
    INTO v_job_order_id, v_tester_id, v_attempt_no
    FROM road_tests
    WHERE id = p_road_test_id AND ended_at IS NULL;
    IF v_job_order_id IS NULL THEN
        RAISE EXCEPTION 'Road test #% is not in progress or does not exist.', p_road_test_id;
    END IF;
    IF p_rework_task_ids IS NULL OR array_length(p_rework_task_ids, 1) = 0 THEN
        RAISE EXCEPTION 'Road test failure requires at least one service to rework.';
    END IF;
    
    SELECT array_agg(completion_photo_url ORDER BY id)
    INTO v_prev_photos
    FROM service_progress_tasks
    WHERE id = ANY(p_rework_task_ids);
    
    FOREACH v_task_id IN ARRAY p_rework_task_ids
    LOOP
        UPDATE service_progress_tasks
        SET task_status  = 'in_progress',
            completed_at = NULL,
            rework_count = rework_count + 1
        WHERE id = v_task_id;
        INSERT INTO system_audit_logs (
            employees_id,
            action_performed,
            entity_type,
            entity_id,
            old_values,
            new_values,
            action_date
        ) VALUES (
            v_tester_id,
            'status_changed'::audit_action_enum,
            'service_progress_tasks',
            v_task_id,
            jsonb_build_object('task_status', 'completed')::text,
            jsonb_build_object('task_status', 'in_progress', 'reopen_reason', p_notes)::text,
            NOW()
        );
    END LOOP;
    
    IF p_failed_part_ids IS NOT NULL AND array_length(p_failed_part_ids, 1) > 0 THEN
        FOR v_part_record IN
            SELECT * FROM job_order_parts WHERE id = ANY(p_failed_part_ids)
        LOOP
            INSERT INTO job_order_parts (
                job_order_id,
                job_order_service_id,
                part_number,
                description,
                quantity,
                retail_unit_price,
                total_retail_amount,
                supplier_unit_cost,
                status,
                is_oem,
                tier,
                replaces_part_id,
                is_warranty_replacement
            ) VALUES (
                v_part_record.job_order_id,
                v_part_record.job_order_service_id,
                v_part_record.part_number,
                v_part_record.description || ' (Warranty Replacement)',
                v_part_record.quantity,
                0, 0, 0,
                'to_order'::job_order_parts_status,
                v_part_record.is_oem,
                v_part_record.tier,
                v_part_record.id,
                TRUE
            )
            RETURNING id INTO v_new_part_id;
            
            INSERT INTO system_audit_logs (
                employees_id,
                action_performed,
                entity_type,
                entity_id,
                new_values,
                action_date
            ) VALUES (
                v_tester_id,
                'created'::audit_action_enum,
                'job_order_parts',
                v_new_part_id,
                jsonb_build_object(
                    'event', 'warranty_replacement_issued',
                    'part_number', v_part_record.part_number,
                    'price', 0,
                    'replaces_part_id', v_part_record.id
                )::text,
                NOW()
            );
        END LOOP;
    END IF;
    
    UPDATE road_tests
    SET result             = 'fail'::road_test_result,
        ended_at           = NOW(),
        notes              = p_notes,
        photo_url          = p_photo_url,
        rework_task_ids    = p_rework_task_ids,
        rework_prev_photos = v_prev_photos,
        failed_part_ids    = p_failed_part_ids,
        extra_service_ids  = p_extra_service_ids,
        extra_part_ids     = p_extra_part_ids,
        extra_cost         = p_extra_cost,
        extra_decision     = CASE WHEN p_extra_cost > 0 THEN 'pending'::approval_status ELSE NULL END
    WHERE id = p_road_test_id;
    
    INSERT INTO system_audit_logs (
        employees_id,
        action_performed,
        entity_type,
        entity_id,
        new_values,
        action_date
    ) VALUES (
        v_tester_id,
        'status_changed'::audit_action_enum,
        'road_tests',
        p_road_test_id,
        jsonb_build_object(
            'event', 'road_test_failed',
            'attempt_no', v_attempt_no,
            'notes', p_notes,
            'rework_tasks_count', array_length(p_rework_task_ids, 1),
            'failed_parts_count', COALESCE(array_length(p_failed_part_ids, 1), 0),
            'extra_cost', p_extra_cost
        )::text,
        NOW()
    );
    
    IF p_extra_cost > 0 THEN
        PERFORM advance_job_order_stage(v_job_order_id, 'revision_pending'::job_orders_status);
    ELSE
        PERFORM advance_job_order_stage(v_job_order_id, 'in_progress'::job_orders_status);
    END IF;
    RETURN TRUE;
END;
$function$
