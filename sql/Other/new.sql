-- 1. Migrations
ALTER TABLE job_orders ADD COLUMN IF NOT EXISTS quotation_approved BOOLEAN DEFAULT false;
ALTER TABLE service_progress_tasks ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0;
ALTER TABLE service_progress_tasks ADD COLUMN IF NOT EXISTS billable BOOLEAN DEFAULT true;

-- 2. Quotation Functions
CREATE OR REPLACE FUNCTION get_job_order_quotation(p_job_order_id integer)
RETURNS TABLE (
job_order_id INTEGER, quotation_notes TEXT, actual_grand_total TEXT, balance TEXT,
approval_status TEXT, mechanic_notes TEXT, datetime_created TEXT, datetime_approved TEXT
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.quotation_notes, jo.actual_grand_total::text, jo.balance::text,
pd.customer_approval_status::text, pd.mechanic_notes,
pd.datetime_created::text, pd.datetime_approved::text
FROM job_orders jo
LEFT JOIN pre_diagnostics pd ON pd.job_order_id = jo.id
WHERE jo.id = p_job_order_id
ORDER BY pd.datetime_created DESC
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_job_order_quotation_services(p_job_order_id integer)
RETURNS TABLE (id INTEGER, service_name VARCHAR, description_of_work TEXT, estimated_hours NUMERIC, amount TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jos.id, s.service_name, jos.description_of_work, jos.estimated_hours, jos.actual_amount::text
FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_parts_summary(p_job_order_id integer)
RETURNS TABLE (status TEXT, part_count BIGINT)
LANGUAGE sql STABLE
AS $$
SELECT status::text, COUNT(*)
FROM job_order_parts
WHERE job_order_id = p_job_order_id
GROUP BY status;
$$;

CREATE OR REPLACE FUNCTION set_quotation_approval(p_job_order_id integer, p_approved boolean)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE job_orders SET quotation_approved = p_approved WHERE id = p_job_order_id;
  
  IF p_approved THEN
    -- Insert services as in_progress tasks
    INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable)
    SELECT p_job_order_id, 'in_progress', s.service_name, s.description_of_work, 'pending', s.amount, true
    FROM get_job_order_quotation_services(p_job_order_id) s
    WHERE NOT EXISTS (
      SELECT 1 FROM service_progress_tasks 
      WHERE job_order_id = p_job_order_id AND task_title = s.service_name AND section_id = 'in_progress'
    );
    
    -- Insert parts as in_progress tasks
    INSERT INTO service_progress_tasks (job_order_id, section_id, task_title, note, task_status, price, billable)
    SELECT p_job_order_id, 'in_progress', 'Part: ' || p.part_number, p.quantity::text || 'x ' || p.description, 'pending', p.total_retail_amount, true
    FROM get_job_order_parts(p_job_order_id) p
    WHERE NOT EXISTS (
      SELECT 1 FROM service_progress_tasks 
      WHERE job_order_id = p_job_order_id AND task_title = ('Part: ' || p.part_number) AND section_id = 'in_progress'
    );
  END IF;
END;
$$;

-- 3. Order Fetching Functions
CREATE OR REPLACE FUNCTION get_job_order_by_id(p_job_order_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, quotation_approved BOOLEAN, date_arrived TEXT,
started_at TEXT, date_promised TEXT, estimated_duration TEXT, actual_duration TEXT,
actual_grand_total TEXT, balance TEXT, vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR, user_id INTEGER
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.quotation_approved, jo.date_arrived::text,
jo.started_at::text, jo.date_promised::text, jo.estimated_duration::text,
jo.actual_duration::text, jo.actual_grand_total::text, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number, jo.user_id
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_customer_active_job_order(p_user_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, date_arrived TEXT, started_at TEXT, date_promised TEXT,
estimated_duration TEXT, actual_duration TEXT, actual_grand_total TEXT, balance TEXT,
vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.date_arrived::text, jo.started_at::text, jo.date_promised::text,
jo.estimated_duration::text, jo.actual_duration::text, jo.actual_grand_total::text, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.user_id = p_user_id
AND jo.status NOT IN ('released', 'completed')
ORDER BY jo.started_at DESC NULLS LAST
LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION get_customer_completed_job_order(p_user_id integer)
RETURNS TABLE (
job_order_id INTEGER, status TEXT, date_arrived TEXT, started_at TEXT, date_promised TEXT,
estimated_duration TEXT, actual_duration TEXT, actual_grand_total TEXT, balance TEXT,
vehicle_model VARCHAR, vehicle_year INTEGER, plate_number VARCHAR
)
LANGUAGE sql STABLE
AS $$
SELECT jo.id, jo.status::text, jo.date_arrived::text, jo.started_at::text, jo.date_promised::text,
jo.estimated_duration::text, jo.actual_duration::text, jo.actual_grand_total::text, jo.balance::text,
v.vehicle_model, v.vehicle_year, v.plate_number
FROM job_orders jo
JOIN vehicles v ON v.id = jo.vehicle_id
WHERE jo.user_id = p_user_id
AND jo.status IN ('completed', 'released')
ORDER BY jo.started_at DESC NULLS LAST
LIMIT 1;
$$;

-- 4. In Progress & Inspection
CREATE OR REPLACE FUNCTION get_job_order_tasks(p_job_order_id INTEGER)
RETURNS TABLE (
id INTEGER, section_id TEXT, task_title VARCHAR, note TEXT, task_status TEXT,
completed_at TEXT, price TEXT, billable BOOLEAN
)
LANGUAGE sql STABLE
AS $$
SELECT spt.id, spt.section_id::text, spt.task_title, spt.note,
spt.task_status, spt.completed_at::text, spt.price::text, spt.billable
FROM service_progress_tasks spt
WHERE spt.job_order_id = p_job_order_id
ORDER BY spt.id ASC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_ticket_notes(p_job_order_id integer)
RETURNS TABLE (customer_concern TEXT)
LANGUAGE sql STABLE
AS $$
SELECT st.customer_concern
FROM job_orders jo
JOIN service_tickets st ON st.id = jo.ticket_id
WHERE jo.id = p_job_order_id;
$$;

CREATE OR REPLACE FUNCTION get_vehicle_service_history(p_vehicle_id integer, p_exclude_job_order_id integer)
RETURNS TABLE (jo_date TEXT, service_name TEXT, actual_grand_total TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jo.jo_date::text,
(
SELECT s.service_name FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = jo.id LIMIT 1
) AS service_name,
jo.actual_grand_total::text
FROM job_orders jo
WHERE jo.vehicle_id = p_vehicle_id
AND jo.id != p_exclude_job_order_id
AND jo.status = 'released'
ORDER BY jo.jo_date DESC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_inspections(p_job_order_id integer)
RETURNS TABLE (
id INTEGER, name VARCHAR, status VARCHAR, photo TEXT, findings_description TEXT, logged_date TEXT
)
LANGUAGE sql STABLE
AS $$
SELECT vi.id, vi.name, vi.status, vi.photo, vi.findings_description, vi.logged_date::text
FROM vehicle_inspections vi
WHERE vi.job_order_id = p_job_order_id
ORDER BY vi.logged_date ASC;
$$;

-- 5. Payments
CREATE OR REPLACE FUNCTION submit_job_order_payment(p_job_order_id integer, p_payment_method payment_method, p_amount_paid numeric)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
v_payment_id integer;
BEGIN
INSERT INTO payments (job_order_id, payment_method, amount_paid, payment_date, verification_status)
VALUES (p_job_order_id, p_payment_method, p_amount_paid, NOW(), 'pending')
RETURNING id INTO v_payment_id;
RETURN v_payment_id;
END;
$function$;

CREATE OR REPLACE FUNCTION get_job_order_payment_status(p_job_order_id integer)
RETURNS TABLE (id integer, payment_method text, amount_paid text, verification_status text, payment_date text)
LANGUAGE sql STABLE
AS $function$
SELECT p.id, p.payment_method::text, p.amount_paid::text, p.verification_status::text, p.payment_date::text
FROM payments p
WHERE p.job_order_id = p_job_order_id
ORDER BY p.payment_date DESC
LIMIT 1;
$function$;

-- 6. Completed
CREATE OR REPLACE FUNCTION get_job_order_repair_logs(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, activity_description TEXT, log_time TIMESTAMP)
LANGUAGE sql STABLE
AS $$
SELECT rpl.id, rpl.activity_description, rpl.log_time
FROM repair_progress_logs rpl
WHERE rpl.job_order_id = p_job_order_id
ORDER BY rpl.log_time ASC;
$$;

CREATE OR REPLACE FUNCTION get_job_order_warranties(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, coverage_description TEXT, start_date TEXT, expiration_date TEXT, status TEXT)
LANGUAGE sql STABLE
AS $$
SELECT w.id, w.coverage_description, w.start_date::text, w.expiration_date::text, w.status::text
FROM warranties w
WHERE w.job_order_id = p_job_order_id
ORDER BY w.id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_invoice_services(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, service_name VARCHAR, description_of_work TEXT, estimated_hours NUMERIC, actual_hours NUMERIC, amount TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jos.id, s.service_name, jos.description_of_work, jos.estimated_hours, jos.actual_hours, jos.actual_amount::text
FROM job_order_services jos
JOIN services s ON s.id = jos.service_id
WHERE jos.job_order_id = p_job_order_id
ORDER BY jos.id;
$$;

CREATE OR REPLACE FUNCTION get_job_order_invoice_parts(p_job_order_id INTEGER)
RETURNS TABLE (id INTEGER, description TEXT, quantity INTEGER, retail_unit_price TEXT, total_retail_amount TEXT)
LANGUAGE sql STABLE
AS $$
SELECT jop.id, jop.description, jop.quantity, jop.retail_unit_price::text, jop.total_retail_amount::text
FROM job_order_parts jop
WHERE jop.job_order_id = p_job_order_id
ORDER BY jop.id;
$$;
