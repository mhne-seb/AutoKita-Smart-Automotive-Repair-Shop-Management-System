-- =======================================================================
-- SCENARIO A: HIGH COST & HIGH TIME
-- =======================================================================
-- Purpose : Injects ~500 extra customers with EXPENSIVE services and
--           LONG job durations onto the baseline migration.
--           This pushes the ML cost/time regression models to predict
--           higher values and creates a churn distribution heavily
--           weighted toward "High Risk" and "At Risk" categories
--           (simulating an aging customer base that visits infrequently).
--
-- Churn distribution target (from get_churn_list logic):
--   ~15% No Service      (NULL last_checkup)
--   ~35% High Risk       (last_checkup > 180 days ago)
--   ~25% At Risk         (last_checkup 90-180 days ago)
--   ~25% Active          (last_checkup within 90 days)
--
-- Data ranges:
--   estimated_grand_total : ₱8,000 – ₱25,000
--   actual_grand_total    : ₱8,000 – ₱28,000
--   estimated_duration    : 4 – 10 hours
--   actual_duration       : 4 – 12 hours
--   vehicle age           : 10 – 16 years old (2010–2016 models)
--   user registration     : up to 10 years ago
-- =======================================================================


-- -----------------------------------------------------------------------
-- SCENARIO A – 1. Users (500 records)
--   Registration spread across 10 years.
-- -----------------------------------------------------------------------
INSERT INTO users (
    email, nickname, password,
    first_name, last_name, contact_number, address,
    registration_date, loyalty_points, tier
)
SELECT
    CONCAT('scen_a_', n, '@autokita-highcost.com'),
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6),
    CONCAT('scnA_pass', n),

    (ARRAY['Miguel', 'Jose', 'Ramon', 'Arturo', 'Fernando', 'Eduardo',
           'Roberto', 'Carlos', 'Manuel', 'Antonio', 'Pedro', 'Ricardo',
           'Luis', 'Jorge', 'Francisco', 'Ernesto', 'Domingo', 'Cesar'])[1 + FLOOR(RANDOM() * 18)::INT],

    (ARRAY['Dela Cruz', 'Santos', 'Reyes', 'Garcia', 'Mendoza', 'Torres',
           'Flores', 'Rivera', 'Lopez', 'Gomez', 'Ramos', 'Bautista',
           'Villanueva', 'Aquino', 'Castillo', 'Soriano', 'Aguilar', 'Cruz'])[1 + FLOOR(RANDOM() * 18)::INT],

    CONCAT('09',
           FLOOR(10 + RANDOM() * 90)::INT,
           FLOOR(100 + RANDOM() * 900)::INT,
           LPAD(FLOOR(RANDOM() * 10000)::INT::TEXT, 4, '0')),

    CONCAT(FLOOR(1 + RANDOM() * 9999)::INT, ' ',
           (ARRAY['Mabini', 'Rizal', 'Luna', 'Bonifacio', 'Taft',
                  'Quezon', 'Roxas', 'Del Pilar', 'Osmena', 'Magsaysay'])[1 + FLOOR(RANDOM() * 10)::INT],
           ' St., ',
           (ARRAY['Quezon City', 'Makati City', 'Manila', 'Pasig City', 'Taguig',
                  'Mandaluyong', 'Marikina', 'Caloocan', 'Las Pinas', 'Paranaque'])[1 + FLOOR(RANDOM() * 10)::INT]),

    -- Registration: last 10 years (older, established customer base)
    NOW() - ((30 + FLOOR(RANDOM() * 3620))::INT || ' days')::INTERVAL,

    FLOOR(RANDOM() * 8000),

    (ARRAY['New', 'New', 'Regular', 'Regular', 'Loyal', 'VIP'])[1 + FLOOR(RANDOM() * 6)::INT]::user_tiers

FROM GENERATE_SERIES(1, 500) AS n;


-- -----------------------------------------------------------------------
-- SCENARIO A – 2. Vehicles (1000 records, 2 per new scenario user)
--   Older models (2010–2016), high mileage (50,000–150,000)
-- -----------------------------------------------------------------------
INSERT INTO vehicles (
    user_id, vin, plate_number,
    vehicle_model, vehicle_year, mileage, vehicle_type
)
SELECT
    u.id,
    UPPER(CONCAT('SA', SUBSTRING(MD5(u.id::TEXT || loop.n::TEXT) FROM 1 FOR 9),
                  LPAD((loop.n * 1000 + u.id)::TEXT, 6, '0'))),
    CONCAT(
        CHR(65 + (u.id % 26)::INT),
        CHR(65 + ((u.id / 26) % 26)::INT),
        CHR(65 + (loop.n % 26)::INT),
        '-', LPAD((u.id * 2 + loop.n)::TEXT, 4, '0')
    ),
    (ARRAY[
        'Toyota Land Cruiser', 'Toyota Fortuner', 'Ford Expedition',
        'Mitsubishi Pajero', 'Nissan Patrol', 'Isuzu D-Max',
        'Ford Ranger', 'Chevrolet Trailblazer', 'Honda CR-V',
        'Hyundai Tucson', 'Kia Sorento', 'Mazda CX-5'
    ])[1 + FLOOR(RANDOM() * 12)::INT],
    -- Year: 2010–2016 (10–16 years old)
    FLOOR(2010 + RANDOM() * 7)::INT,
    ROUND((50000 + RANDOM() * 100000)::NUMERIC, 2),
    (ARRAY['SUV', 'Pickup', 'Van', 'Crossover', 'Sedan', 'Hatchback'])[1 + FLOOR(RANDOM() * 6)::INT]
FROM users u
CROSS JOIN GENERATE_SERIES(1, 2) AS loop(n)
WHERE u.email LIKE '%autokita-highcost%';


-- -----------------------------------------------------------------------
-- SCENARIO A – 3. Service Tickets (1 per new user, directly linked)
-- -----------------------------------------------------------------------
INSERT INTO service_tickets (
    user_id, vehicle_id, service_mode,
    home_service_address, customer_concern,
    ticket_status, request_date
)
SELECT
    u.id,
    v.id,
    'walk_in'::service_mode,
    'None',
    (ARRAY[
        'Engine knocking heavily under load — needs urgent diagnosis.',
        'Transmission slipping between gears; vehicle jerks at highway speed.',
        'Severe oil leak underneath — puddles forming overnight.',
        'Brakes grinding metal-on-metal; stopping distance is dangerously long.',
        'Check engine light on; multiple fault codes found during scan.',
        'Suspension is completely collapsed on the rear driver side.',
        'A/C compressor seized — blowing only hot air.',
        'Full engine overhaul requested; vehicle has 120,000 km on it.',
        'Fuel injectors clogged; very poor fuel economy and rough idle.',
        'Complete timing belt + water pump replacement due at high mileage.'
    ])[1 + FLOOR(RANDOM() * 10)::INT],
    'approved'::ticket_status,
    NOW() - ((60 + FLOOR(RANDOM() * 3540))::INT || ' days')::INTERVAL
FROM users u
INNER JOIN LATERAL (
    SELECT id FROM vehicles
    WHERE user_id = u.id
    ORDER BY id
    LIMIT 1
) AS v ON TRUE
WHERE u.email LIKE '%autokita-highcost%';


-- -----------------------------------------------------------------------
-- SCENARIO A – 4. Job Orders (1 per scenario service ticket)
--
--  HIGH COST / HIGH TIME signature:
--    estimated_grand_total : ₱8,000 – ₱25,000
--    actual_grand_total    : ₱8,000 – ₱28,000
--    estimated_duration    : 4 – 10 hours
--    actual_duration       : 4 – 12 hours
--
--  Churn distribution via completed_at timing:
--    ~15% No Service  → status not completed
--    ~35% High Risk   → completed_at > 180 days ago
--    ~25% At Risk     → completed_at 90–180 days ago
--    ~25% Active      → completed_at within 90 days
-- -----------------------------------------------------------------------
INSERT INTO job_orders (
    ticket_id, user_id, vehicle_id,
    jo_date, date_arrived, date_promised, started_at,
    completed_at, released_at,
    estimated_duration, actual_duration,
    estimated_grand_total, actual_grand_total,
    partial_payment, balance,
    status, quotation_notes, quotation_approved
)
SELECT
    st.id        AS ticket_id,
    st.user_id,
    st.vehicle_id,

    st.request_date::DATE                                                  AS jo_date,
    st.request_date                                                        AS date_arrived,
    st.request_date + INTERVAL '5 days'                                    AS date_promised,
    st.request_date + ((1 + FLOOR(RANDOM() * 4))::INT || ' hours')::INTERVAL AS started_at,

    -- Churn-driven completed_at (anchored to NOW() for correct churn classification)
    -- get_churn_list() checks: >180 days = High Risk, 90-180 = At Risk, <90 = Active
    CASE
        WHEN churn_roll < 0.15 THEN NULL                                         -- ~15% No Service
        WHEN churn_roll < 0.50 THEN NOW() - ((181 + FLOOR(RANDOM() * 1095))::INT || ' days')::INTERVAL  -- ~35% High Risk (181-1276 days ago)
        WHEN churn_roll < 0.75 THEN NOW() - ((91  + FLOOR(RANDOM() * 89))::INT  || ' days')::INTERVAL  -- ~25% At Risk (91-179 days ago)
        ELSE                        NOW() - ((1   + FLOOR(RANDOM() * 89))::INT   || ' days')::INTERVAL  -- ~25% Active (1-89 days ago)
    END AS completed_at,

    CASE
        WHEN churn_roll < 0.15 THEN NULL
        ELSE NOW() - ((CASE
                WHEN churn_roll < 0.50 THEN (180 + FLOOR(RANDOM() * 1095))
                WHEN churn_roll < 0.75 THEN (90  + FLOOR(RANDOM() * 89))
                ELSE                         (0   + FLOOR(RANDOM() * 89))
             END)::INT || ' days')::INTERVAL
    END AS released_at,

    -- Estimated duration: EXTREME HIGH TIME (10-24 hours)
    ((FLOOR(36000 + RANDOM() * 50400))::INT || ' seconds')::INTERVAL::TIME,

    CASE
        WHEN churn_roll < 0.15 THEN NULL
        ELSE ((FLOOR(43200 + RANDOM() * 129600))::INT || ' seconds')::INTERVAL::TIME
    END,

    -- Estimated grand total: EXTREME HIGH COST ₱50,000–₱100,000
    ROUND((50000 + RANDOM() * 50000)::NUMERIC, 2),

    -- Actual grand total: EXTREME HIGH COST ₱60,000–₱150,000
    ROUND((60000 + RANDOM() * 90000)::NUMERIC, 2),

    CASE WHEN RANDOM() > 0.4 THEN ROUND((4000 + RANDOM() * 8000)::NUMERIC, 2) ELSE 0 END,

    ROUND((2000 + RANDOM() * 10000)::NUMERIC, 2),

    CASE
        WHEN churn_roll < 0.15 THEN (ARRAY['inspecting','pending_customer_approval','in_progress','waiting_on_parts','revision_pending'])[1 + FLOOR(RANDOM() * 5)::INT]::job_orders_status
        WHEN churn_roll < 0.85 THEN 'released'::job_orders_status
        ELSE 'completed'::job_orders_status
    END,

    'Scenario A – high-cost, high-duration job order.',
    TRUE

FROM service_tickets st
CROSS JOIN LATERAL (SELECT RANDOM() AS churn_roll) AS rng
WHERE st.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-highcost%');


-- -----------------------------------------------------------------------
-- SCENARIO A – 5. Job Order Services (2 per scenario job order)
--   HIGH estimated/actual amounts (₱3,000–₱12,000 per service)
--   HIGH duration (3–8 hours per service)
-- -----------------------------------------------------------------------
INSERT INTO job_order_services (
    job_order_id, service_id,
    description_of_work,
    estimated_duration, actual_duration,
    estimated_hours, actual_hours,
    estimated_amount, actual_amount
)
SELECT
    jo.id AS job_order_id,
    s.id  AS service_id,
    (ARRAY[
        'Full engine overhaul including cylinder head resurfacing and gasket replacement.',
        'Complete automatic transmission rebuild with torque converter replacement.',
        'Major brake system overhaul: rotors, calipers, pads, and brake lines replaced.',
        'Full suspension rebuild: shocks, struts, control arms, and bushings replaced.',
        'A/C compressor, condenser, and evaporator coil replaced; system recharged.',
        'Timing belt, water pump, idler pulley, and tensioner replaced as full kit.',
        'Fuel system overhaul: injectors cleaned, fuel pump and filter replaced.',
        'Full electrical diagnosis and rewiring of damaged harness and relay faults.'
    ])[1 + FLOOR(RANDOM() * 8)::INT],
    -- EXTREME TIME
    ((FLOOR(18000 + RANDOM() * 25200))::INT || ' seconds')::INTERVAL::TIME,
    ((FLOOR(21600 + RANDOM() * 64800))::INT || ' seconds')::INTERVAL::TIME,
    ROUND((5.0 + RANDOM() * 7.0)::NUMERIC, 2),
    ROUND((6.0 + RANDOM() * 18.0)::NUMERIC, 2),
    -- EXTREME COST: ₱25,000–₱50,000
    ROUND((25000 + RANDOM() * 25000)::NUMERIC, 2),
    ROUND((30000 + RANDOM() * 45000)::NUMERIC, 2)
FROM job_orders jo
CROSS JOIN GENERATE_SERIES(1, 2) AS loop(n)
CROSS JOIN LATERAL (
    SELECT id FROM services ORDER BY RANDOM() LIMIT 1
) AS s
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-highcost%');


-- -----------------------------------------------------------------------
-- SCENARIO A – 6. Service Progress Tasks
-- -----------------------------------------------------------------------
INSERT INTO service_progress_tasks (
    job_order_id, section_id, task_title,
    note, task_status, completed_at
)
SELECT
    jo.id,
    (ARRAY['received','inspecting','quotation','in_progress','complete'])[1 + FLOOR(RANDOM() * 5)::INT]::section_type,
    (ARRAY[
        'Disassemble engine components for inspection',
        'Order OEM parts for transmission rebuild',
        'Verify brake hydraulic pressure before final test',
        'Re-torque cylinder head bolts to spec after initial run',
        'Road test completed — no abnormal sounds detected',
        'Full alignment performed after suspension overhaul',
        'Leak-down test performed on repaired engine',
        'Final customer walk-through and sign-off obtained'
    ])[1 + FLOOR(RANDOM() * 8)::INT],
    'Scenario A – high-cost service task note.',
    (ARRAY['pending','in_progress','completed'])[1 + FLOOR(RANDOM() * 3)::INT],
    CASE WHEN RANDOM() > 0.4 THEN
        NOW() - ((1 + FLOOR(RANDOM() * 90))::INT || ' days')::INTERVAL
    ELSE NULL END
FROM job_orders jo
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-highcost%');


-- -----------------------------------------------------------------------
-- SCENARIO A – 7. Payments (for released/completed job orders)
-- -----------------------------------------------------------------------
INSERT INTO payments (
    job_order_id, payment_method, proof_of_payment_image,
    amount_paid, payment_date, verification_status
)
SELECT
    jo.id,
    (ARRAY['cash','bank_transfer','e_wallet','credit_card','cheque'])[1 + FLOOR(RANDOM() * 5)::INT]::payment_method,
    CASE WHEN RANDOM() > 0.3 THEN
        CONCAT('https://storage.shop.com/receipts/sa_', jo.id, '_', FLOOR(RANDOM() * 9999)::INT, '.jpg')
    ELSE NULL END,
    ROUND((jo.actual_grand_total * (CASE WHEN RANDOM() > 0.35 THEN 1.0 ELSE 0.5 END))::NUMERIC, 2),
    COALESCE(jo.completed_at, jo.started_at) + ((1 + FLOOR(RANDOM() * 48))::INT || ' hours')::INTERVAL,
    CASE WHEN RANDOM() < 0.85 THEN 'verified'::payment_verification_status
         WHEN RANDOM() < 0.92 THEN 'pending'::payment_verification_status
         ELSE 'rejected'::payment_verification_status END
FROM job_orders jo
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-highcost%')
  AND jo.status IN ('completed', 'released')
  AND jo.completed_at IS NOT NULL;


-- -----------------------------------------------------------------------
-- SCENARIO A – 8. Reset sequences
-- -----------------------------------------------------------------------
SELECT setval('users_id_seq',                  (SELECT MAX(id) FROM users));
SELECT setval('vehicles_id_seq',               (SELECT MAX(id) FROM vehicles));
SELECT setval('service_tickets_id_seq',        (SELECT MAX(id) FROM service_tickets));
SELECT setval('job_orders_id_seq',             (SELECT MAX(id) FROM job_orders));
SELECT setval('job_order_services_id_seq',     (SELECT MAX(id) FROM job_order_services));
SELECT setval('service_progress_tasks_id_seq', (SELECT MAX(id) FROM service_progress_tasks));
SELECT setval('payments_id_seq',               (SELECT MAX(id) FROM payments));
