const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');
const fs = require('fs');
const os = require('os');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const BUCKET = 'job-orders';
const OUT_DIR = path.join(os.homedir(), 'AutoKita-Backups', 'photos');

function readEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(path.join(__dirname, '..', file), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

async function main() {
  const env = readEnv('.env.local');

  const ca = fs.readFileSync(path.join(__dirname, '..', 'certs', 'prod-ca-2021.crt')).toString();
  const db = new Pool({
    host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD,
    database: 'postgres', port: 5432, ssl: { rejectUnauthorized: true, ca },
  });
  const listed = (await db.query(
    `SELECT name, COALESCE((metadata->>'size')::bigint, 0) AS size
     FROM storage.objects WHERE bucket_id = $1 ORDER BY name`,
    [BUCKET],
  )).rows;
  await db.end();

  const localPath = (name) => path.join(OUT_DIR, ...name.split('/'));
  const insideBackupFolder = (p) => path.resolve(p).startsWith(path.resolve(OUT_DIR) + path.sep);
  const files = listed.filter((f) => insideBackupFolder(localPath(f.name)));
  if (files.length < listed.length) console.log(`Skipped ${listed.length - files.length} file(s) with an unsafe name.`);
  const todo = files.filter((f) => {
    const p = localPath(f.name);
    return !fs.existsSync(p) || fs.statSync(p).size !== Number(f.size);
  });

  const total = files.reduce((sum, f) => sum + Number(f.size), 0);
  const todoSize = todo.reduce((sum, f) => sum + Number(f.size), 0);
  console.log(APPLY ? 'DOWNLOAD mode.' : 'COUNT ONLY - nothing will be downloaded.');
  console.log(`Bucket "${BUCKET}": ${files.length} files, ${mb(total)}`);
  console.log(`Already saved: ${files.length - todo.length} | to download: ${todo.length}, ${mb(todoSize)}`);
  console.log(`Backup folder: ${OUT_DIR}`);

  if (!APPLY) {
    console.log('Run again with --apply to download.');
    return;
  }

  const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }).storage;
  let saved = 0, failed = 0;
  for (const f of todo) {
    const dl = await storage.from(BUCKET).download(f.name);
    if (dl.error) { failed++; console.log('  failed:', f.name, dl.error.message); continue; }
    const p = localPath(f.name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(await dl.data.arrayBuffer()));
    saved++;
    if (saved % 25 === 0) console.log(`  ${saved} / ${todo.length}`);
  }
  console.log(`Downloaded ${saved}, failed ${failed}.`);
}

main().catch((e) => { console.error('Stopped:', e.message); process.exitCode = 1; });
