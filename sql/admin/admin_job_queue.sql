-- get_service_tickets_queue()

CREATE OR REPLACE FUNCTION get_service_tickets_queue()
RETURNS TABLE (
    id                   INT,
    service_mode         service_mode,
    customer_concern     TEXT,
    ticket_status        ticket_status,
    request_date         TIMESTAMP,
    first_name           VARCHAR(40),
    last_name            VARCHAR(40),
    contact_number       VARCHAR(11),
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        st.id,
        st.service_mode,
        st.customer_concern,
        st.ticket_status,
        st.request_date,
        u.first_name,
        u.last_name,
        u.contact_number,
        v.vehicle_model,
        v.plate_number
    FROM service_tickets st
    JOIN users u    ON u.id = st.user_id
    JOIN vehicles v ON v.id = st.vehicle_id
    WHERE st.ticket_status IN ('pending', 'queued')
    ORDER BY st.request_date ASC;
$$;


-- update_ticket_status(p_ticket_id, p_new_status)
CREATE OR REPLACE FUNCTION update_ticket_status(
    p_ticket_id  INT,
    p_new_status ticket_status
)
RETURNS VOID
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_old_status ticket_status;
BEGIN
    SELECT ticket_status INTO v_old_status
    FROM service_tickets
    WHERE id = p_ticket_id;

    UPDATE service_tickets
    SET ticket_status = p_new_status
    WHERE id = p_ticket_id;

    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, NULL, 'status_changed',
        'service_tickets', p_ticket_id,
        json_build_object('ticket_status', v_old_status::TEXT)::TEXT,
        json_build_object('ticket_status', p_new_status::TEXT)::TEXT,
        NOW()
    );
END;
$$;


-- create_job_order_from_ticket(p_ticket_id, p_mechanic_id)
CREATE OR REPLACE FUNCTION create_job_order_from_ticket(
    p_ticket_id   INT,
    p_mechanic_id INT DEFAULT NULL
)
RETURNS TABLE (
    id          INT,
    ticket_id   INT,
    user_id     INT,
    vehicle_id  INT,
    jo_date     DATE,
    status      job_orders_status
)
LANGUAGE plpgsql VOLATILE
AS $$
DECLARE
    v_user_id    INT;
    v_vehicle_id INT;
    v_jo_id      INT;
BEGIN
    -- Get the ticket details
    SELECT st.user_id, st.vehicle_id
    INTO v_user_id, v_vehicle_id
    FROM service_tickets st
    WHERE st.id = p_ticket_id;

    -- Mark the ticket as approved
    UPDATE service_tickets
    SET ticket_status = 'approved'
    WHERE service_tickets.id = p_ticket_id;

    -- Create the job order
    INSERT INTO job_orders (
        ticket_id, user_id, vehicle_id, jo_date,
        date_arrived, grand_total, partial_payment, balance, status
    ) VALUES (
        p_ticket_id, v_user_id, v_vehicle_id, CURRENT_DATE,
        NOW(), 0, 0, 0, 'inspecting'
    )
    RETURNING job_orders.id INTO v_jo_id;

    -- Log the creation
    INSERT INTO system_audit_logs (
        user_id, employees_id, action_performed,
        entity_type, entity_id, old_values, new_values, action_date
    ) VALUES (
        NULL, p_mechanic_id, 'created',
        'job_orders', v_jo_id,
        NULL,
        json_build_object(
            'ticket_id', p_ticket_id,
            'user_id', v_user_id,
            'vehicle_id', v_vehicle_id
        )::TEXT,
        NOW()
    );

    RETURN QUERY
    SELECT
        jo.id, jo.ticket_id, jo.user_id, jo.vehicle_id, jo.jo_date, jo.status
    FROM job_orders jo
    WHERE jo.id = v_jo_id;
END;
$$;
