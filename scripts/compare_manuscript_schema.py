import json

supabase = json.load(open('live_supabase_schema.json', encoding='utf-8'))

manuscript_dict = {
    'users': ['id', 'email', 'nickname', 'password', 'first_name', 'last_name', 'contact_number', 'address', 'registration_date'],
    'employees': ['id', 'full_name', 'email', 'contact_number', 'role', 'hire_date', 'EOC', 'status'],
    'shops': ['id', 'name', 'address', 'contact_number', 'email', 'owner_id', 'operating_hours'],
    'services': ['id', 'shop_id', 'service_name', 'description', 'base_price', 'base_duration_hours', 'is_price_fixed', 'is_active'],
    'vehicles': ['id', 'user_id', 'vin', 'plate_number', 'vehicle_model', 'vehicle_year', 'vehicle_type'],
    'service_tickets': ['id', 'user_id', 'vehicle_id', 'service_mode', 'home_service_address', 'customer_concern', 'ticket_status', 'request_date'],
    'job_orders': ['id', 'ticket_id', 'user_id', 'vehicle_id', 'jo_date', 'date_arrived', 'date_promised', 'started_at', 'completed_at', 'released_at', 'estimated_duration', 'actual_duration', 'grand_total', 'partial_payment', 'balance', 'status'],
    'suppliers': ['id', 'supplier_name', 'contact_person', 'contact_number', 'email', 'address', 'is_active', 'description'],
    'subcontracted_services': ['id', 'job_order_id', 'supplier_id', 'description_of_work', 'date_informed', 'date_started', 'date_ended', 'supplier_cost', 'retail_price'],
    'purchase_orders': ['id', 'supplier_id', 'order_date', 'expected_delivery_date', 'actual_delivery_date', 'total_supplier_cost', 'status'],
    'job_order_parts': ['id', 'job_order_id', 'purchase_order_id', 'status', 'part_number', 'description', 'quantity', 'retail_unit_price', 'total_retail_amount', 'supplier_unit_cost'],
    'job_order_services': ['id', 'job_order_id', 'service_id', 'description_of_work', 'estimated_duration', 'actual_duration', 'amount'],
    'vehicle_inspections': ['id', 'job_order_id', 'findings_description', 'logged_date'],
    'repair_progress_logs': ['id', 'job_order_id', 'activity_description', 'log_time'],
    'payments': ['id', 'job_order_id', 'payment_method', 'proof_of_payment_image', 'amount_paid', 'payment_date', 'verification_status'],
    'warranties': ['id', 'job_order_id', 'coverage_description', 'start_date', 'expiration_date', 'status'],
    'retention_offers': ['id', 'user_id', 'promo_code', 'offer_type', 'discount_value', 'description', 'issue_date', 'expiration_date', 'is_claimed', 'claimed_on_job_order_id'],
    'system_audit_logs': ['id', 'user_id', 'employees_id', 'action_performed', 'entity_type', 'entity_id', 'old_values', 'new_values', 'action_date'],
    'payroll_summaries': ['id', 'employee_id', 'period_start', 'period_end', 'base_pay', 'commission_pay', 'deductions', 'net_pay', 'status', 'date_generated', 'payment_date'],
    'chat_sessions': ['id', 'customer_user_id', 'assigned_employee_id', 'reference_type', 'reference_id', 'session_status', 'started_at', 'last_activity_at'],
    'chat_messages': ['id', 'session_id', 'sender_type', 'sender_id', 'message_text', 'sent_at', 'is_read_by_customer', 'is_read_by_admin'],
    'vehicle_catalog': ['id', 'make', 'model', 'year_start', 'year_end', 'trim_variant', 'engine_type', 'transmission', 'drive_type', 'fuel_type'],
    'part_catalog': ['id', 'oem_part_number', 'brand', 'part_category', 'part_name', 'is_oem', 'description'],
    'part_fitments': ['id', 'vehicle_catalog_id', 'part_catalog_id', 'notes'],
    'internal_ai_sessions': ['id', 'employee_id', 'query_category', 'context_vehicle_id', 'started_at'],
    'internal_ai_messages': ['id', 'session_id', 'sender', 'message_text', 'sent_at'],
    'pre_diagnostics': ['id', 'job_order_id', 'mechanic_notes', 'customer_approval_status', 'datetime_created', 'datetime_approved']
}

print("=" * 80)
print("1. ENTIRELY MISSING TABLES (Exist in Supabase, but NOT in Manuscript Data Dictionary)")
print("=" * 80)
supabase_tables = set(supabase.keys())
manuscript_tables = set(manuscript_dict.keys())
missing_tables = sorted(list(supabase_tables - manuscript_tables))

for idx, t in enumerate(missing_tables, 1):
    cols = supabase[t]
    print(f"\n[{idx}] TABLE: {t}")
    print(f"    Total Columns: {len(cols)}")
    print(f"    Columns:")
    for c in cols:
        print(f"      - {c['column']:<28} | Type: {c['type']:<20} | Nullable: {c['nullable']:<5} | Default: {c['default']}")

print("\n" + "=" * 80)
print("2. COLUMN DIFFERENCES IN EXISTING TABLES (Columns in Supabase NOT in Manuscript)")
print("=" * 80)

for t, m_cols in manuscript_dict.items():
    s_cols_info = {c['column']: c for c in supabase.get(t, [])}
    s_cols = set(s_cols_info.keys())
    m_set = set(m_cols)
    
    added_in_db = sorted(list(s_cols - m_set))
    missing_in_db = sorted(list(m_set - s_cols))
    
    if added_in_db or missing_in_db:
        print(f"\nTABLE: {t}")
        if added_in_db:
            print(f"  [+] Added Columns in Supabase (Missing in Manuscript Table):")
            for col in added_in_db:
                cinfo = s_cols_info[col]
                print(f"      * {col:<26} | Type: {cinfo['type']:<20} | Nullable: {cinfo['nullable']:<5} | Default: {cinfo['default']}")
        if missing_in_db:
            print(f"  [-] Columns in Manuscript with Different Name / Missing in Supabase:")
            for col in missing_in_db:
                print(f"      * {col}")
