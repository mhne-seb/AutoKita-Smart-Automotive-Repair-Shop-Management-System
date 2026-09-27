// scripts/hash_existing_passwords.js
// One-time migration: replaces every plain-text password in users and
// employees with a bcrypt hash of that same password, so nobody's login
// changes. Rows already hashed (start with "$2") or empty are skipped.
//
//   node scripts/hash_existing_passwords.js          -> dry run, saves nothing
//   node scripts/hash_existing_passwords.js --apply  -> saves
//
// Everyone must be on the bcrypt login code before --apply: old code
// compares plain text and can't log anyone in once the rows are hashed.

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const APPLY = process.argv.includes('--apply');
const ROUNDS = 10; // same as src/lib/password.ts
const SPOT_CHECKS = 20;

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync(path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt')).toString(),
  },
});

async function hashTable(client, table) {
  const { rows } = await client.query(
    `SELECT id, password FROM ${table} WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2%' ORDER BY id`,
  );
  console.log(`${table}: ${rows.length} plain-text passwords to hash`);

  const checks = [];
  for (let i = 0; i < rows.length; i++) {
    const hash = await bcrypt.hash(rows[i].password, ROUNDS);
    await client.query(`UPDATE ${table} SET password = $1 WHERE id = $2`, [hash, rows[i].id]);
    if (checks.length < SPOT_CHECKS) checks.push({ plain: rows[i].password, hash });
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1} / ${rows.length}`);
  }

  // Proof nobody's password changed: each new hash must accept the old password.
  for (const c of checks) {
    if (!(await bcrypt.compare(c.plain, c.hash))) throw new Error(`${table}: a new hash did not match its old password`);
  }

  const left = await client.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE password IS NOT NULL AND password <> '' AND password NOT LIKE '$2%'`,
  );
  if (left.rows[0].n !== 0) throw new Error(`${table}: ${left.rows[0].n} plain-text passwords still left`);
  console.log(`  done — ${checks.length} spot checks passed, 0 plain-text left`);
}

async function main() {
  const client = await pool.connect();
  try {
    console.log(APPLY ? 'APPLY mode — changes will be saved.' : 'DRY RUN — nothing will be saved.');
    await client.query('BEGIN');
    await hashTable(client, 'users');
    await hashTable(client, 'employees');
    if (APPLY) {
      await client.query('COMMIT');
      console.log('Saved.');
    } else {
      await client.query('ROLLBACK');
      console.log('Dry run finished and rolled back. Run again with --apply to save.');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Stopped, nothing saved:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
