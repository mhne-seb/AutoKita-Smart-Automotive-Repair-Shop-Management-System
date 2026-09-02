DO $$ 
DECLARE 
    v_user_id INT;
    v_vios_vehicle_id INT;
    v_hilux_vehicle_id INT;
    v_vios_ticket_id INT;
    v_hilux_ticket_id INT;
    v_vios_jo_id INT;
    v_hilux_jo_id INT;
BEGIN
    
    SELECT id INTO v_user_id FROM users LIMIT 1;
    IF v_user_id IS NULL THEN
        INSERT INTO users (email, nickname, first_name, last_name, contact_number, registration_date, tier, role)
        VALUES ('testchatbot@example.com', 'testuser', 'Test', 'User', '09123456789', NOW(), 'New', 'customer')
        RETURNING id INTO v_user_id;
    END IF;

    
    INSERT INTO vehicles (user_id, vin, plate_number, vehicle_make, vehicle_model, vehicle_year, mileage, vehicle_type)
    VALUES (v_user_id, 'VINVIOS2011XXXXXX', 'VIO-2011', 'Toyota', 'Vios', 2011, 85000.50, 'Sedan')
    RETURNING id INTO v_vios_vehicle_id;

    
    INSERT INTO vehicles (user_id, vin, plate_number, vehicle_make, vehicle_model, vehicle_year, mileage, vehicle_type)
    VALUES (v_user_id, 'VINHILUX2011XXXXX', 'HIL-2011', 'Toyota', 'Hilux', 2011, 120000.00, 'Pickup')
    RETURNING id INTO v_hilux_vehicle_id;

    
    INSERT INTO service_tickets (user_id, vehicle_id, service_mode, customer_concern, ticket_status, request_date)
    VALUES (v_user_id, v_vios_vehicle_id, 'walk_in', 'Engine makes weird noise and needs under cover checking', 'approved', NOW())
    RETURNING id INTO v_vios_ticket_id;

    INSERT INTO service_tickets (user_id, vehicle_id, service_mode, customer_concern, ticket_status, request_date)
    VALUES (v_user_id, v_hilux_vehicle_id, 'walk_in', 'Frame inspection and general checkup', 'approved', NOW())
    RETURNING id INTO v_hilux_ticket_id;

    
    INSERT INTO job_orders (ticket_id, user_id, vehicle_id, jo_date, status, estimated_duration, estimated_grand_total, actual_grand_total)
    VALUES (v_vios_ticket_id, v_user_id, v_vios_vehicle_id, CURRENT_DATE, 'in_progress', '02:00:00', 3500.00, 3500.00)
    RETURNING id INTO v_vios_jo_id;

    INSERT INTO job_orders (ticket_id, user_id, vehicle_id, jo_date, status, estimated_duration, estimated_grand_total, actual_grand_total)
    VALUES (v_hilux_ticket_id, v_user_id, v_hilux_vehicle_id, CURRENT_DATE, 'pending_customer_approval', '03:30:00', 8000.00, 0.00)
    RETURNING id INTO v_hilux_jo_id;

    
    INSERT INTO job_order_services (job_order_id, service_id, description_of_work, estimated_amount, actual_amount, estimated_hours)
    VALUES 
        (v_vios_jo_id, 5, 'Vios Engine Diagnostics', 2000.00, 2000.00, 1.5),
        (v_vios_jo_id, 1, 'Oil Change for Vios', 1500.00, 1500.00, 0.5);

    INSERT INTO job_order_services (job_order_id, service_id, description_of_work, estimated_amount, actual_amount, estimated_hours)
    VALUES 
        (v_hilux_jo_id, 2, 'Brake Pad Replacement for Hilux', 3500.00, 3500.00, 1.5),
        (v_hilux_jo_id, 6, 'Battery Testing & Replacement', 4500.00, 4500.00, 2.0);

    
    
    INSERT INTO job_order_parts (job_order_id, status, part_number, description, quantity, retail_unit_price, total_retail_amount)
    VALUES 
        (v_vios_jo_id, 'installed', '51441-0D120', 'COVER, ENGINE UNDER, RH', 1, 1500.00, 1500.00),
        (v_vios_jo_id, 'ordered', '90189-06076', 'GROMMET, SCREW, NO.1', 4, 50.00, 200.00);

   
    INSERT INTO job_order_parts (job_order_id, status, part_number, description, quantity, retail_unit_price, total_retail_amount)
    VALUES 
        (v_hilux_jo_id, 'to_order', '51001-0K073', 'FRAME SUB-ASSY', 1, 45000.00, 45000.00);

    
    INSERT INTO vehicle_inspections (job_order_id, name, notes, findings_description, logged_date)
    VALUES 
        (v_vios_jo_id, 'Underchassis Inspection', 'Found right hand engine under cover to be missing.', 'Missing under cover RH, need replacement.', NOW()),
        (v_vios_jo_id, 'Engine Check', 'Engine sounds normal, but missing grommets cause rattle.', '4 grommets missing on suspension crossmember.', NOW());

    INSERT INTO vehicle_inspections (job_order_id, name, notes, findings_description, logged_date)
    VALUES 
        (v_hilux_jo_id, 'Frame Inspection', 'Severe rust on frame sub-assy.', 'Frame sub-assy needs replacement due to corrosion.', NOW()),
        (v_hilux_jo_id, 'Brake Check', 'Brake pads worn down to 2mm.', 'Replace front brake pads.', NOW());

    RAISE NOTICE 'Successfully created test Job Orders. Vios JO ID: %, Hilux JO ID: %', v_vios_jo_id, v_hilux_jo_id;
END $$;
