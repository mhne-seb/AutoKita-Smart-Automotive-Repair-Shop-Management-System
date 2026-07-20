-- get_customer_billing_services
CREATE OR REPLACE FUNCTION get_customer_billing_services(p_user_id INT)
RETURNS TABLE (
    job_order_id   INT,
    status         job_orders_status,
    grand_total    DECIMAL(10,2),
    partial_payment DECIMAL(10,2),
    balance        DECIMAL(10,2),
    completed_at   TIMESTAMP,
    released_at    TIMESTAMP,
    vehicle_model  VARCHAR(40),
    plate_number   VARCHAR(10),
    payment_id     INT,
    payment_method payment_method,
    amount_paid    DECIMAL,
    payment_date   TIMESTAMP,
    verification_status payment_verification_status
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        jo.id          AS job_order_id,
        jo.status,
        jo.grand_total,
        jo.partial_payment,
        jo.balance,
        jo.completed_at,
        jo.released_at,
        v.vehicle_model,
        v.plate_number,
        p.id           AS payment_id,
        p.payment_method,
        p.amount_paid,
        p.payment_date,
        p.verification_status
    FROM job_orders AS jo
    JOIN vehicles AS v 
	ON v.id = jo.vehicle_id
    LEFT JOIN payments AS p 
	ON p.job_order_id = jo.id
    WHERE jo.user_id = p_user_id
    ORDER BY jo.completed_at DESC NULLS LAST, p.payment_date DESC NULLS LAST;
$$;

-- get_customer_warranties(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_warranties(p_user_id INT)
RETURNS TABLE (
    warranty_id          INT,
    coverage_description TEXT,
    start_date           DATE,
    expiration_date      DATE,
    status               warranty_status,
    job_order_id         INT,
    completed_at         TIMESTAMP,
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        w.id           AS warranty_id,
        w.coverage_description,
        w.start_date,
        w.expiration_date,
        w.status,
        jo.id          AS job_order_id,
        jo.completed_at,
        v.vehicle_model,
        v.plate_number
    FROM warranties AS w
    JOIN job_orders AS jo 
	ON jo.id = w.job_order_id
    JOIN vehicles AS v    
	ON v.id  = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND w.status IN ('active', 'nearing_expiration')
    ORDER BY w.expiration_date ASC;
$$;


-- get_customer_warranty_history(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_warranty_history(p_user_id INT)
RETURNS TABLE (
    warranty_id          INT,
    coverage_description TEXT,
    start_date           DATE,
    expiration_date      DATE,
    status               warranty_status,
    job_order_id         INT,
    completed_at         TIMESTAMP,
    vehicle_model        VARCHAR(40),
    plate_number         VARCHAR(10)
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        w.id           AS warranty_id,
        w.coverage_description,
        w.start_date,
        w.expiration_date,
        w.status,
        jo.id          AS job_order_id,
        jo.completed_at,
        v.vehicle_model,
        v.plate_number
    FROM warranties AS w
    JOIN job_orders AS jo 
	ON jo.id = w.job_order_id
    JOIN vehicles AS v    
	ON v.id  = jo.vehicle_id
    WHERE jo.user_id = p_user_id
      AND w.status IN ('expired', 'voided', 'claimed')
    ORDER BY w.expiration_date DESC;
$$;


-- get_customer_rewards(p_user_id)
CREATE OR REPLACE FUNCTION get_customer_rewards(p_user_id INT)
RETURNS TABLE (
    loyalty_points  INTEGER,
    tier            user_tiers,
    reward_id       INT,
    reward_name     VARCHAR(100),
    cost_in_points  INTEGER,
    image_url       TEXT
)
LANGUAGE SQL STABLE
AS $$
    SELECT
        u.loyalty_points,
        u.tier,
        rc.id          AS reward_id,
        rc.name        AS reward_name,
        rc.cost_in_points,
        rc.image_url
    FROM users AS u
    CROSS JOIN rewards_catalog AS rc
    WHERE u.id = p_user_id
    ORDER BY rc.cost_in_points ASC;
$$;
