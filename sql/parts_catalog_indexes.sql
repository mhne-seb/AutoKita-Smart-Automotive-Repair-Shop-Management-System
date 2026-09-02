CREATE INDEX IF NOT EXISTS idx_part_catalog_oem
  ON part_catalog (oem_part_number);

CREATE INDEX IF NOT EXISTS idx_part_catalog_name_lower
  ON part_catalog (lower(part_name) varchar_pattern_ops);


CREATE INDEX IF NOT EXISTS idx_part_catalog_category
  ON part_catalog (part_category);

CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_make_model
  ON vehicle_catalog (make, model);

CREATE INDEX IF NOT EXISTS idx_vehicle_catalog_years
  ON vehicle_catalog (year_start, year_end);

CREATE INDEX IF NOT EXISTS idx_part_fitments_vehicle
  ON part_fitments (vehicle_catalog_id);

CREATE INDEX IF NOT EXISTS idx_part_fitments_part
  ON part_fitments (part_catalog_id);
