const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, 'certs', 'prod-ca-2021.crt')).toString(),
  },
});

const SQL_DIR = path.join(__dirname, 'sql', 'Other');

const FILES = {
  truncate:    path.join(SQL_DIR, 'truncate_tables.sql'),
  baseline:    path.join(SQL_DIR, 'Migrations_postgresSQL.sql'),
  scenario_a:  path.join(SQL_DIR, 'Scenario_A_high_cost_time.sql'),
  scenario_b:  path.join(SQL_DIR, 'Scenario_B_low_cost_time.sql'),
};

const args = process.argv.slice(2);

function readSQL(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

async function runSQL(client, filePath, label) {
  console.log(`\n[${label}] Running: ${path.basename(filePath)}`);
  let sql = readSQL(filePath);

  const alterPattern = /ALTER TABLE\s+(\S+)\s+ADD COLUMN\s+([^;]+);/gi;
  const alters = [];
  sql = sql.replace(alterPattern, (match, table, columnDef) => {
    alters.push({ table: table.replace(/"/g, ''), columnDef: columnDef.trim() });
    return ''; // remove from main SQL
  });

  await client.query(sql);

  for (const { table, columnDef } of alters) {
    const colName = columnDef.split(/\s+/)[0].replace(/"/g, '');
    const safeSql = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = '${table}' AND column_name = '${colName}'
        ) THEN
          ALTER TABLE "${table}" ADD COLUMN ${columnDef};
        END IF;
      END $$;
    `;
    await client.query(safeSql);
  }

  console.log(`[${label}] ✓ Done`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('AutoKita Database Seeder');
  console.log('='.repeat(60));

  console.log('Mode    : Baseline + Scenario A + Scenario B');
  console.log('Profile : Full Spectrum (1500 records: New, Normal, and Old vehicles)');

  console.log('='.repeat(60));

  const client = await pool.connect();
  try {
    // Set a fixed seed at the start of the session so ALL subsequent SQL files and queries are deterministic
    await client.query('SELECT setseed(0.42);');

    // 1. Truncate
    await runSQL(client, FILES.truncate, '1/3 TRUNCATE');

    // 2. Baseline
    await runSQL(client, FILES.baseline, '2/3 BASELINE');

    // 3. Scenario A (Old Cars)
    await runSQL(client, FILES.scenario_a, '3/4 SCENARIO A');
    
    // 4. Scenario B (New Cars)
    await runSQL(client, FILES.scenario_b, '4/4 SCENARIO B');

    
    console.log('\n[POST-SEED FIX] Backfilling vehicle_make from vehicle_model...');
    await client.query(`
      UPDATE vehicles
      SET vehicle_make = CASE
        WHEN vehicle_model ILIKE '%toyota%' OR vehicle_model ILIKE '%hilux%' OR vehicle_model ILIKE '%vios%'
          OR vehicle_model ILIKE '%fortuner%' OR vehicle_model ILIKE '%innova%' OR vehicle_model ILIKE '%wigo%'
          OR vehicle_model ILIKE '%avanza%' OR vehicle_model ILIKE '%rush%' OR vehicle_model ILIKE '%camry%'
          OR vehicle_model ILIKE '%corolla%' OR vehicle_model ILIKE '%land cruiser%' OR vehicle_model ILIKE '%rav4%'
          THEN 'Toyota'
        WHEN vehicle_model ILIKE '%honda%' OR vehicle_model ILIKE '%civic%' OR vehicle_model ILIKE '%jazz%'
          OR vehicle_model ILIKE '%city%' OR vehicle_model ILIKE '%brio%' OR vehicle_model ILIKE '%crv%'
          OR vehicle_model ILIKE '%hrv%' OR vehicle_model ILIKE '%brv%' OR vehicle_model ILIKE '%mobilio%'
          THEN 'Honda'
        WHEN vehicle_model ILIKE '%mitsubishi%' OR vehicle_model ILIKE '%montero%' OR vehicle_model ILIKE '%strada%'
          OR vehicle_model ILIKE '%mirage%' OR vehicle_model ILIKE '%outlander%' OR vehicle_model ILIKE '%xpander%'
          OR vehicle_model ILIKE '%eclipse%' OR vehicle_model ILIKE '%adventure%'
          THEN 'Mitsubishi'
        WHEN vehicle_model ILIKE '%ford%' OR vehicle_model ILIKE '%ranger%' OR vehicle_model ILIKE '%everest%'
          OR vehicle_model ILIKE '%explorer%' OR vehicle_model ILIKE '%ecosport%' OR vehicle_model ILIKE '%territory%'
          THEN 'Ford'
        WHEN vehicle_model ILIKE '%nissan%' OR vehicle_model ILIKE '%navara%' OR vehicle_model ILIKE '%terra%'
          OR vehicle_model ILIKE '%almera%' OR vehicle_model ILIKE '%juke%' OR vehicle_model ILIKE '%x-trail%'
          OR vehicle_model ILIKE '%patrol%' OR vehicle_model ILIKE '%nv350%'
          THEN 'Nissan'
        WHEN vehicle_model ILIKE '%hyundai%' OR vehicle_model ILIKE '%tucson%' OR vehicle_model ILIKE '%santa fe%'
          OR vehicle_model ILIKE '%accent%' OR vehicle_model ILIKE '%reina%' OR vehicle_model ILIKE '%staria%'
          OR vehicle_model ILIKE '%kona%' OR vehicle_model ILIKE '%creta%'
          THEN 'Hyundai'
        WHEN vehicle_model ILIKE '%kia%' OR vehicle_model ILIKE '%picanto%' OR vehicle_model ILIKE '%soluto%'
          OR vehicle_model ILIKE '%sportage%' OR vehicle_model ILIKE '%carnival%' OR vehicle_model ILIKE '%seltos%'
          OR vehicle_model ILIKE '%stinger%'
          THEN 'Kia'
        WHEN vehicle_model ILIKE '%suzuki%' OR vehicle_model ILIKE '%swift%' OR vehicle_model ILIKE '%jimny%'
          OR vehicle_model ILIKE '%celerio%' OR vehicle_model ILIKE '%ertiga%' OR vehicle_model ILIKE '%xl7%'
          OR vehicle_model ILIKE '%vitara%' OR vehicle_model ILIKE '%dzire%'
          THEN 'Suzuki'
        WHEN vehicle_model ILIKE '%isuzu%' OR vehicle_model ILIKE '%d-max%' OR vehicle_model ILIKE '%mu-x%'
          OR vehicle_model ILIKE '%crosswind%' OR vehicle_model ILIKE '%sportivo%'
          THEN 'Isuzu'
        WHEN vehicle_model ILIKE '%mazda%' OR vehicle_model ILIKE '%cx-3%' OR vehicle_model ILIKE '%cx-5%'
          OR vehicle_model ILIKE '%cx-8%' OR vehicle_model ILIKE '%bt-50%'
          THEN 'Mazda'
        WHEN vehicle_model ILIKE '%chevrolet%' OR vehicle_model ILIKE '%trailblazer%' OR vehicle_model ILIKE '%colorado%'
          OR vehicle_model ILIKE '%spin%'
          THEN 'Chevrolet'
        WHEN vehicle_model ILIKE '%subaru%' OR vehicle_model ILIKE '%forester%' OR vehicle_model ILIKE '%outback%'
          OR vehicle_model ILIKE '%wrx%' OR vehicle_model ILIKE '%brz%' OR vehicle_model ILIKE '%xv%'
          THEN 'Subaru'
        WHEN vehicle_model ILIKE '%geely%' OR vehicle_model ILIKE '%coolray%' OR vehicle_model ILIKE '%okavango%'
          THEN 'Geely'
        WHEN vehicle_model ILIKE '%mg%' OR vehicle_model ILIKE '%zs%' OR vehicle_model ILIKE '%hs%'
          THEN 'MG'
        ELSE 'Toyota'  -- sensible default for seeded data
      END
      WHERE vehicle_make IS NULL OR vehicle_make = '';
    `);
    console.log('[POST-SEED FIX] ✔ vehicle_make backfill done');

    console.log('\n[POST-SEED FIX] Anchoring job order costs to base prices realistically...');
    await client.query('SELECT setseed(0.42);');
    await client.query(`
      UPDATE job_order_services jos
      SET 
        actual_amount = ROUND((s.base_price * (
          CASE 
            WHEN u.email LIKE '%highcost%' THEN (3.0 + RANDOM() * 2.0)
            WHEN u.email LIKE '%lowcost%' THEN (0.05 + RANDOM() * 0.2)
            ELSE (0.9 + RANDOM() * 0.3)
          END
        ))::numeric, 2),
        estimated_amount = ROUND((s.base_price * (
          CASE 
            WHEN u.email LIKE '%highcost%' THEN (2.8 + RANDOM() * 1.5)
            WHEN u.email LIKE '%lowcost%' THEN (0.05 + RANDOM() * 0.15)
            ELSE (0.9 + RANDOM() * 0.2)
          END
        ))::numeric, 2),
        estimated_duration = ((s.base_duration_hours * (
          CASE 
            WHEN u.email LIKE '%highcost%' THEN (3.0 + RANDOM() * 2.0)
            WHEN u.email LIKE '%lowcost%' THEN (0.05 + RANDOM() * 0.2)
            ELSE (0.9 + RANDOM() * 0.3)
          END
        ) * 3600)::int || ' seconds')::interval::time,
        actual_duration = ((s.base_duration_hours * (
          CASE 
            WHEN u.email LIKE '%highcost%' THEN (3.2 + RANDOM() * 2.5)
            WHEN u.email LIKE '%lowcost%' THEN (0.05 + RANDOM() * 0.25)
            ELSE (0.95 + RANDOM() * 0.4)
          END
        ) * 3600)::int || ' seconds')::interval::time
      FROM job_orders jo
      JOIN users u ON jo.user_id = u.id,
      services s
      WHERE jos.job_order_id = jo.id AND jos.service_id = s.id;
    `);
    
    await client.query(`
      UPDATE job_orders jo
      SET 
        actual_grand_total = (
          SELECT COALESCE(SUM(actual_amount), 0)
          FROM job_order_services
          WHERE job_order_id = jo.id
        ),
        estimated_grand_total = (
          SELECT COALESCE(SUM(estimated_amount), 0)
          FROM job_order_services
          WHERE job_order_id = jo.id
        ),
        balance = (
          SELECT COALESCE(SUM(actual_amount), 0)
          FROM job_order_services
          WHERE job_order_id = jo.id
        ) - jo.partial_payment
    `);
    console.log('[4/4 POST-SEED FIX] ✔ Done');

    console.log('\n' + '='.repeat(60));
    console.log('✓ Seeding complete!');

    console.log(`\nNext steps:`);
    console.log(`  1. .\\setup_ml.ps1 (do this if not done yet)`);
    console.log(`  2. .\\retrain_ml.ps1`);
    console.log('='.repeat(60));

  } catch (err) {
    console.error('\n✗ Seeding failed:', err.message || err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
