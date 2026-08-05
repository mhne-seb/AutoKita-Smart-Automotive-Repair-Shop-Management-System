-- =======================================================================
-- SCENARIO B: LOW COST & LOW TIME
-- =======================================================================
-- Purpose : Injects ~500 extra customers with CHEAP services and
--           SHORT job durations onto the baseline migration.
--           This pushes the ML cost/time regression models to predict
--           lower values and creates a churn distribution heavily
--           weighted toward "Active" and "Loyal" categories
--           (simulating a healthy, frequently visiting customer base).
--
-- Churn distribution target (from get_churn_list logic):
--   ~5%  No Service      (NULL last_checkup)
--   ~10% High Risk       (last_checkup > 180 days ago)
--   ~15% At Risk         (last_checkup 90-180 days ago)
--   ~70% Active          (last_checkup within 90 days)
--
-- Data ranges:
--   estimated_grand_total : ₱200  – ₱2,000
--   actual_grand_total    : ₱150  – ₱2,500
--   estimated_duration    : 0.25 – 1.5 hours
--   actual_duration       : 0.3  – 2.0 hours
--   vehicle age           : 0 – 5 years old (2021–2026 models)
--   user registration     : up to 10 years ago
-- =======================================================================


-- -----------------------------------------------------------------------
-- SCENARIO B – 1. Users (500 records)
--   10-year registration spread; heavier Loyal / VIP tiers
-- -----------------------------------------------------------------------
INSERT INTO users (
    email, nickname, password,
    first_name, last_name, contact_number, address,
    registration_date, loyalty_points, tier
)
SELECT
    CONCAT('scen_b_', n, '@autokita-lowcost.com'),
    SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6),
    CONCAT('scnB_pass', n),

    (ARRAY['Anna', 'Maria', 'Sofia', 'Karen', 'Jessica', 'Patricia',
           'Michelle', 'Sandra', 'Angela', 'Christine', 'Melissa', 'Rachel',
           'Monica', 'Diana', 'Stephanie', 'Vanessa', 'Rebecca', 'Natalie'])[1 + FLOOR(RANDOM() * 18)::INT],

    (ARRAY['Tan', 'Lim', 'Ong', 'Go', 'Co', 'Chua',
           'Sy', 'Yu', 'Chan', 'Sia', 'Koh', 'Ang',
           'Tiu', 'Dee', 'Lee', 'Dy', 'Uy', 'King'])[1 + FLOOR(RANDOM() * 18)::INT],

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

    -- Registration: spread across 10 years
    NOW() - ((30 + FLOOR(RANDOM() * 3620))::INT || ' days')::INTERVAL,

    -- Higher loyalty points (they come frequently, earn more)
    FLOOR(5000 + RANDOM() * 10000),

    -- Tier: heavier Loyal / VIP (active, engaged customers)
    (ARRAY['New', 'Regular', 'Loyal', 'Loyal', 'VIP', 'VIP'])[1 + FLOOR(RANDOM() * 6)::INT]::user_tiers

FROM GENERATE_SERIES(1, 500) AS n;


-- -----------------------------------------------------------------------
-- SCENARIO B – 2. Vehicles (1000 records, 2 per new scenario user)
--   Newer models (2021–2026), low mileage (1,000–30,000)
-- -----------------------------------------------------------------------
INSERT INTO vehicles (
    user_id, vin, plate_number,
    vehicle_model, vehicle_year, mileage, vehicle_type
)
SELECT
    u.id,
    UPPER(CONCAT('SB', SUBSTRING(MD5(u.id::TEXT || loop.n::TEXT) FROM 1 FOR 9),
                  LPAD((loop.n * 1000 + u.id)::TEXT, 6, '0'))),
    CONCAT(
        CHR(65 + (u.id % 26)::INT),
        CHR(65 + ((u.id / 26) % 26)::INT),
        CHR(66 + (loop.n % 25)::INT),
        '-', LPAD((u.id * 2 + loop.n + 5000)::TEXT, 4, '0')
    ),
    -- Newer, fuel-efficient vehicles (cheaper to service)
    (ARRAY[
        'Toyota Vios', 'Honda Brio', 'Suzuki Swift', 'Hyundai Accent',
        'Kia Picanto', 'Mitsubishi Mirage', 'Toyota Yaris', 'Honda City',
        'Suzuki Dzire', 'Nissan Almera', 'Toyota Wigo', 'Kia Soluto'
    ])[1 + FLOOR(RANDOM() * 12)::INT],
    -- Year: 2021–2026 (0–5 years old)
    FLOOR(2021 + RANDOM() * 6)::INT,
    ROUND((1000 + RANDOM() * 29000)::NUMERIC, 2),
    (ARRAY['Sedan', 'Hatchback', 'Crossover', 'Sedan', 'Hatchback', 'SUV'])[1 + FLOOR(RANDOM() * 6)::INT]
FROM users u
CROSS JOIN GENERATE_SERIES(1, 2) AS loop(n)
WHERE u.email LIKE '%autokita-lowcost%';


-- -----------------------------------------------------------------------
-- SCENARIO B – 3. Service Tickets (1 per new user, directly linked)
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
        'Routine oil change and filter replacement.',
        'Schedule quick tire rotation and nitrogen top-up.',
        'Annual PMS check: fluids, filters, belts, and brakes.',
        'Wiper blades worn, visibility poor — quick replacement.',
        'Dashboard warning light blinking — quick diagnostic scan.',
        'Minor brake squeal during light braking — quick inspection.',
        'Cabin air filter replacement and interior A/C cleaning.',
        'Quick battery terminal cleaning and voltage test.',
        'Wheel alignment drift noticed after pothole — 30-min fix.',
        'Monthly tire pressure and tread depth check.'
    ])[1 + FLOOR(RANDOM() * 10)::INT],
    'approved'::ticket_status,
    NOW() - ((1 + FLOOR(RANDOM() * 3600))::INT || ' days')::INTERVAL
FROM users u
INNER JOIN LATERAL (
    SELECT id FROM vehicles
    WHERE user_id = u.id
    ORDER BY id
    LIMIT 1
) AS v ON TRUE
WHERE u.email LIKE '%autokita-lowcost%';


-- -----------------------------------------------------------------------
-- SCENARIO B – 4. Job Orders (1 per scenario service ticket)
--
--  LOW COST / LOW TIME signature:
--    estimated_grand_total : ₱200  – ₱2,000
--    actual_grand_total    : ₱150  – ₱2,500
--    estimated_duration    : 0.25 – 1.5 hours (900 – 5400 seconds)
--    actual_duration       : 0.3  – 2.0 hours (1080 – 7200 seconds)
--
--  Churn distribution via completed_at timing:
--    ~5%  No Service  → status not completed
--    ~10% High Risk   → completed_at > 180 days ago
--    ~15% At Risk     → completed_at 90–180 days ago
--    ~70% Active      → completed_at within 90 days
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

    st.request_date::DATE                                                    AS jo_date,
    st.request_date                                                          AS date_arrived,
    st.request_date + INTERVAL '4 hours'                                     AS date_promised,
    st.request_date + ((10 + FLOOR(RANDOM() * 20))::INT || ' minutes')::INTERVAL AS started_at,

    -- Churn-driven completed_at (anchored to NOW() — 70% Active, 15% At Risk, 10% High Risk, 5% None)
    CASE
        WHEN churn_roll < 0.05 THEN NULL                                         -- ~5% No Service
        WHEN churn_roll < 0.15 THEN NOW() - ((181 + FLOOR(RANDOM() * 730))::INT || ' days')::INTERVAL   -- ~10% High Risk
        WHEN churn_roll < 0.30 THEN NOW() - ((91  + FLOOR(RANDOM() * 89))::INT  || ' days')::INTERVAL   -- ~15% At Risk
        ELSE                        NOW() - ((1   + FLOOR(RANDOM() * 89))::INT   || ' days')::INTERVAL   -- ~70% Active
    END AS completed_at,

    CASE
        WHEN churn_roll < 0.05 THEN NULL
        ELSE NOW() - ((CASE
                WHEN churn_roll < 0.15 THEN (180 + FLOOR(RANDOM() * 730))
                WHEN churn_roll < 0.30 THEN (90  + FLOOR(RANDOM() * 89))
                ELSE                         (0   + FLOOR(RANDOM() * 89))
             END)::INT || ' days')::INTERVAL
    END AS released_at,

    -- Estimated duration: EXTREME LOW TIME 1-5 minutes
    ((FLOOR(60 + RANDOM() * 240))::INT || ' seconds')::INTERVAL::TIME,

    CASE
        WHEN churn_roll < 0.05 THEN NULL
        ELSE ((FLOOR(120 + RANDOM() * 480))::INT || ' seconds')::INTERVAL::TIME
    END,

    -- Estimated grand total: EXTREME LOW COST ₱10–₱50
    ROUND((10 + RANDOM() * 40)::NUMERIC, 2),

    -- Actual grand total: EXTREME LOW COST ₱5–₱100
    ROUND((5 + RANDOM() * 95)::NUMERIC, 2),

    CASE WHEN RANDOM() > 0.8 THEN ROUND((100 + RANDOM() * 500)::NUMERIC, 2) ELSE 0 END,

    ROUND((0 + RANDOM() * 800)::NUMERIC, 2),

    CASE
        WHEN churn_roll < 0.05 THEN (ARRAY['inspecting','pending_customer_approval','in_progress'])[1 + FLOOR(RANDOM() * 3)::INT]::job_orders_status
        WHEN churn_roll < 0.80 THEN 'released'::job_orders_status
        ELSE 'completed'::job_orders_status
    END,

    'Scenario B – low-cost, quick-service job order.',
    TRUE

FROM service_tickets st
CROSS JOIN LATERAL (SELECT RANDOM() AS churn_roll) AS rng
WHERE st.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-lowcost%');


-- -----------------------------------------------------------------------
-- SCENARIO B – 5. Job Order Services (2 per scenario job order)
--   LOW estimated/actual amounts (₱100–₱1,200 per service)
--   LOW duration (15–45 minutes per service)
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
        'Quick oil and filter change — standard 4L synthetic oil used.',
        'Tire rotation performed; all four corners swapped per pattern.',
        'Windshield wiper blades replaced; washer fluid topped up.',
        'Battery terminals cleaned and coated; voltage test passed.',
        'Cabin air filter replaced; A/C evaporator spray applied.',
        'Engine bay wash and basic undercarriage inspection.',
        'All fluid levels checked and topped up: coolant, brake, power steering.',
        'Tire pressure adjusted to manufacturer spec; tread depth recorded.'
    ])[1 + FLOOR(RANDOM() * 8)::INT],
    -- EXTREME LOW TIME: 30-150 seconds per service
    ((FLOOR(30 + RANDOM() * 120))::INT || ' seconds')::INTERVAL::TIME,
    ((FLOOR(60 + RANDOM() * 240))::INT || ' seconds')::INTERVAL::TIME,
    ROUND((0.01 + RANDOM() * 0.04)::NUMERIC, 2),
    ROUND((0.02 + RANDOM() * 0.08)::NUMERIC, 2),
    -- EXTREME LOW COST: ₱5–₱25
    ROUND((5 + RANDOM() * 20)::NUMERIC, 2),
    ROUND((5 + RANDOM() * 45)::NUMERIC, 2)
FROM job_orders jo
CROSS JOIN GENERATE_SERIES(1, 2) AS loop(n)
CROSS JOIN LATERAL (
    SELECT id FROM services ORDER BY RANDOM() LIMIT 1
) AS s
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-lowcost%');


-- -----------------------------------------------------------------------
-- SCENARIO B – 6. Service Progress Tasks
-- -----------------------------------------------------------------------
INSERT INTO service_progress_tasks (
    job_order_id, section_id, task_title,
    note, task_status, completed_at
)
SELECT
    jo.id,
    (ARRAY['received','inspecting','quotation','in_progress','complete'])[1 + FLOOR(RANDOM() * 5)::INT]::section_type,
    (ARRAY[
        'Quick oil drain and fill completed',
        'Tire swapped and torque verified to spec',
        'Wiper blade clips snapped in; full sweep tested',
        'Battery load test passed; terminals re-tightened',
        'Cabin filter slot cleaned; new filter seated',
        'All fluid reservoirs verified at safe levels',
        'Tire pressure corrected; TPMS reset performed',
        'Visual brake inspection — no action required at this visit'
    ])[1 + FLOOR(RANDOM() * 8)::INT],
    'Scenario B – quick-service task completed efficiently.',
    (ARRAY['completed', 'completed', 'completed', 'in_progress', 'pending'])[1 + FLOOR(RANDOM() * 5)::INT],
    CASE WHEN RANDOM() > 0.2 THEN
        NOW() - ((1 + FLOOR(RANDOM() * 89))::INT || ' days')::INTERVAL
    ELSE NULL END
FROM job_orders jo
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-lowcost%');


-- -----------------------------------------------------------------------
-- SCENARIO B – 7. Payments (for released/completed job orders)
-- -----------------------------------------------------------------------
INSERT INTO payments (
    job_order_id, payment_method, proof_of_payment_image,
    amount_paid, payment_date, verification_status
)
SELECT
    jo.id,
    (ARRAY['cash', 'cash', 'cash', 'e_wallet', 'debit_card'])[1 + FLOOR(RANDOM() * 5)::INT]::payment_method,
    CASE WHEN RANDOM() > 0.6 THEN
        CONCAT('https://storage.shop.com/receipts/sb_', jo.id, '_', FLOOR(RANDOM() * 9999)::INT, '.jpg')
    ELSE NULL END,
    ROUND((jo.actual_grand_total * (CASE WHEN RANDOM() > 0.15 THEN 1.0 ELSE 0.7 END))::NUMERIC, 2),
    COALESCE(jo.completed_at, jo.started_at) + ((1 + FLOOR(RANDOM() * 240))::INT || ' minutes')::INTERVAL,
    CASE WHEN RANDOM() < 0.95 THEN 'verified'::payment_verification_status
         ELSE 'pending'::payment_verification_status END
FROM job_orders jo
WHERE jo.user_id IN (SELECT id FROM users WHERE email LIKE '%autokita-lowcost%')
  AND jo.status IN ('completed', 'released')
  AND jo.completed_at IS NOT NULL;


-- -----------------------------------------------------------------------
-- SCENARIO B – 8. Reset sequences
-- -----------------------------------------------------------------------
SELECT setval('users_id_seq',                  (SELECT MAX(id) FROM users));
SELECT setval('vehicles_id_seq',               (SELECT MAX(id) FROM vehicles));
SELECT setval('service_tickets_id_seq',        (SELECT MAX(id) FROM service_tickets));
SELECT setval('job_orders_id_seq',             (SELECT MAX(id) FROM job_orders));
SELECT setval('job_order_services_id_seq',     (SELECT MAX(id) FROM job_order_services));
SELECT setval('service_progress_tasks_id_seq', (SELECT MAX(id) FROM service_progress_tasks));
SELECT setval('payments_id_seq',               (SELECT MAX(id) FROM payments));
