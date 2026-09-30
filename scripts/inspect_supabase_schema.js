const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: false
  }
});

async function main() {
  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);
  console.log('Total tables in Supabase:', tablesRes.rows.length);
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log('Tables:', JSON.stringify(tables));

  const colsRes = await pool.query(`
    SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
    ORDER BY table_name, ordinal_position;
  `);

  const schema = {};
  for (const row of colsRes.rows) {
    if (!schema[row.table_name]) schema[row.table_name] = [];
    schema[row.table_name].push({
      column: row.column_name,
      type: row.data_type === 'USER-DEFINED' ? row.udt_name : row.data_type,
      length: row.character_maximum_length,
      nullable: row.is_nullable,
      default: row.column_default
    });
  }

  fs.writeFileSync('live_supabase_schema.json', JSON.stringify(schema, null, 2));
  console.log('Saved live_supabase_schema.json successfully!');
  await pool.end();
}

main().catch(err => { console.error('Connection error:', err.message); process.exit(1); });
