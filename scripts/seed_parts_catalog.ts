import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

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


const PARTS_DIR = path.join(process.cwd(), 'src', 'data', 'parts_catalogs');

const VEHICLE_SPECS = [
  { key: 'hilux', make: 'Toyota', model: 'Hilux', year_start: 2005, year_end: 2011, trim_variant: 'Vigo', fuel_type: 'Diesel' },
  { key: 'vios',  make: 'Toyota', model: 'Vios',  year_start: 2005, year_end: 2011, trim_variant: 'NCP',  fuel_type: 'Gasoline' },
] as const;


const CATEGORY_FROM_FILENAME: Record<string, string> = {
  body:              'Body',
  chassis_driveline: 'Chassis & Driveline',
  electrical:        'Electrical',
  engine_fuel_tool:  'Engine & Fuel',
};


interface ParsedPart {
  oem_part_number: string;
  part_name: string;
  part_category: string;
  section_code: string;   
  section_name: string;   
  remarks: string;
}



function parsePartsFromMarkdown(content: string, broadCategory: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  const lines = content.split(/\r?\n/);

  let currentSectionCode = '';
  let currentSectionName = '';
  let inTable = false;
  let headerParsed = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const sectionMatch = line.match(/^###\s+(\w+)\s+-\s+(.+)$/);
    if (sectionMatch) {
      currentSectionCode = sectionMatch[1].trim();
      currentSectionName = sectionMatch[2].trim();
      inTable = false;
      headerParsed = false;
      continue;
    }

    if (!line.startsWith('|')) {
      if (inTable) {
        inTable = false;
        headerParsed = false;
      }
      continue;
    }

    const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);

    if (cells.length < 4) continue;

    if (cells.every(c => /^-+$/.test(c))) {
      inTable = true;
      headerParsed = false;
      continue;
    }


    if (!headerParsed && cells[0].toLowerCase().includes('callout')) {
      inTable = true;
      headerParsed = true;
      continue;
    }

    if (!inTable) continue;

    const partNumber = cells[1]?.replace(/\*/g, '').trim();
    const partName   = cells[2]?.trim();
    const remarks    = cells[4]?.trim() ?? '';

    
    if (!partNumber || partNumber === '' || partNumber === '-') continue;
    
    if (!partName || partName === '') continue;
    
    if (!/^[A-Z0-9-]{5,}$/i.test(partNumber)) continue;

    parts.push({
      oem_part_number: partNumber.substring(0, 60),
      part_name:       partName.substring(0, 100),
      part_category:   broadCategory,
      section_code:    currentSectionCode,
      section_name:    currentSectionName.substring(0, 80),
      remarks:         remarks.substring(0, 100),
    });
  }

  return parts;
}

async function main() {
  console.log('='.repeat(60));
  console.log('  AutoKita — Parts Catalog DB Seeder');
  console.log('  Scope: Toyota Hilux & Vios (2005–2011)');
  console.log('='.repeat(60));

  const client = await pool.connect();

  try {
    console.log('\n[1/4] Upserting vehicle catalog entries...');
    const vehicleIds: Record<string, number> = {};

    for (const spec of VEHICLE_SPECS) {
      const res = await client.query<{ id: number }>(`
        INSERT INTO vehicle_catalog (make, model, year_start, year_end, trim_variant, fuel_type)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [spec.make, spec.model, spec.year_start, spec.year_end, spec.trim_variant, spec.fuel_type]);

      let id: number;
      if (res.rows.length > 0) {
        id = res.rows[0].id;
        console.log(`  [+] Inserted vehicle: Toyota ${spec.model} ${spec.year_start}–${spec.year_end} (id=${id})`);
      } else {
        
        const existing = await client.query<{ id: number }>(
          `SELECT id FROM vehicle_catalog WHERE make=$1 AND model=$2 AND year_start=$3 AND year_end=$4 LIMIT 1`,
          [spec.make, spec.model, spec.year_start, spec.year_end]
        );
        id = existing.rows[0].id;
        console.log(`  [~] Already exists: Toyota ${spec.model} ${spec.year_start}–${spec.year_end} (id=${id})`);
      }
      vehicleIds[spec.key] = id;
    }

    
    console.log('\n[2/4] Clearing existing part fitments for Hilux/Vios...');
    const idList = Object.values(vehicleIds).join(',');
    const delRes = await client.query(
      `DELETE FROM part_fitments WHERE vehicle_catalog_id IN (${idList})`
    );
    console.log(`  Removed ${delRes.rowCount ?? 0} existing fitment rows`);

    console.log('\n[3/4] Parsing parts catalog files...');

    const files = fs.readdirSync(PARTS_DIR).filter(f => f.endsWith('.md'));
    console.log(`  Found ${files.length} catalog files`);

    let totalParts    = 0;
    let totalFitments = 0;
    const batchSize = 50;

    for (const file of files.sort()) {
      // Determine vehicle key (hilux | vios) and category from filename
      const vehicleKey = file.includes('hilux') ? 'hilux' : file.includes('vios') ? 'vios' : null;
      if (!vehicleKey) { console.log(`  [!] Skipped (unknown vehicle): ${file}`); continue; }

      const categoryKey = Object.keys(CATEGORY_FROM_FILENAME).find(k => file.includes(k));
      const broadCategory = categoryKey ? CATEGORY_FROM_FILENAME[categoryKey] : 'General';

      const vehicleId = vehicleIds[vehicleKey];
      const content = fs.readFileSync(path.join(PARTS_DIR, file), 'utf-8');
      const parts = parsePartsFromMarkdown(content, broadCategory);

      console.log(`\n  [${file}]`);
      console.log(`    Vehicle  : Toyota ${vehicleKey === 'hilux' ? 'Hilux' : 'Vios'}  |  Category: ${broadCategory}`);
      console.log(`    Parsed   : ${parts.length} parts`);

      if (parts.length === 0) continue;

      let fileParts    = 0;
      let fileFitments = 0;

      for (let i = 0; i < parts.length; i += batchSize) {
        const batch = parts.slice(i, i + batchSize);

        for (const part of batch) {
          const partRes = await client.query<{ id: number }>(`
            INSERT INTO part_catalog (oem_part_number, brand, part_category, part_name, is_oem, description)
            VALUES ($1, 'Toyota', $2, $3, true, $4)
            ON CONFLICT (oem_part_number) DO UPDATE
              SET part_name     = EXCLUDED.part_name,
                  part_category = EXCLUDED.part_category,
                  brand         = EXCLUDED.brand,
                  is_oem        = EXCLUDED.is_oem
            RETURNING id
          `, [
            part.oem_part_number,
            part.part_category,
            part.part_name,
            `Section: ${part.section_code} – ${part.section_name}`,
          ]);

          const partId = partRes.rows[0]?.id;
          if (!partId) continue;

          const notes = (part.remarks
            ? part.remarks
            : `${part.section_code} – ${part.section_name}`
          ).substring(0, 100);

          await client.query(`
            INSERT INTO part_fitments (vehicle_catalog_id, part_catalog_id, notes)
            VALUES ($1, $2, $3)
          `, [vehicleId, partId, notes]);

          fileParts++;
          fileFitments++;
        }
      }

      console.log(`    Upserted : ${fileParts} parts, ${fileFitments} fitments`);
      totalParts    += fileParts;
      totalFitments += fileFitments;
    }

    console.log('\n[4/4] Verifying row counts...');
    const pcCount = await client.query('SELECT COUNT(*) FROM part_catalog');
    const pfCount = await client.query('SELECT COUNT(*) FROM part_fitments');
    const vcCount = await client.query('SELECT COUNT(*) FROM vehicle_catalog');

    console.log(`\n${'='.repeat(60)}`);
    console.log('  ✓ Seed Complete!');
    console.log(`  vehicle_catalog rows     : ${vcCount.rows[0].count}`);
    console.log(`  part_catalog rows        : ${pcCount.rows[0].count}`);
    console.log(`  part_fitments rows       : ${pfCount.rows[0].count}`);
    console.log(`  Parts upserted this run  : ${totalParts}`);
    console.log(`  Fitments created this run: ${totalFitments}`);
    console.log('='.repeat(60));
    console.log('\n  Next: apply sql/parts_catalog_indexes.sql (first run only)');
    console.log('  Then test the admin chatbot parts lookup tools.\n');

  } catch (err) {
    console.error('\n✗ Seeding failed:', (err as Error).message ?? err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
