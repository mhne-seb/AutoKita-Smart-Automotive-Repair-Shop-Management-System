-- This SQL is mainly for creating dummy data for testing of website interaction, stored procedures, and verification

-- Removed id since it is auto-incrementing, change to varchar(36) if wanted gen_random_uuid() instead
-- PostgreSQL has no CTE recursion limit by default; no SET needed

-- Users 1
INSERT INTO users ( 
				   email, 
                   nickname, 
                   password, 
                   first_name,
                   last_name,
                   contact_number,
                   address,
                   registration_date,
				   loyalty_points,
				   tier
				   )
SELECT
	-- email
    CONCAT(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),
    '@',
    'example.com'), -- NOTE: Could use (ARRAY['gmail.com', 'yahoo.com', 'hotmail.com'])[1 + FLOOR(RANDOM() * 3)::INT]
	
    -- nickname
    SUBSTRING(MD5(RANDOM()::TEXT) FROM (1 + FLOOR(RANDOM() * 2))::INT FOR (3 + FLOOR(RANDOM() * 3))::INT), 
    
    -- password
    CONCAT('placeholder', n), 
    
    -- first_name
    (ARRAY['Lei', 'Jarell', 'Leo', 'Mhaine', 'Jonas', 'Roman', 'Lance', 'Joshua'])[1 + FLOOR(RANDOM() * 8)::INT],
    
    -- last_name
    (ARRAY['Camorongan', 'Fababier', 'Aceitunas', 'Sebido', 'Jamot', 'Lopez', 'Dayawon', 'Reyes'])[1 + FLOOR(RANDOM() * 8)::INT], 
    
    -- phone_number
    CONCAT('09',
           FLOOR(10 + (RANDOM()*90))::INT,
           FLOOR(100 + (RANDOM()*900))::INT,
           LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0')
           ), 
   -- address
   CONCAT(
		FLOOR(1 + RANDOM() * 9999)::INT, ' ', 
		(ARRAY['Mabini', 'Rizal', 'Luna', 'Bonifacio', 'Taft'])[1 + FLOOR(RANDOM() * 5)::INT], ' St., ', 
		(ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig'])[1 + FLOOR(RANDOM() * 5)::INT]
   ), 
   -- registration_date (Past 500 days)
   NOW() - ((1 + FLOOR(RANDOM() * 500))::INT || ' days')::INTERVAL,
   -- loyalty_points
   FLOOR(RANDOM() * 15000),
   -- tier
   (ARRAY['New', 'Regular', 'Loyal', 'VIP'])[1 + FLOOR(RANDOM() * 4)::INT]::user_tiers

   FROM GENERATE_SERIES(1, 500) AS n;
   

-- Employees 2
INSERT INTO employees(full_name,
					  email,
					  password,
                      contact_number,
                      role,
                      hire_date,
                      "EOC",
                      status)
SELECT 
	-- full_name
	CONCAT(
		(ARRAY['Lei', 'Jarell', 'Leo', 'Mhaine', 'Jonas', 'Roman', 'Lance', 'Joshua'])[1 + FLOOR(RANDOM() * 8)::INT],
		' ', 
		(ARRAY['Camorongan', 'Fababier', 'Aceitunas', 'Sebido', 'Jamot', 'Lopez', 'Dayawon', 'Reyes'])[1 + FLOOR(RANDOM() * 8)::INT]
	),
	-- email
    CONCAT('employee', n, '@company.com'),
	-- password
	CONCAT('admin_placeholder', n),
    -- contact_phone_number
    CONCAT('09',
           FLOOR(10 + (RANDOM()*90))::INT,
           FLOOR(100 + (RANDOM()*900))::INT,
           LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0')
           ), 
	-- role
    (ARRAY['owner', 'mechanic', 'finance_adviser', 'cleaner'])[1 + FLOOR(RANDOM() * 4)::INT]::employee_role,
    -- hire_date (Past 500 days)
    CURRENT_DATE - ((1 + FLOOR(RANDOM() * 500))::INT || ' days')::INTERVAL,
    -- EOC (Minimum 1 year and 1-3 years after today)
    CURRENT_DATE + ((365 + FLOOR(RANDOM() * 730))::INT || ' days')::INTERVAL,
    -- status
    (ARRAY['active', 'on_leave', 'terminated'])[1 + FLOOR(RANDOM() * 3)::INT]::employee_status
FROM GENERATE_SERIES(1, 500) AS n; 

-- Shops 3 (Lets say 10 shops lang)
INSERT INTO shops(
				  name,
				  address,
                  contact_number,
                  email, 
                  owner_id,
                  operating_hours)
SELECT
	-- name
	(ARRAY['Autokita', 'ProServ', 'Autohin'])[1 + FLOOR(RANDOM() * 3)::INT],
    -- address
    CONCAT(
		FLOOR(1 + RANDOM() * 9999)::INT, ' ', 
		(ARRAY['Mabini', 'Rizal', 'Luna', 'Bonifacio', 'Taft'])[1 + FLOOR(RANDOM() * 5)::INT], ' St., ', 
		(ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig'])[1 + FLOOR(RANDOM() * 5)::INT]
	),
    -- contact_number
    CONCAT('09',
           FLOOR(10 + (RANDOM()*90))::INT,
           FLOOR(100 + (RANDOM()*900))::INT,
           LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0')
           ),
	-- email 
    CONCAT(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 8),'@company.com'),
    -- owner_id (Randomly select an owner id that exists within the employees table)
    o.id,
    -- operating_hours (All will be similar for now)
    JSONB_BUILD_OBJECT(
        'monday', '8:00am-6:00pm',
        'tuesday', '8:00am-6:00pm',
        'wednesday', '8:00am-6:00pm',
        'thursday', '8:00am-6:00pm',
        'friday', '8:00am-6:00pm',
        'saturday', '8:00am-6:00pm',
        'sunday', 'closed'
    )
FROM GENERATE_SERIES(1, 10) AS loop(n)
CROSS JOIN LATERAL(
	SELECT id 
	FROM employees
	WHERE role = 'owner' AND loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
) AS o;

-- Services 4 (30 for now)
INSERT INTO services(shop_id, 
					 service_name, 
                     description, 
                     base_price, 
                     base_duration_hours, 
                     is_price_fixed, 
                     is_active)
SELECT 
	-- shop_id
	s.id, 
    -- service_name 
    (ARRAY[
        'Oil Change', 
        'Brake Pad Replacement', 
        'Tire Rotation & Balance', 
        'Wheel Alignment', 
        'Engine Diagnostics', 
        'Battery Testing & Replacement', 
        'A/C System Recharge', 
        'Transmission Fluid Flush'
    ])[1 + FLOOR(RANDOM() * 8)::INT],
    -- description 
    CONCAT(
        'Description: ', 
        (ARRAY['inspection', 'maintenance', 'repair', 'servicing'])[1 + FLOOR(RANDOM() * 4)::INT], 
        ' performed by the mechanics to ensure vehicle safety and reliability.'
    ),
    -- base_price (500.00 and 8000.00)
    ROUND((500 + (RANDOM() * 7500))::NUMERIC, 2),
    -- base_duration_hours (0.5 and 5.0 hours)
    ROUND((0.5 + (RANDOM() * 4.5))::NUMERIC, 2),
    -- is_price_fixed (50/50 chance)
    CASE WHEN RANDOM() > 0.5 THEN TRUE ELSE FALSE END,
    -- is_active (90% chance of being active)
    CASE WHEN RANDOM() > 0.1 THEN TRUE ELSE FALSE END
FROM GENERATE_SERIES(1, 30) AS loop(n)
CROSS JOIN LATERAL(
	SELECT id 
	FROM shops 
	WHERE loop.n = loop.n
	ORDER BY RANDOM() 
	LIMIT 1
) AS s;


-- vehicles 5
INSERT INTO vehicles(user_id, 
                     vin, 
                     plate_number, 
                     vehicle_model, 
                     vehicle_year,
					 mileage,
                     vehicle_type)
SELECT 
     u.id, 

    -- vin 
    UPPER(CONCAT(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 10), LPAD(n::TEXT, 7, '0'))),

    -- plate_number
    CONCAT(
        CHR(65 + FLOOR(RANDOM() * 26)::INT), 
        CHR(65 + FLOOR(RANDOM() * 26)::INT), 
        CHR(65 + FLOOR(RANDOM() * 26)::INT), 
        '-', 
        LPAD(n::TEXT, 4, '0')
    ),

    -- vehicle_model
    (ARRAY[
        'Toyota Vios', 
        'Honda Civic', 
        'Ford Ranger', 
        'Mitsubishi Montero Sport', 
        'Nissan Navara', 
        'Hyundai Accent', 
        'Toyota Fortuner', 
        'Suzuki Ertiga', 
        'Honda CR-V', 
        'Isuzu D-Max'
    ])[1 + FLOOR(RANDOM() * 10)::INT],

    -- vehicle_year (2010 to 2026)
    FLOOR(2010 + (RANDOM() * 17))::INT,

	-- mileage (1133 - 15000)
	ROUND(1133 + (RANDOM() * 13867))::FLOAT,

    -- vehicle_type
    (ARRAY[
        'Sedan', 
        'SUV', 
        'Pickup', 
        'Hatchback', 
        'Van', 
        'Crossover'
    ])[1 + FLOOR(RANDOM() * 6)::INT]
    
FROM GENERATE_SERIES(1, 1000) AS loop(n)
CROSS JOIN LATERAL(
	SELECT id
	FROM users 
	WHERE loop.n = loop.n
	ORDER BY RANDOM() 
	LIMIT 1
) AS u;

-- Service_tickets 6
INSERT INTO service_tickets(user_id, 
							vehicle_id, 
                            service_mode, 
                            home_service_address,
                            customer_concern, 
                            ticket_status, 
                            request_date)
SELECT
	-- user_id
	rand_user,
    
    -- vehicle_id
    rand_vehicle,
    
    -- service_mode
    rand_service,

    -- home_service_address 
    CASE WHEN rand_service = 'home_service' THEN
       CONCAT(FLOOR(1 + RANDOM() * 999)::INT, ' ', 
              (ARRAY['Mabini', 'Rizal', 'Luna', 'Bonifacio', 'Taft'])[1 + FLOOR(RANDOM() * 5)::INT],
			  ' St., ', 
              (ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig'])[1 + FLOOR(RANDOM() * 5)::INT])
    ELSE 'None'
    END AS home_service_address,

    -- customer_concern
    (ARRAY[
        'Brakes are squeaking loudly when coming to a stop.', 
        'Check engine light has been on for two days.', 
        'Need a routine maintenance check and oil change.', 
        'Air conditioning is blowing warm air.', 
        'Car pulls heavily to the right while driving.', 
        'Engine makes a rattling noise on cold starts.', 
        'Transmission shifts roughly between 2nd and 3rd gear.', 
        'Battery seems weak, it struggles to start in the morning.'
    ])[1 + FLOOR(RANDOM() * 8)::INT] AS customer_concern,

    -- ticket_status
    (ARRAY['pending', 'queued', 'inspection_scheduled', 'approved', 'declined', 'cancelled'])[1 + FLOOR(RANDOM() * 6)::INT]::ticket_status AS ticket_status,

    -- request_date
    NOW() - (FLOOR(RANDOM() * 365)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL AS request_date

FROM (
	SELECT
	-- user_id (Picks a completely random user ID from the users table)
    u.id AS rand_user,
    -- vehicle_id (Picks a completely random vehicle ID from the vehicles table)
    v.id AS rand_vehicle,
    -- service_mode
    (ARRAY['walk_in', 'home_service'])[1 + FLOOR(RANDOM() * 2)::INT]::service_mode AS rand_service
    FROM GENERATE_SERIES(1, 500) AS loop(n)

	CROSS JOIN LATERAL(
		SELECT id
		FROM users 
		WHERE loop.n = loop.n
		ORDER BY RANDOM() 
		LIMIT 1
	) AS u

	CROSS JOIN LATERAL(
		SELECT id
		FROM vehicles 
		WHERE loop.n = loop.n
		ORDER BY RANDOM() 
		LIMIT 1
	) AS v

	
) AS raw_data;

-- Job Orders 7
INSERT INTO job_orders (
						ticket_id, 
                        user_id, 
                        vehicle_id, 
                        jo_date, 
                        date_arrived, 
                        date_promised, 
						started_at, 
                        completed_at, 
                        released_at, 
                        estimated_duration, 
						actual_duration, 
                        grand_total, 
                        partial_payment, 
                        balance, 
                        status
)
SELECT 
  ticket_id,
  user_id,
  vehicle_id,
  jo_date,
  date_arrived,
  date_promised,
  started_at,
  
  -- NULL checks
  CASE WHEN generated_status IN ('completed', 'released') THEN completed_at ELSE NULL END AS completed_at,
  CASE WHEN generated_status = 'released' THEN released_at ELSE NULL END AS released_at,
  
  estimated_duration,
  CASE WHEN generated_status IN ('completed', 'released') THEN actual_duration ELSE NULL END AS actual_duration,
  
  grand_total,
  partial_payment,
  
  (grand_total - partial_payment) AS balance,
  
  generated_status AS status
FROM (
  SELECT 
    ticket_id,
    user_id,
    vehicle_id,
    generated_status,
    
    request_date::DATE AS jo_date,
    request_date + (offset_arrive || ' hours')::INTERVAL AS date_arrived,
    request_date + ((offset_arrive + offset_start) || ' hours')::INTERVAL AS started_at,
    request_date + ((offset_arrive + offset_start + 48) || ' hours')::INTERVAL AS date_promised,
    request_date + ((offset_arrive + offset_start + offset_complete) || ' hours')::INTERVAL AS completed_at,
    request_date + ((offset_arrive + offset_start + offset_complete + offset_release) || ' hours')::INTERVAL AS released_at,
    
    (est_sec || ' seconds')::INTERVAL AS estimated_duration,
    (act_sec || ' seconds')::INTERVAL AS actual_duration,
    
    gt AS grand_total,
    CASE 
        WHEN generated_status = 'released' THEN gt 
        WHEN RANDOM() > 0.5 THEN ROUND((gt * 0.5)::NUMERIC, 2) 
        ELSE 0.00 
    END AS partial_payment
  FROM (
    SELECT 
      id AS ticket_id,
      user_id,
      vehicle_id,
      request_date,
      
      CASE 
        WHEN RANDOM() < 0.75 THEN 
          CASE WHEN RANDOM() < 0.5 THEN 'completed'::job_orders_status ELSE 'released'::job_orders_status END
        ELSE (ARRAY['inspecting', 'pending_customer_approval', 'in_progress', 'waiting_on_parts', 'revision_pending'])[1 + FLOOR(RANDOM() * 5)::INT]::job_orders_status
      END AS generated_status,
      
      ROUND((500 + (RANDOM() * 25000))::NUMERIC, 2) AS gt,
      
      FLOOR(1 + RANDOM() * 24)::INT AS offset_arrive,
      FLOOR(1 + RANDOM() * 12)::INT AS offset_start,
      FLOOR(2 + RANDOM() * 48)::INT AS offset_complete,
      FLOOR(1 + RANDOM() * 24)::INT AS offset_release,
      
      FLOOR(3600 + (RANDOM() * 28800))::INT AS est_sec,  -- Between 1 and 9 hours
      FLOOR(3600 + (RANDOM() * 32400))::INT AS act_sec   -- Between 1 and 10 hours
    FROM service_tickets
  ) AS base_data
) AS calculated_data;

-- 3rd party suppliers 8
INSERT INTO suppliers (supplier_name, 
					   contact_person, 
                       contact_number, 
                       email, 
                       address, 
                       is_active, 
                       description)
SELECT 
    -- supplier_name
    (ARRAY[
        'Manila Auto Parts Corp.', 
        'Cebu Tires & Mags', 
        'Luzon Battery Co.', 
        'Apex Performance Parts', 
        'Bosch Authorized Distributors', 
        'Denso Manila Trading', 
        'Makati Oils & Lubes', 
        'QC Automotive Supplies', 
        'Pasig Tool & Die', 
        'Summit Suspension Systems'
    ])[n],

    -- contact_person
    (ARRAY[
        'Juan Dela Cruz', 
        'Maria Santos', 
        'Mark Reyes', 
        'Anna Lim', 
        'Jose Garcia', 
        'Grace Tan', 
        'Peter Villanueva', 
        'Sarah Cruz', 
        'David Bautista', 
        'Elena Gomez'
    ])[n],

    -- contact_number 
    CONCAT('09', 
           FLOOR(10 + (RANDOM()*90))::INT, 
           FLOOR(100 + (RANDOM()*900))::INT, 
           LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0')
    ),

    -- email
    CONCAT('sales@', 
           (ARRAY['manilaauto', 'cebutires', 'luzonbatt', 'apexperf', 'boschdist', 'densomnl', 'makatioil', 'qcauto', 'pasigtool', 'summitsusp'])[n], 
           '.com.ph'
    ),

    -- address 
    CONCAT(FLOOR(1 + RANDOM() * 9999)::INT, ' ', 
           (ARRAY['Mabini', 'Rizal', 'Luna', 'Bonifacio', 'Taft'])[1 + FLOOR(RANDOM() * 5)::INT], ' St., ', 
           (ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig'])[1 + FLOOR(RANDOM() * 5)::INT]
    ),

    -- is_active 
    CASE WHEN RANDOM() > 0.1 THEN TRUE ELSE FALSE END,

    -- description 
    (ARRAY[
        'Wholesale distributor of general OEM replacement parts for Japanese and Korean vehicles.',
        'Specializes in high-quality tires, rims, wheel weights, and alignment accessories.',
        'Main supplier for automotive batteries, alternators, and electrical wiring components.',
        'Retailer and wholesaler of aftermarket performance, racing, and tuning parts.',
        'Authorized distributor of Bosch spark plugs, wipers, sensors, and brake pads.',
        'Authorized distributor of Denso air conditioning parts, compressors, and radiators.',
        'Bulk supplier of fully synthetic engine oils, transmission fluids, and coolants.',
        'General auto supply store providing everyday consumables, clips, and shop rags.',
        'Manufacturer and distributor of specialized mechanic hand tools and lifter equipment.',
        'Supplier for heavy-duty shocks, struts, coil springs, and underchassis components.'
    ])[n]
FROM GENERATE_SERIES(1, 10) AS n;

-- 3rd party services 9
INSERT INTO subcontracted_services (
									job_order_id, 
                                    supplier_id, 
                                    description_of_work, 
									date_informed, 
                                    date_started, 
                                    date_ended, 
									supplier_cost, 
                                    retail_price
)
SELECT
  jo_id,
  sup_id,
  
  -- description of work
  (ARRAY[
    'Cylinder head resurfacing and valve seat grinding',
    'Rebuild of automatic transmission assembly',
    'Reprogramming of Engine Control Unit (ECU)',
    'Specialized aluminum welding on engine block',
    'Fabrication of custom exhaust piping',
    'Deep cleaning and detailing of vehicle interior',
    'Calibration of diesel fuel injectors',
    'Replacement of shattered rear windshield',
    'Bake oven painting of front bumper',
    'Upholstery repair for driver seat leather'
  ])[n] AS description_of_work,
  -- date informed
  base_date AS date_informed,
  
  -- date_started
  CASE WHEN n = 10 THEN NULL ELSE base_date + (start_offset || ' hours')::INTERVAL END AS date_started,
  
  -- date_ended
  CASE WHEN n >= 9 THEN NULL ELSE base_date + ((start_offset + end_offset) || ' hours')::INTERVAL END AS date_ended,
  
  -- supplier cost
  cost AS supplier_cost,
  
  -- retail_price
  ROUND((cost * (1.3 + (RANDOM() * 0.2)))::NUMERIC, 2) AS retail_price
  
FROM (
  SELECT 
    n,
    -- Pull random valid IDs
    j.job_id AS jo_id,
    s.sup_id AS sup_id,
    
    -- base date sometime in the last 60 days
    (NOW() - (FLOOR(RANDOM() * 60)::INT || ' days')::INTERVAL) AS base_date,
    
    -- Generate random time offsets 
    FLOOR(1 + (RANDOM() * 24))::INT AS start_offset,
    FLOOR(2 + (RANDOM() * 72))::INT AS end_offset,
    
    -- 1,500 and 10,000
    ROUND((1500 + (RANDOM() * 8500))::NUMERIC, 2) AS cost
  	FROM GENERATE_SERIES(1, 10) AS loop(n)


	CROSS JOIN LATERAL (
	    SELECT id AS job_id 
	    FROM job_orders
	    WHERE loop.n = loop.n 
	    ORDER BY RANDOM() 
	    LIMIT 1
	) AS j
	
	
	CROSS JOIN LATERAL (
	    SELECT id AS sup_id 
	    FROM suppliers 
	    WHERE loop.n = loop.n 
	    ORDER BY RANDOM() 
	    LIMIT 1
	) AS s

 
) AS raw_data;

-- purchase_orders 10
INSERT INTO purchase_orders (
							supplier_id, 
                            order_date, 
                            expected_delivery_date, 
                            actual_delivery_date, 
							total_supplier_cost, 
                            status
)
SELECT
  -- supplier_id
  sup_id,
  
  -- order_date
  ord_date AS order_date,
  
  -- expected_delivery_date
  ord_date + (exp_offset_days || ' days')::INTERVAL AS expected_delivery_date,
  
  -- actual_delivery_date
  CASE WHEN gen_status IN ('fulfilled', 'partially_received') THEN
     ord_date + (act_offset_days || ' days')::INTERVAL
  ELSE NULL
  END AS actual_delivery_date,
  
  cost AS total_supplier_cost,
  gen_status AS status

FROM (
  SELECT 
    -- supplier_id
    sup.id AS sup_id,
    
    -- order_date last 90 days
    (NOW() - (FLOOR(RANDOM() * 90)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL) AS ord_date,
    
    -- time offsets (in days) for deliveries
    FLOOR(1 + RANDOM() * 14)::INT AS exp_offset_days,  -- Expected in 1 to 14 days
    FLOOR(1 + RANDOM() * 16)::INT AS act_offset_days,  -- Actually arrived in 1 to 16 days
    
    -- total cost between 5,000 and 50,000
    ROUND((5000 + (RANDOM() * 45000))::NUMERIC, 2) AS cost,
    
    -- Fullfilled status 30% higher chance
    (ARRAY[
        'drafting', 
        'sent', 
        'partially_received', 
        'cancelled', 
        'fulfilled', 
        'fulfilled', 
        'fulfilled'
    ])[1 + FLOOR(RANDOM() * 7)::INT]::purchase_order_status AS gen_status
  FROM GENERATE_SERIES(1, 20) AS loop(n)

  CROSS JOIN LATERAL(
	SELECT id
	FROM suppliers
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS sup
) AS raw_data;

-- Job order parts 11
INSERT INTO job_order_parts (
							 job_order_id, 
                             purchase_order_id, 
                             status, 
                             part_number, 
                             description, 
							 quantity, 
                             retail_unit_price, 
                             total_retail_amount, 
                             supplier_unit_cost
)
SELECT 
  jo_id AS job_order_id,
  
  -- If its in stock then no PO.
  CASE WHEN gen_status IN ('in_stock', 'to_order') THEN NULL ELSE po_id END AS purchase_order_id,
  
  gen_status AS status,
  
  -- part_number
  CONCAT('PN-', FLOOR(1000 + RANDOM() * 8999)::INT, '-', CHR(65 + FLOOR(RANDOM() * 26)::INT)) AS part_number,
  
  -- description
  part_desc AS description,
  
  -- quantity
  qty AS quantity,
  
  -- retail_unit_price markup 40%
  ROUND((sup_cost * 1.40)::NUMERIC, 2) AS retail_unit_price,
  
  -- total_retail_amount
  ROUND((qty * (sup_cost * 1.40))::NUMERIC, 2) AS total_retail_amount,
  
  -- supplier_unit_cost
  sup_cost AS supplier_unit_cost

FROM (
  SELECT 
    -- job_order_id
    jo.id AS jo_id,
    -- purchase_order_id
    po.id AS po_id,
    
    -- status
    (ARRAY[
        'in_stock', 'to_order', 'ordered', 'in_transit', 'received', 'installed'
    ])[1 + FLOOR(RANDOM() * 6)::INT]::job_order_parts_status AS gen_status,
    
    -- quantity
    FLOOR(1 + (RANDOM() * 4))::INT AS qty,
    
    -- retail_unit_price (between 200 and 5,000)
    ROUND((200 + (RANDOM() * 4800))::NUMERIC, 2) AS sup_cost,
    
    -- description
    (ARRAY[
        'Oil Filter - Premium', 
        'Ceramic Brake Pad Set', 
        'Air Intake Filter', 
        'Spark Plug (Iridium)', 
        'Cabin Air Filter', 
        'Alternator Belt', 
        'Synthetic Engine Oil (1L)', 
        'Wiper Blade Set', 
        'Radiator Coolant (1 Gallon)', 
        'Fuel Filter'
    ])[1 + FLOOR(RANDOM() * 10)::INT] AS part_desc
  FROM GENERATE_SERIES(1, 50) AS loop(n)

  CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS jo

  CROSS JOIN LATERAL (
	SELECT id
	FROM purchase_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS po
) AS raw_data;

-- Job Order Services 12
INSERT INTO job_order_services (
								job_order_id, 
                                service_id, 
                                description_of_work, 
								estimated_duration, 
                                actual_duration, 
                                amount
)
SELECT 
  -- job_order_id
  jo_id AS job_order_id,
  -- service_id
  s_id AS service_id,
  -- description_of_work
  description_of_work,
  
  -- estimated_duration
  (est_sec || ' seconds')::INTERVAL AS estimated_duration,
  
  -- actual_duration
  (GREATEST(900, est_sec + FLOOR((RANDOM() * 3600) - 900)::INT) || ' seconds')::INTERVAL AS actual_duration,
  
  -- amount
  labor_cost AS amount

FROM (
  SELECT 
    -- job_order_id
    jo.id AS jo_id,
    -- service_id
    s.id AS s_id,
    
    -- description_of_work
    (ARRAY[
        'Performed standard service procedure as per manufacturer guidelines.', 
        'Found minor wear and tear during service, but within acceptable limits.', 
        'Customer requested extra attention to this area. Cleaned and serviced thoroughly.', 
        'Service completed. Adjusted specifications to optimal levels.', 
        'Replaced consumables and tested system. Everything is operating normally.',
        'Encountered slightly rusted bolts which delayed removal, but service completed successfully.'
    ])[1 + FLOOR(RANDOM() * 6)::INT] AS description_of_work,
    
    -- estimated_duration (between 30 minutes and 4 hours)
    FLOOR(1800 + (RANDOM() * 12600))::INT AS est_sec,
    
    -- Generated labor cost(between 500.00 and 8000.00)
    ROUND((500 + (RANDOM() * 7500))::NUMERIC, 2) AS labor_cost
  FROM GENERATE_SERIES(1, 500) AS loop(n)

  CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS jo

  CROSS JOIN LATERAL (
	SELECT id
	FROM services
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS s
) AS raw_data;

-- Vehicle Inspections 13
INSERT INTO vehicle_inspections (job_order_id, 
								 findings_description, 
                                 logged_date)
SELECT 
  -- job_order_id
  jo_id AS job_order_id,
  
  -- findings_description
  findings AS findings_description,
  
  -- logged_date (realistically 1-4 hours after the vehicle has arrived)
  (SELECT date_arrived FROM job_orders WHERE id = jo_id) + ((1 + FLOOR(RANDOM() * 4))::INT || ' hours')::INTERVAL AS logged_date

FROM (
  SELECT 
    -- job_order_id
    jo.id AS jo_id,
    
    -- findings_description
    (ARRAY[
        'Vehicle inspected. Found minor oil leak near the valve cover gasket.',
        'All fluid levels are normal. Brake pads are at 40% life.',
        'Suspension check complete. Front right strut is leaking and requires replacement.',
        'Tire tread depth is below safety limits on rear tires. Recommended replacement.',
        'Battery health is at 65%. Terminals cleaned due to minor corrosion.',
        'No major issues found during standard multipoint inspection.',
        'Scanned for OBD2 codes. Found history code for O2 sensor, but currently not active.',
        'Coolant level is low. Pressure tested system and found small leak at the radiator hose.'
    ])[1 + FLOOR(RANDOM() * 8)::INT] AS findings
  FROM GENERATE_SERIES(1, 500) AS loop(n)

  CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS jo
) AS raw_data;

-- Repair Progress Logs 14
INSERT INTO repair_progress_logs (job_order_id, 
								  activity_description, 
                                  log_time)
SELECT 
  -- job_order_id
  jo_id AS job_order_id,
  
  -- activity_description
  activity AS activity_description,
  
  -- log_time (check started_at, else date_arrived)
  COALESCE(
    (SELECT started_at FROM job_orders WHERE id = jo_id), 
    (SELECT date_arrived FROM job_orders WHERE id = jo_id)
  ) + (hours_offset || ' hours')::INTERVAL AS log_time

FROM (
  SELECT 
    -- job_order_id
    jo.id AS jo_id,
    
    -- activity_description
    (ARRAY[
        'Vehicle moved into the service bay. Preparing tools and equipment.',
        'Old components successfully removed. Cleaning mounting surfaces.',
        'Parts have arrived from the inventory/supplier. Beginning installation.',
        'Encountered a stripped bolt during removal. Extracting carefully to avoid damage.',
        'Initial repairs complete. Proceeding with system calibration and testing.',
        'System pressure tested. No leaks detected at this time.',
        'Waiting on customer approval for additional minor findings.',
        'Final reassembly in progress. Checking all torques and fittings.',
        'Road test completed successfully. Vehicle handles as expected.',
        'Washing and detailing vehicle exterior before final release.'
    ])[1 + FLOOR(RANDOM() * 10)::INT] AS activity,
    
    -- offset in hours (between 1 and 72 hours)
    FLOOR(1 + (RANDOM() * 72))::INT AS hours_offset
  FROM GENERATE_SERIES(1, 1500) AS loop(n)

  CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS jo
  
) AS raw_data;
    
-- Payments 15
INSERT INTO payments (
					  job_order_id, 
                      payment_method, 
                      proof_of_payment_image, 
				      amount_paid, 
                      payment_date, 
                      verification_status
)
SELECT
  -- job_order_id
  jo_id AS job_order_id,
  
  -- payment_method
  p_method AS payment_method,
  
  -- proof_of_payment_image (If not cash then fake image link)
  CASE WHEN p_method = 'cash' THEN
     NULL
  ELSE
     CONCAT('https://storage.shop.com/receipts/pay_', FLOOR(100000 + RANDOM() * 899999)::INT, '.jpg')
  END AS proof_of_payment_image,
  
  -- amount_paid (70% for full payment, 30% for partial payment(50%))
  ROUND(
    ((SELECT grand_total FROM job_orders WHERE id = jo_id) * CASE WHEN RANDOM() > 0.3 THEN 1.0 ELSE 0.5 END)::NUMERIC, 
    2
  ) AS amount_paid,
  
  -- payment_date
  (
    SELECT COALESCE(completed_at, started_at, date_arrived) 
    FROM job_orders WHERE id = jo_id
  ) + (hours_offset || ' hours')::INTERVAL AS payment_date,
  
  -- verification_status
  v_status AS verification_status
  
FROM (
  SELECT 
    -- job_order_id
    jo.id AS jo_id,
    
    -- payment_method
    (ARRAY[
        'cash', 'e_wallet', 'bank_transfer', 'credit_card', 'debit_card', 'cheque'
    ])[1 + FLOOR(RANDOM() * 6)::INT]::payment_method AS p_method,
    
    -- status
    CASE 
      WHEN RANDOM() < 0.80 THEN 'verified'::payment_verification_status
      ELSE (ARRAY['pending', 'rejected', 'refunded'])[1 + FLOOR(RANDOM() * 3)::INT]::payment_verification_status
    END AS v_status,
    
    -- offset (1-48 hours)
    FLOOR(1 + (RANDOM() * 48))::INT AS hours_offset
  FROM GENERATE_SERIES(1, 600) AS loop(n)

  CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  ) AS jo
) AS raw_data;

-- Warranties 16
INSERT INTO warranties (
						job_order_id, 
                        coverage_description, 
                        start_date, 
                        expiration_date, 
                        status
)
SELECT 
  -- job_order_id
  jo_id AS job_order_id,
  -- coverage_description
  coverage_desc AS coverage_description,
  -- start_date
  start_date,
  
  -- expiration_date
  start_date + (coverage_days || ' days')::INTERVAL AS expiration_date,
  
  -- cases for status
  CASE 
    WHEN status_roll < 0.05 THEN 'voided'::warranty_status   -- 5% chance the customer voided it
    WHEN status_roll < 0.15 THEN 'claimed'::warranty_status  -- 10% chance they already claimed it
    WHEN (start_date + (coverage_days || ' days')::INTERVAL) < CURRENT_DATE THEN 'expired'::warranty_status
    WHEN (start_date + (coverage_days || ' days')::INTERVAL) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '30 days') THEN 'nearing_expiration'::warranty_status
    ELSE 'active'::warranty_status
  END AS status

FROM (
  SELECT
    jo_id,
    coverage_desc,
    status_roll,
    coverage_days,
    
    -- Get start date when the vehicle is completed
    COALESCE(
      (SELECT completed_at::DATE FROM job_orders WHERE id = jo_id), 
      (SELECT jo_date FROM job_orders WHERE id = jo_id)
    ) AS start_date
  FROM (
    SELECT 
      -- job_order_id
      jo.id AS jo_id,
      
      -- coverage (1 month to 1 year)
      (ARRAY[30, 90, 180, 365])[1 + FLOOR(RANDOM() * 4)::INT] AS coverage_days,
      
      -- coverage_description
      (ARRAY[
          '30-day limited warranty on workmanship and minor adjustments.',
          '90-day warranty on replaced suspension components.',
          '6-month warranty on air conditioning compressor and freon leaks.',
          '1-year comprehensive warranty on engine overhaul labor and parts.',
          '1-year warranty on all installed electrical parts and wiring.'
      ])[1 + FLOOR(RANDOM() * 5)::INT] AS coverage_desc,
      
      -- status
      RANDOM() AS status_roll
    FROM GENERATE_SERIES(1, 400) AS loop(n)

	CROSS JOIN LATERAL (
	SELECT id
	FROM job_orders
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
 	 ) AS jo
  
  ) AS base_data
) AS calculated_dates;

-- Retention Offers 17
INSERT INTO retention_offers (
							  user_id, promo_code, 
                              offer_type, 
                              discount_value, 
                              description, 
							  issue_date, 
                              expiration_date, 
                              is_claimed, 
                              claimed_on_job_order_id
)
SELECT 
  -- user_id
  u_id AS user_id,
  -- promo_code
  promo_code,
  -- discount_type
  o_type AS offer_type,
  -- discount_value
  discount_val AS discount_value,
  -- description
  description,
  -- issue_date
  issue_date,
  -- expiration_date
  expiration_date,
  
  -- is_claimed (If job order is valid then true)
  CASE WHEN possible_jo_id IS NOT NULL THEN TRUE ELSE FALSE END AS is_claimed,
  -- claimed_on_job_order_id
  possible_jo_id AS claimed_on_job_order_id
  
FROM (
  SELECT
  
    u_id,
    o_type,
    
    CASE WHEN o_type = 'service_reminder' THEN NULL ELSE CONCAT(
      CASE o_type
        WHEN 'percentage_discount' THEN 'PCT'
        WHEN 'fixed_discount' THEN 'FIX'
        WHEN 'free_service' THEN 'FREE'
        WHEN 'loyalty_reward' THEN 'VIP'
      END,
      '-', n, '-', UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4))
    ) END AS promo_code,
    
    CASE o_type
      WHEN 'percentage_discount' THEN ROUND((10 + (RANDOM() * 15))::NUMERIC, 2) -- 10% to 25%
      WHEN 'fixed_discount' THEN ROUND((500 + (RANDOM() * 1500))::NUMERIC, 2)   -- 500 to 2000
      ELSE 0.00
    END AS discount_val,
    
    CASE o_type
      WHEN 'percentage_discount' THEN 'Enjoy a percentage off your total bill on your next visit.'
      WHEN 'fixed_discount' THEN 'Use this voucher to get a fixed amount deducted from your total cost.'
      WHEN 'free_service' THEN 'Come in for a complimentary multipoint vehicle inspection.'
      WHEN 'service_reminder' THEN 'Friendly reminder: Your vehicle is due for its periodic maintenance.'
      WHEN 'loyalty_reward' THEN 'Thank you for your continued trust! Enjoy this exclusive loyalty reward.'
    END AS description,
    
    issue_dt AS issue_date,
    issue_dt + INTERVAL '30 days' AS expiration_date,
    
    CASE WHEN claim_roll > 0.6 THEN
      (SELECT id FROM job_orders WHERE user_id = u_id AND status IN ('completed', 'released') ORDER BY RANDOM() LIMIT 1)
    ELSE NULL
    END AS possible_jo_id
    
  FROM (
    SELECT 
      n,
      -- user_id
      u.id AS u_id,
      
      -- promo_code
      (ARRAY['percentage_discount', 'fixed_discount', 'free_service', 'service_reminder', 'loyalty_reward'])[1 + FLOOR(RANDOM() * 5)::INT]::promo_offer_type AS o_type,
      
      -- issue_date
      (CURRENT_DATE - (FLOOR(RANDOM() * 180)::INT || ' days')::INTERVAL)::DATE AS issue_dt,
      
      -- generated claim chance
      RANDOM() AS claim_roll
    FROM GENERATE_SERIES(1, 300) AS loop(n)
	CROSS JOIN LATERAL (
	SELECT id
	FROM users
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  	) AS u
  ) AS raw_data
) AS processed_data;

-- System Audit Logs 18
INSERT INTO system_audit_logs (
							   user_id, 
                               employees_id, 
                               action_performed, 
                               entity_type, 
							   entity_id, 
                               old_values, 
                               new_values, 
                               action_date
)
SELECT 
  -- user_id(30%) or employee_id(70%). If employee is null then user instead)
  CASE WHEN user_or_emp <= 0.3 THEN u_id ELSE NULL END AS user_id,
  CASE WHEN user_or_emp > 0.3 THEN emp_id ELSE NULL END AS employee_id,
  
  act AS action_performed,

  -- Assign the target based on the action type
  CASE act
    WHEN 'claimed' THEN 'retention_offers'
    WHEN 'approved' THEN 'service_tickets'
    WHEN 'rejected' THEN 'service_tickets'
    WHEN 'logged_in' THEN CASE WHEN user_or_emp <= 0.3 THEN 'users' ELSE 'employees' END
    WHEN 'status_changed' THEN 'job_orders'
    ELSE (ARRAY['job_orders', 'users', 'vehicles', 'payments'])[1 + FLOOR(RANDOM() * 4)::INT]
  END AS entity_type,

  -- entity id (Should have used separate variable for both user and employee but I got lazy :p)
  CASE WHEN act = 'logged_in' THEN
	COALESCE(
      CASE WHEN user_or_emp <= 0.3 THEN u_id ELSE NULL END,
      emp_id
    )
  ELSE e_id
  END AS entity_id,

  -- old_values (In JSON format)
  CASE act
    WHEN 'created' THEN NULL
    WHEN 'logged_in' THEN NULL
    WHEN 'claimed' THEN '{"is_claimed": false}'
    WHEN 'status_changed' THEN '{"status": "inspecting"}'
    WHEN 'approved' THEN '{"status": "pending"}'
    WHEN 'rejected' THEN '{"status": "pending"}'
    WHEN 'deleted' THEN JSONB_BUILD_OBJECT('id', e_id, 'is_active', TRUE)::TEXT -- Add deleted by if you want #FIX - 01
    ELSE JSONB_BUILD_OBJECT('record_id', e_id, 'amount', ROUND((500 + RANDOM() * 1000)::NUMERIC, 2))::TEXT
  END AS old_values,

  -- new_values (In JSON format)
  CASE act
    WHEN 'deleted' THEN NULL
    WHEN 'logged_in' THEN NULL
    WHEN 'claimed' THEN JSONB_BUILD_OBJECT('is_claimed', TRUE, 'claimed_on_job_order_id', FLOOR(1 + RANDOM() * 500)::INT)::TEXT
    WHEN 'status_changed' THEN '{"status": "in_progress"}'
    WHEN 'approved' THEN '{"status": "approved"}'
    WHEN 'rejected' THEN '{"status": "declined"}'
    WHEN 'created' THEN JSONB_BUILD_OBJECT('id', e_id, 'is_active', TRUE)::TEXT -- Add created by if you want #FIX - 02
    ELSE JSONB_BUILD_OBJECT('record_id', e_id, 'amount', ROUND((1500 + RANDOM() * 2000)::NUMERIC, 2))::TEXT
  END AS new_values,

  a_date AS action_date

FROM (
  SELECT
    -- Generated user or emp
    RANDOM() AS user_or_emp,
	-- Random user_id
	u.id AS u_id,
	-- Random employee_id
	emp.id AS emp_id,

    -- action_performed
    (ARRAY[
        'created', 'updated', 'deleted', 'status_changed', 
        'approved', 'rejected', 'claimed', 'logged_in'
    ])[1 + FLOOR(RANDOM() * 8)::INT]::audit_action_enum AS act,

    -- entity_id
    FLOOR(1 + RANDOM() * 500)::INT AS e_id,

    -- action_date
    (NOW() - (FLOOR(RANDOM() * 30)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL) AS a_date
  FROM GENERATE_SERIES(1, 1000) AS loop(n)
  
  CROSS JOIN LATERAL (
	SELECT id
	FROM users
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  	) AS u
	  
	  CROSS JOIN LATERAL (
	SELECT id
	FROM employees
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
  	) AS emp
) AS raw_data;

-- Payroll_summaries 19

INSERT INTO payroll_summaries(
				employee_id,
                period_start,
                period_end,
                base_pay,
                commission_pay,
                deductions,
                net_pay,
                status,
                date_generated,
                payment_date
)
SELECT
	employee_id,
    period_start,
    period_end,
    base_pay,
    commission_pay,
    deductions,
    net_pay,
    status,
    date_generated,
    CASE 
		WHEN status = 'draft' THEN draft_offset
		WHEN status = 'approved' THEN approved_offset
		WHEN status = 'paid' THEN paid_offset
    ELSE NULL END AS payment_date	

FROM (
  SELECT 
	employee_id,
	period_start,
    period_end,
    base_pay,
    commission_pay,
    deductions,
    ((base_pay + commission_pay) - deductions) AS net_pay,
    -- draft(10%), approved(30%), paid(60%)
    CASE 
		WHEN gen_status > 0.90 THEN 'draft'::payroll_status_enum
		WHEN gen_status > 0.60 THEN 'approved'::payroll_status_enum
    ELSE 'paid'::payroll_status_enum END AS status,
    date_generated,
    -- offsets
    -- draft happened after 24 hours it was generated
    date_generated + ((1 + FLOOR(RANDOM() * 24))::INT || ' hours')::INTERVAL AS draft_offset,
    -- approved during 48 hours
    date_generated + ((1 + FLOOR(RANDOM() * 48))::INT || ' hours')::INTERVAL AS approved_offset,
    -- paid during 72 hours
    date_generated + ((24 + FLOOR(RANDOM() * 72))::INT || ' hours')::INTERVAL AS paid_offset
    
  FROM (
    SELECT
	-- employee_id
    e.id AS employee_id,
    -- (whole work instead of weekly or monthly for now)
    -- period_start 
    e.hire_date AS period_start,
    -- period_end 
    e.end_of_contract AS period_end,
    -- base_pay (2000, 7000)
    ROUND((2000 + FLOOR(RANDOM() * 5000))::NUMERIC, 2) AS base_pay,
    -- commission_pay (500,5000)
    ROUND((500 + FLOOR(RANDOM() * 4500))::NUMERIC, 2) AS commission_pay,
    -- deductions (0,1000)
    ROUND(FLOOR(RANDOM() * 1000)::NUMERIC, 2) AS deductions,
    -- Status
    RANDOM() AS gen_status,
    -- date_generated (500 days)
    (NOW() - (FLOOR(RANDOM() * 500)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL) AS date_generated
    
    FROM GENERATE_SERIES(1, 500) AS loop(n)
	CROSS JOIN LATERAL(
	SELECT id, hire_date, "EOC" AS end_of_contract
	FROM employees 
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS e
  ) AS raw_data
) AS calculated_data;


-- Chat_sessions 20
INSERT INTO chat_sessions(
						  customer_user_id,
                          assigned_employee_id,
                          reference_type,
                          reference_id,
                          session_status,
                          started_at,
                          last_activity_at
                          
)
SELECT
-- customer_user_id
customer_user_id,
-- assigned_employee_id
assigned_employee_id,
reference_type,
-- reference_id
(SELECT id FROM service_tickets WHERE user_id = customer_user_id LIMIT 1) AS reference_id,
-- session_status
session_status,
-- started_at (1-10 days after registering)
(SELECT registration_date FROM users WHERE id = customer_user_id LIMIT 1) 
+ ((1 + FLOOR(RANDOM() * 10))::INT || ' days')::INTERVAL AS started_at,
-- last_activity_at
(SELECT registration_date FROM users WHERE id = customer_user_id LIMIT 1) 
+ ((10 + FLOOR(RANDOM() * 10))::INT || ' days')::INTERVAL AS last_activity_at

FROM (
	SELECT
	-- customer_user_id
    u.id AS customer_user_id,
    -- assigned_employee_id
    emp.id AS assigned_employee_id,
    -- reference_type [note: "general, job_order, service_ticket"]
    (ARRAY['general', 'job_order', 'service_ticket'])[1 + FLOOR(RANDOM() * 3)::INT] AS reference_type,
    -- session_status [note: "bot_handling, waiting_for_admin, admin_handling, resolved"]
    (ARRAY['bot_handling', 'waiting_for_admin', 'admin_handling', 'resolved'])[1 + FLOOR(RANDOM() * 4)::INT] AS session_status
     
	FROM GENERATE_SERIES(1, 300) AS loop(n)
	
	CROSS JOIN LATERAL(
	SELECT id
	FROM users
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS u
	
	CROSS JOIN LATERAL(
	SELECT id
	FROM employees 
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS emp
) AS raw_data;

-- chat_messages 21
INSERT INTO chat_messages(
						  session_id,
                          sender_type,
                          sender_id,
                          message_text,
                          sent_at,
                          is_read_by_customer,
                          is_read_by_admin
)
SELECT
	session_id,
    sender_type,
    sender_id,
    message_text,
    sent_at,
    is_read_by_customer,
    is_read_by_admin
FROM (
	SELECT
    session_id,
    sender_type,
	-- sender_id
	CASE
	WHEN sender_type = 'customer' THEN (SELECT customer_user_id FROM chat_sessions WHERE id = session_id LIMIT 1)
	WHEN sender_type = 'admin' THEN (SELECT assigned_employee_id FROM chat_sessions WHERE id = session_id LIMIT 1)
	ELSE NULL END AS sender_id,
	-- Message_text
    CASE
	WHEN sender_type = 'customer' THEN (ARRAY['customer_m1', 'customer_m2', 'customer_m3','customer_m4','customer_m5'])[1 + FLOOR(RANDOM() * 5)::INT]
    WHEN sender_type = 'admin' THEN (ARRAY['admin_m1', 'admin_m2','admin_m3','admin_m4','admin_m5'])[1 + FLOOR(RANDOM() * 5)::INT]
    WHEN sender_type = 'bot' THEN (ARRAY['bot_m1','bot_m2','bot_m3','bot_m4','bot_m5'])[1 + FLOOR(RANDOM() * 5)::INT]
    ELSE 'No message' END AS message_text,
    -- Sent_at (answered during 24 hours)
    (SELECT started_at FROM chat_sessions WHERE id = session_id LIMIT 1) + ((1 + FLOOR(RANDOM() * 24))::INT || ' hours')::INTERVAL AS sent_at,
    
    -- is_read_by_customer (0 if customer, else has a 60% chance of seeing the message)
    CASE 
    WHEN sender_type = 'customer' THEN FALSE
    ELSE CASE WHEN gen_read_customer >= 0.6 THEN FALSE ELSE TRUE END
    END AS is_read_by_customer,
    
    -- is_read_by_admin (0 if admin, else has a 50% chance of seeing the message)
    CASE
    WHEN sender_type = 'admin' THEN FALSE
    ELSE CASE WHEN gen_read_admin >= 0.5 THEN FALSE ELSE TRUE END
    END AS is_read_by_admin
    
    FROM (
	  SELECT
	  -- session_id
      (SELECT id FROM chat_sessions ORDER BY RANDOM() LIMIT 1) AS session_id,
      -- sender_type
      (ARRAY['customer', 'bot', 'admin'])[1 + FLOOR(RANDOM() * 3)::INT] AS sender_type,
	  -- is_read_by_customer generated
      RANDOM() AS gen_read_customer,
      RANDOM() AS gen_read_admin
      FROM GENERATE_SERIES(1, 900) AS n
    ) AS raw_data
) AS calculated_data;

-- vehicle_catalog 22
INSERT INTO vehicle_catalog(
							make, 
							model, 
							year_start,
							year_end,
							trim_variant, 
							engine_type, 
							transmission, 
							drive_type, 
							fuel_type 
)
SELECT
    make,
    model,
    year_start,
    year_end,
    trim_variant,
    engine_type,
    transmission,
    drive_type,
    fuel_type
FROM (
    SELECT
        make,
        
        -- model
        CASE make
            WHEN 'Toyota' THEN 'Fortuner'
            WHEN 'Ford' THEN 'Ranger'
            WHEN 'Mitsubishi' THEN 'Montero Sport'
        END AS model,
        
        year_start,
        
        -- year_end: Capped at 2026, spans 0 to 9 years after year_start
        LEAST(2026, year_start + FLOOR(RANDOM() * 10)::INT) AS year_end,
        
        -- trim_variant
        CASE make
            WHEN 'Toyota' THEN (ARRAY['1.5 G', '2.8 V', 'GR-S', 'TRD Sportivo'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Ford' THEN (ARRAY['Wildtrak', 'Titanium', 'XLT'])[1 + FLOOR(RANDOM() * 3)::INT]
            WHEN 'Mitsubishi' THEN (ARRAY['GLS', 'GT', 'Premium'])[1 + FLOOR(RANDOM() * 3)::INT]
        END AS trim_variant,
        
        -- engine_type
        CASE make
            WHEN 'Toyota' THEN (ARRAY['2.8L 1GD-FTV', '2.4L 2GD-FTV', '2.0L Bi-Turbo'])[1 + FLOOR(RANDOM() * 3)::INT]
            WHEN 'Ford' THEN '2.0L Bi-Turbo'
            WHEN 'Mitsubishi' THEN '2.4L 4N15 MIVEC'
        END AS engine_type,
        
        transmission,
        drive_type,
        fuel_type
        
    FROM (
        SELECT
            -- make
            (ARRAY['Toyota', 'Ford', 'Mitsubishi'])[1 + FLOOR(RANDOM() * 3)::INT] AS make,
            
            -- year_start (2010-2026)
            (2010 + FLOOR(RANDOM() * 16)::INT) AS year_start,
            
            -- transmission 
            (ARRAY['AT', 'MT', 'CVT', 'DCT', '6-speed AT', '10-speed AT'])[1 + FLOOR(RANDOM() * 6)::INT] AS transmission,
            
            -- drive_type
            (ARRAY['2WD', '4WD', 'AWD', 'FWD', 'RWD', '4x2', '4x4'])[1 + FLOOR(RANDOM() * 7)::INT] AS drive_type,
            
            -- fuel_type
            (ARRAY['Diesel', 'Gasoline', 'Hybrid', 'PHEV', 'EV'])[1 + FLOOR(RANDOM() * 5)::INT] AS fuel_type
        FROM GENERATE_SERIES(1, 200) AS n
    ) AS first_iteration
) AS calculated_data;

-- part_catalog 23
INSERT INTO part_catalog (
    oem_part_number,
    brand,
    part_category,
    part_name,
    is_oem,
    description
)
SELECT
    oem_part_number,
    brand,
    part_category,
    part_name,
    is_oem,
    
    -- description
    CONCAT('Premium quality ', LOWER(part_name), ' manufactured by ', brand, '. Designed to meet or exceed original equipment specifications.') AS description
FROM (
    SELECT
        n,
        brand,
        part_category,
        
        -- oem_part_number 
        CONCAT(UPPER(LEFT(brand, 3)), '-', LPAD(n::TEXT, 5, '0'), '-', FLOOR(10 + RANDOM() * 90)::INT) AS oem_part_number,
        
        -- is_oem 
        CASE WHEN brand IN ('Toyota', 'Ford', 'Mitsubishi') THEN TRUE ELSE FALSE END AS is_oem,
        
        -- part_name 
        CASE part_category
            WHEN 'Engine' THEN (ARRAY['Timing Belt', 'Water Pump', 'Head Gasket', 'Oil Pan'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Brakes' THEN (ARRAY['Brake Pads (Front)', 'Brake Rotor', 'Brake Caliper', 'Brake Shoe'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Suspension' THEN (ARRAY['Shock Absorber', 'Control Arm', 'Tie Rod End', 'Sway Bar Link'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Electrical' THEN (ARRAY['Alternator', 'Starter Motor', 'Spark Plug', 'Ignition Coil'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Filters' THEN (ARRAY['Oil Filter', 'Air Filter', 'Cabin Air Filter', 'Fuel Filter'])[1 + FLOOR(RANDOM() * 4)::INT]
            WHEN 'Transmission' THEN (ARRAY['Clutch Kit', 'Transmission Fluid Filter', 'CV Axle', 'Flywheel'])[1 + FLOOR(RANDOM() * 4)::INT]
        END AS part_name
        
    FROM (
        SELECT
            n,
            -- brand 
            (ARRAY['Toyota', 'Ford', 'Mitsubishi', 'Bosch', 'Denso', 'Aisin', 'NGK', 'KYB'])[1 + FLOOR(RANDOM() * 8)::INT] AS brand,
            
            -- part_category
            (ARRAY['Engine', 'Brakes', 'Suspension', 'Electrical', 'Filters', 'Transmission'])[1 + FLOOR(RANDOM() * 6)::INT] AS part_category
        FROM GENERATE_SERIES(1, 200) AS n
    ) AS raw_data
) AS calculated_data;

-- part_fitments  24
INSERT INTO part_fitments (
    vehicle_catalog_id,
    part_catalog_id,
    notes
)
SELECT DISTINCT
    vehicle_catalog_id,
    part_catalog_id,
    
    -- notes (70% chance of NULL, 30% chance of a note)
    CASE 
        WHEN note_chance > 0.90 THEN 'Requires professional installation'
        WHEN note_chance > 0.85 THEN 'Direct fit'
        WHEN note_chance > 0.80 THEN 'For automatic transmissions only'
        WHEN note_chance > 0.75 THEN 'Front driver and passenger side'
        WHEN note_chance > 0.70 THEN 'Verify VIN before installation'
        ELSE NULL 
    END AS notes
FROM (
    SELECT
        -- Grab a random existing vehicle ID
        vc.id AS vehicle_catalog_id,
        
        -- Grab a random existing part ID
        pc.id AS part_catalog_id,
        
        -- Randomizer for the notes column
        RANDOM() AS note_chance
    FROM GENERATE_SERIES(1, 500) AS loop(n)
	
	CROSS JOIN LATERAL(
	SELECT id
	FROM vehicle_catalog
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS vc
	
	CROSS JOIN LATERAL(
	SELECT id
	FROM part_catalog
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS pc
) AS raw_data;

-- internal_ai_sessions 25
INSERT INTO internal_ai_sessions (
    employee_id,
    query_category,
    context_vehicle_id,
    started_at
)
SELECT 
    employee_id,
    query_category,
    
    -- context_vehicle_id (70% a vehicle, 30% NULL)
    CASE WHEN vehicle_chance > 0.30 THEN vehicle_id
    ELSE NULL
    END AS context_vehicle_id,
    
    started_at
FROM (
    SELECT
        -- Existing employee ID
        emp.id AS employee_id,
		
		-- Random vehicle ID
		v.id AS vehicle_id,
		
        -- Assign a query category
        (ARRAY['part_validation', 'prescriptive_diagnosis', 'technical_manual'])[1 + FLOOR(RANDOM() * 3)::INT] AS query_category,
        
        -- Random number linked to a specific vehicle
        RANDOM() AS vehicle_chance,
        
        -- started_at (Random time within the last 365 days)
        (NOW() - (FLOOR(RANDOM() * 365)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL) AS started_at
    FROM GENERATE_SERIES(1, 300) AS loop(n)
	
	CROSS JOIN LATERAL(
	SELECT id
	FROM employees
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS emp

	CROSS JOIN LATERAL(
	SELECT id
	FROM vehicles
	WHERE loop.n = loop.n
	ORDER BY RANDOM()
	LIMIT 1
	) AS v
) AS raw_data;

-- internal_ai_messages 26
INSERT INTO internal_ai_messages (
    session_id,
    sender,
    message_text,
    sent_at
)
SELECT
    session_id,
    sender,
    message_text,
    sent_at
FROM (
    SELECT
        session_id,
        sender,
        
        -- message_text 
        CASE sender
            WHEN 'employee' THEN
                CASE FLOOR(msg_rand * 5)::INT
                    WHEN 0 THEN 'What is the torque spec for the cylinder head bolts?'
                    WHEN 1 THEN 'Does the OEM part number fit this specific trim variant?'
                    WHEN 2 THEN 'Show me the wiring diagram for the alternator and main relay.'
                    WHEN 3 THEN 'Vehicle is throwing code P0300, what are the top three causes?'
                    ELSE 'How much transmission fluid is required for a complete flush on this model?'
                END
            WHEN 'bot' THEN
                CASE FLOOR(msg_rand * 5)::INT
                    WHEN 0 THEN 'The recommended torque is 35 Nm, followed by a 90-degree turn.'
                    WHEN 1 THEN 'Yes, based on the vehicle catalog, that part is a direct fit.'
                    WHEN 2 THEN 'Pulling up the diagram... I recommend checking the main ground strap first.'
                    WHEN 3 THEN 'P0300 indicates a random misfire. Start by inspecting spark plugs, ignition coils, and fuel pressure.'
                    ELSE 'The capacity is 4.5 liters for a standard drain/fill, or 8.0 liters for a dry fill/flush.'
                END
        END AS message_text,
        
        -- sent_at 
        (SELECT started_at FROM internal_ai_sessions WHERE id = session_id LIMIT 1) 
            + ((1 + FLOOR(RANDOM() * 3600))::INT || ' seconds')::INTERVAL AS sent_at
            
    FROM (
        SELECT
            -- session_id
            ias.id AS session_id,
            
            -- sender
            (ARRAY['employee', 'bot'])[1 + FLOOR(RANDOM() * 2)::INT] AS sender,
            
            -- Random messages
            RANDOM() AS msg_rand
        FROM GENERATE_SERIES(1, 1000) AS loop(n)
		
		CROSS JOIN LATERAL(
			SELECT id
			FROM internal_ai_sessions
			WHERE loop.n = loop.n
			ORDER BY RANDOM()
			LIMIT 1
		) AS ias
    ) AS raw_data
) AS calculated_data;

-- pre_diagnostics 27
INSERT INTO pre_diagnostics (
    job_order_id,
    mechanic_notes,
    customer_approval_status,
    datetime_created,
    datetime_approved
)
SELECT
    job_order_id,
    mechanic_notes,
    customer_approval_status,
    datetime_created,
    
    -- datetime_approved
    CASE 
        WHEN customer_approval_status IN ('approved', 'disputed') 
        THEN datetime_created + ((1 + FLOOR(RANDOM() * 48))::INT || ' hours')::INTERVAL
        ELSE NULL 
    END AS datetime_approved
FROM (
    SELECT
        job_order_id,
        
        -- mechanic_notes 
        CASE note_index
            WHEN 0 THEN 'Visual inspection shows severe wear on front brake pads (2mm remaining). Rotors require resurfacing.'
            WHEN 1 THEN 'Engine oil leak traced to the valve cover gasket. Spark plug wells show oil pooling.'
            WHEN 2 THEN 'Scan tool indicates P0420 (Catalytic Converter Efficiency). O2 sensors are reading within normal range; suspect cat failure.'
            WHEN 3 THEN 'Customer complaint of clunking over bumps verified. Found excessive play in front sway bar links and passenger tie rod.'
            ELSE 'Battery failed load test (reading 9.5V under load). Alternator charging output is good at 14.2V.'
        END AS mechanic_notes,
        
        -- customer_approval_status (70% approved, 15% disputed, 15% pending)
        CASE 
            WHEN status_rand > 0.30 THEN 'approved'::approval_status
            WHEN status_rand > 0.15 THEN 'disputed'::approval_status
            ELSE 'pending'::approval_status
        END AS customer_approval_status,
        
        datetime_created
    FROM (
        SELECT
            -- Random existing job order ID
            jo.id AS job_order_id,
            
            -- status_distribution
            RANDOM() AS status_rand,
            
            --  mechanic_notes 
            FLOOR(RANDOM() * 5)::INT AS note_index,
            
            -- datetime_created 
            (NOW() - (FLOOR(RANDOM() * 365)::INT || ' days')::INTERVAL - (FLOOR(RANDOM() * 86400)::INT || ' seconds')::INTERVAL) AS datetime_created
        FROM GENERATE_SERIES(1, 300) AS loop(n)

		CROSS JOIN LATERAL (
			SELECT id
			FROM job_orders
			WHERE loop.n = loop.n
			ORDER BY RANDOM()
			LIMIT 1
		) AS jo
    ) AS raw_data
) AS calculated_data;

-- Employee_Profiles 28
INSERT INTO employee_profiles (
    employee_id,
    shop_id,
    branch,
    location,
    rank,
    base_salary,
    commission_percent,
    jobs_capacity,
    color
)
SELECT 
    e.id AS employee_id,
    sh.id AS shop_id,
    (ARRAY['Main Branch', 'North Branch', 'South Branch', 'East Branch', 'West Branch'])[1 + FLOOR(RANDOM() * 5)::INT] AS branch,
    (ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig'])[1 + FLOOR(RANDOM() * 5)::INT] AS location,
    (ARRAY['Junior', 'Mid-Level', 'Senior', 'Lead'])[1 + FLOOR(RANDOM() * 4)::INT] AS rank,
    ROUND((15000 + (RANDOM() * 35000))::NUMERIC, 2) AS base_salary,
    ROUND((1 + (RANDOM() * 9))::NUMERIC, 2) AS commission_percent,
    (1 + FLOOR(RANDOM() * 4))::INT AS jobs_capacity,
    (ARRAY['#FF5733', '#33FF57', '#3357FF', '#F033FF', '#33FFF0', '#F0FF33'])[1 + FLOOR(RANDOM() * 6)::INT] AS color
FROM employees AS e

CROSS JOIN LATERAL (
	SELECT id
	FROM shops
	WHERE e.id > 1
	ORDER BY RANDOM()
	LIMIT 1
) AS sh;

-- Rewards_catalog 29
INSERT INTO rewards_catalog (
    name,
    cost_in_points,
    image_url
)
SELECT
    reward_name,
    cost_in_points,
    image_url
FROM (
    SELECT
        (ARRAY['Free Oil Change', '10% Off Next Service', 'Free Interior Detailing', 'Free Multi-Point Inspection', 'Free Wiper Blades', '500 PHP Discount', 'Free Engine Wash', 'Loyalty Mug', 'Premium Air Freshener', 'Free Brake Fluid Flush'])[n] AS reward_name,
        (ARRAY[500, 300, 400, 150, 200, 250, 350, 100, 50, 450])[n] AS cost_in_points,
        CONCAT('https://storage.shop.com/rewards/item_', n, '.jpg') AS image_url
    FROM GENERATE_SERIES(1, 10) AS n
) raw_data;

-- Service_progress_tasks 30
INSERT INTO service_progress_tasks (
    job_order_id,
    section_id,
    task_title,
    note,
    task_status,
    completed_at
)
SELECT 
    jo_id AS job_order_id,
    section_id,
    task_title,
    note,
    task_status,
    CASE WHEN task_status = 'completed' THEN
        (SELECT date_arrived FROM job_orders WHERE id = jo_id) + ((1 + FLOOR(RANDOM() * 48))::INT || ' hours')::INTERVAL
    ELSE NULL END AS completed_at
FROM (
    SELECT 
        jo.id AS jo_id,
        (ARRAY['received', 'inspecting', 'quotation', 'in_progress', 'complete'])[1 + FLOOR(RANDOM() * 5)::INT]::section_type AS section_id,
        (ARRAY['Check tire pressure', 'Inspect brake pads', 'Check fluid levels', 'Test drive vehicle', 'Finalize quotation', 'Perform alignment', 'Clean interior', 'Final check'])[1 + FLOOR(RANDOM() * 8)::INT] AS task_title,
        'Auto-generated task note based on service history.' AS note,
        (ARRAY['pending', 'in_progress', 'completed'])[1 + FLOOR(RANDOM() * 3)::INT] AS task_status
    FROM GENERATE_SERIES(1, 500) AS loop(n)

	CROSS JOIN LATERAL(
		SELECT id
		FROM job_orders
		WHERE loop.n = loop.n
		ORDER BY RANDOM()
		LIMIT 1
	) AS jo
) raw_data;