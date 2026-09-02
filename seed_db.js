/**
 * seed_db.js
 *
 * Usage:
 *   node seed_db.js                  → Baseline + Scenario A + Scenario B
 *
 * The script always:
 *   1. Truncates all tables
 *   2. Runs the 500-record baseline migration
 *   3. Runs the 500-record Scenario A (Old cars / High Cost)
 *   4. Runs the 500-record Scenario B (New cars / Low Cost)
 */

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '.env.local') });

// ── Database connection ──────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port:     parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync('certs/prod-ca-2021.crt').toString(),
  },
});

// ── File paths ───────────────────────────────────────────────────────────────
const SQL_DIR = path.join(__dirname, 'sql', 'Other');

const FILES = {
  truncate:    path.join(SQL_DIR, 'truncate_tables.sql'),
  baseline:    path.join(SQL_DIR, 'Migrations_postgresSQL.sql'),
  scenario_a:  path.join(SQL_DIR, 'Scenario_A_high_cost_time.sql'),
  scenario_b:  path.join(SQL_DIR, 'Scenario_B_low_cost_time.sql'),
};

// ── Argument parsing ─────────────────────────────────────────────────────────
// Flags are no longer needed; we seed everything.
const args = process.argv.slice(2);

// ── Helpers ──────────────────────────────────────────────────────────────────
function readSQL(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`SQL file not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

async function runSQL(client, filePath, label) {
  console.log(`\n[${label}] Running: ${path.basename(filePath)}`);
  let sql = readSQL(filePath);

  // The baseline file (Migrations_postgresSQL.sql) has bare ALTER TABLE statements
  // at the very end that fail if the columns already exist in the schema.
  // We pull them out and re-wrap them with IF NOT EXISTS guards.
  const alterPattern = /ALTER TABLE\s+(\S+)\s+ADD COLUMN\s+([^;]+);/gi;
  const alters = [];
  sql = sql.replace(alterPattern, (match, table, columnDef) => {
    alters.push({ table: table.replace(/"/g, ''), columnDef: columnDef.trim() });
    return ''; // remove from main SQL
  });

  // Run the main SQL body
  await client.query(sql);

  // Re-run each ALTER TABLE safely
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

// ── Main ─────────────────────────────────────────────────────────────────────
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
