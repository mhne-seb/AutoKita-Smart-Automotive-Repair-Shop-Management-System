-- create_service_ticket()
CREATE OR REPLACE FUNCTION create_service_ticket(
    p_user_id          INT,
    p_vehicle_id       INT,
    p_service_mode     service_mode,
    p_home_address     VARCHAR(255),
    p_customer_concern TEXT
)
RETURNS TABLE (
    id                    INT,
    user_id               INT,
    vehicle_id            INT,
    service_mode          service_mode,
    home_service_address  VARCHAR(255),
    customer_concern      TEXT,
    ticket_status         ticket_status,
    request_date          TIMESTAMP
)
LANGUAGE SQL VOLATILE
AS $$
    INSERT INTO service_tickets (
        user_id,
        vehicle_id,
        service_mode,
        home_service_address,
        customer_concern,
        ticket_status,
        request_date
    ) VALUES (
        p_user_id,
        p_vehicle_id,
        p_service_mode,
        COALESCE(p_home_address, 'None'),
        p_customer_concern,
        'pending'::ticket_status,
        NOW()
    )
    RETURNING
        service_tickets.id,
        service_tickets.user_id,
        service_tickets.vehicle_id,
        service_tickets.service_mode,
        service_tickets.home_service_address,
        service_tickets.customer_concern,
        service_tickets.ticket_status,
        service_tickets.request_date;
$$;

-- get_customer_vehicles_for_booking(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_vehicles_for_booking(p_user_id INT)
RETURNS TABLE (
    id             INT,
    vehicle_model  VARCHAR(40),
    vehicle_year   INT,
    plate_number   VARCHAR(10),
    vehicle_type   VARCHAR(40)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        v.id,
        v.vehicle_model,
        v.vehicle_year,
        v.plate_number,
        v.vehicle_type
    FROM vehicles v
    WHERE v.user_id = p_user_id
    ORDER BY v.vehicle_model ASC;
$$;


-- get_available_services()
CREATE OR REPLACE FUNCTION get_available_services()
RETURNS TABLE (
    id                  INT,
    service_name        VARCHAR(70),
    description         TEXT,
    base_price          DECIMAL(10,2),
    base_duration_hours DECIMAL(10,2),
    is_price_fixed      BOOLEAN
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        s.id,
        s.service_name,
        s.description,
        s.base_price,
        s.base_duration_hours,
        s.is_price_fixed
    FROM services s
    WHERE s.is_active = TRUE
    ORDER BY s.service_name ASC;
$$;
