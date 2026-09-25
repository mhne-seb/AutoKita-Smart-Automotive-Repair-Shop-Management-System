/**
 * scripts/seed_1000_jobs.ts
 *
 * Inserts 1,000 diverse job order instances spanning Jan 2024 – Sep 2026.
 * Run with: npx tsx --env-file=.env.local scripts/seed_1000_jobs.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../src/lib/db';

// ── UTILITIES ─────────────────────────────────────────────────────────────────
const rnd   = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick  = <T>(arr: T[]) => arr[rnd(0, arr.length - 1)];
const chance = (p: number) => Math.random() < p;
const addH  = (d: Date, hrs: number)  => new Date(d.getTime() + hrs  * 3_600_000);
const esc   = (s: string) => s.replace(/'/g, "''");   // SQL-safe single-quote escape
const fmt   = (d: Date)   => d.toISOString();
const fmtD  = (d: Date)   => d.toISOString().slice(0, 10);

function fmtTime(hrs: number): string {
  // PostgreSQL TIME type max is 23:59:59 — clamp multi-day jobs
  if (hrs >= 24) return '23:59:59';
  const hh = Math.floor(hrs);
  const mm = Math.round((hrs - hh) * 60);
  if (mm >= 60) return `${String(hh + 1).padStart(2, '0')}:00:00`;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`;
}

// ── DATA POOLS ────────────────────────────────────────────────────────────────
const FIRST_NAMES = [
  'Ana','Marco','Liza','Rey','Joy','Dennis','Carla','Edwin','Grace','Anton',
  'Noel','Pia','Renz','Shari','Tito','Vince','Wendy','Zach','Abby','Ben',
  'Cora','Dante','Ella','Felix','Gina','Hector','Iris','Jose','Kara','Leo',
  'Maria','Nina','Oscar','Paula','Rosa','Simon','Tess','Uma','Vic','Wilma',
  'Arvin','Belen','Carlo','Delia','Edgar','Fely','Gemma','Horacio','Imelda','Joel',
];
const LAST_NAMES = [
  'Santos','Cruz','Garcia','Reyes','Flores','Lopez','Torres','Ramos',
  'Mendoza','Bautista','Castillo','Aquino','Villanueva','Aguilar','Soriano',
  'Gutierrez','Navarro','Lim','Tan','Ong','Padilla','Herrera','Valencia',
  'Miranda','Espinosa','De Leon','Diaz','Fernandez','Jimenez','Perez',
];
const STREETS = [
  'Rizal Ave','Mabini St','Luna St','Taft Ave','Bonifacio St',
  'Katipunan Ave','Commonwealth Ave','EDSA','Aurora Blvd','Quezon Ave',
  'Shaw Blvd','Ortigas Ave','C5 Road','Marcos Hwy','Aguinaldo Blvd',
];
const CITIES = [
  'Manila','Quezon City','Makati','Pasig','Taguig','Marikina',
  'Caloocan','Mandaluyong','Valenzuela','Las Pinas',
  'Paranaque','Muntinlupa','Antipolo','San Juan','Pasay',
];
const VEHICLES_POOL = [
  {make:'Toyota',model:'Vios',type:'Sedan'},
  {make:'Toyota',model:'Hilux',type:'Pickup'},
  {make:'Toyota',model:'Innova',type:'Van'},
  {make:'Toyota',model:'Fortuner',type:'SUV'},
  {make:'Toyota',model:'Wigo',type:'Hatchback'},
  {make:'Toyota',model:'Avanza',type:'Crossover'},
  {make:'Toyota',model:'Hiace',type:'Van'},
  {make:'Toyota',model:'Corolla Altis',type:'Sedan'},
  {make:'Mitsubishi',model:'Xpander',type:'Crossover'},
  {make:'Mitsubishi',model:'Montero Sport',type:'SUV'},
  {make:'Mitsubishi',model:'Mirage G4',type:'Sedan'},
  {make:'Mitsubishi',model:'L300',type:'Van'},
  {make:'Mitsubishi',model:'Strada',type:'Pickup'},
  {make:'Honda',model:'City',type:'Sedan'},
  {make:'Honda',model:'BR-V',type:'SUV'},
  {make:'Honda',model:'Jazz',type:'Hatchback'},
  {make:'Honda',model:'CR-V',type:'SUV'},
  {make:'Hyundai',model:'Accent',type:'Sedan'},
  {make:'Hyundai',model:'Tucson',type:'SUV'},
  {make:'Nissan',model:'Navara',type:'Pickup'},
  {make:'Nissan',model:'Almera',type:'Sedan'},
  {make:'Ford',model:'Ranger',type:'Pickup'},
  {make:'Isuzu',model:'D-Max',type:'Pickup'},
  {make:'Suzuki',model:'Ertiga',type:'Crossover'},
  {make:'Kia',model:'Picanto',type:'Hatchback'},
];
const VYEARS = [2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023];
const PAY_METHODS = ['cash','e_wallet','bank_transfer','credit_card','debit_card'] as const;
const PAY_CHANNELS: Record<string, string[]> = {
  cash:          [''],
  e_wallet:      ['GCash','Maya','ShopeePay'],
  bank_transfer: ['BDO','BPI','Metrobank','UnionBank'],
  credit_card:   ['BDO Visa','BPI Mastercard','RCBC Visa'],
  debit_card:    ['BDO ATM','BPI ATM','Metrobank ATM'],
};
const CONCERNS = [
  'Vehicle making noise when braking',
  'Check engine light is on',
  'Air conditioning not cooling properly',
  'Car overheating frequently',
  'Engine oil leaking',
  'Transmission slipping',
  'Rough idle and engine shaking',
  'Battery keeps dying',
  'Suspension feels rough over bumps',
  'Brake pedal feels soft',
  'Car vibrating at high speed',
  'Steering wheel shaking',
  'Power steering feels stiff',
  'Starting difficulty',
  'Clutch pedal feels different',
  'For preventive maintenance check-up',
  'Annual PMS service',
  'For general inspection before long trip',
  'Unusual smell from engine bay',
  'Warning light appeared on dashboard',
];
const QUOT_NOTES = [
  'Inspection complete. Parts sourced from trusted suppliers. Labor rate standard.',
  'Vehicle requires immediate attention. Recommend proceeding with listed services.',
  'Parts have been verified OEM spec. Work will begin upon approval.',
  'Estimate based on initial assessment. Additional charges possible if hidden damage found.',
  'All parts in stock. Work can start same day upon approval.',
  'Sourced quality aftermarket parts as OEM equivalent. Covered by standard warranty.',
];
const PROG_LOGS = [
  'Vehicle received and initial assessment completed.',
  'Customer concern documented. Proceeding with diagnostic inspection.',
  'Inspection complete. Parts requisition submitted for approval.',
  'Parts received from supplier. Work commencing.',
  'Service in progress. Technician assigned.',
  'Midway through service. No additional issues found.',
  'All services completed. Quality check in progress.',
  'Vehicle cleaned and prepared for customer pickup.',
  'Customer notified of completion. Awaiting pickup.',
  'Payment received and vehicle released to customer.',
];

// ── SERVICE PACKAGES ─────────────────────────────────────────────────────────
type PType = 'A' | 'B' | 'C' | 'D';
interface Svc { id: number; name: string; price: number; hours: number; }
interface Part { desc: string; qty: number; retail: number; cost: number; }
interface Pkg { type: PType; svcs: Svc[]; parts: Part[]; }

const PKGS: Pkg[] = [
  // ── TYPE A: Quick (1 service) ─────────────────────────────────────────────
  { type:'A', svcs:[{id:1,name:'Change Oil',price:650,hours:0.75}],
    parts:[{desc:'Engine Oil 10W-40 (5L)',qty:1,retail:600,cost:420},{desc:'Oil Filter',qty:1,retail:250,cost:175}] },

  { type:'A', svcs:[{id:4,name:'Replace Air Filter',price:550,hours:0.25}],
    parts:[{desc:'Air Filter',qty:1,retail:650,cost:455}] },

  { type:'A', svcs:[{id:5,name:'Replace Cabin Filter',price:200,hours:0.25}],
    parts:[{desc:'Cabin Filter',qty:1,retail:450,cost:315}] },

  { type:'A', svcs:[{id:12,name:'Replace Spark Plugs',price:300,hours:0.50}],
    parts:[{desc:'Iridium Spark Plugs',qty:4,retail:380,cost:266}] },

  { type:'A', svcs:[{id:19,name:'Wheel Balancing',price:500,hours:0.50}],
    parts:[] },

  { type:'A', svcs:[{id:39,name:'Coolant Flush',price:350,hours:0.75}],
    parts:[{desc:'Coolant (1.5L)',qty:1,retail:450,cost:315}] },

  { type:'A', svcs:[{id:10,name:'Throttle Body Cleaning',price:550,hours:0.75}],
    parts:[{desc:'Throttle Body Cleaner Spray',qty:1,retail:350,cost:245}] },

  { type:'A', svcs:[{id:44,name:'Battery Testing and Replacement',price:300,hours:0.25}],
    parts:[{desc:'Battery 55Ah MF',qty:1,retail:4500,cost:3150}] },

  { type:'A', svcs:[{id:58,name:'General Mechanical Inspection and Check-Up',price:800,hours:0.50}],
    parts:[] },

  { type:'A', svcs:[{id:48,name:'Replace Fan Belt / Serpentine Belt',price:1100,hours:1.00}],
    parts:[{desc:'Fan Belt / Serpentine Belt',qty:1,retail:850,cost:595}] },

  // ── TYPE B: Mid-range (2 services) ───────────────────────────────────────
  { type:'B', svcs:[{id:1,name:'Change Oil',price:650,hours:0.75},{id:4,name:'Replace Air Filter',price:550,hours:0.25}],
    parts:[{desc:'Engine Oil 10W-40 (5L)',qty:1,retail:600,cost:420},{desc:'Oil Filter',qty:1,retail:250,cost:175},{desc:'Air Filter',qty:1,retail:650,cost:455}] },

  { type:'B', svcs:[{id:14,name:'Replace Brake Pads',price:600,hours:1.00},{id:13,name:'Brake Service and Cleaning',price:800,hours:1.25}],
    parts:[{desc:'Front Brake Pads',qty:1,retail:1200,cost:840},{desc:'Brake Fluid DOT4 (1L)',qty:1,retail:350,cost:245}] },

  { type:'B', svcs:[{id:18,name:'Wheel Alignment',price:900,hours:1.00},{id:19,name:'Wheel Balancing',price:500,hours:0.50}],
    parts:[] },

  { type:'B', svcs:[{id:3,name:'Replace Fuel Filter',price:550,hours:0.75},{id:1,name:'Change Oil',price:650,hours:0.75}],
    parts:[{desc:'Fuel Filter',qty:1,retail:850,cost:595},{desc:'Engine Oil 10W-40 (5L)',qty:1,retail:600,cost:420},{desc:'Oil Filter',qty:1,retail:250,cost:175}] },

  { type:'B', svcs:[{id:43,name:'Engine Diagnostics and Electrical Scan',price:1500,hours:0.75},{id:44,name:'Battery Testing and Replacement',price:300,hours:0.25}],
    parts:[{desc:'Battery 55Ah MF',qty:1,retail:4500,cost:3150}] },

  { type:'B', svcs:[{id:20,name:'Tire Rotation and Balancing',price:800,hours:0.75},{id:18,name:'Wheel Alignment',price:900,hours:1.00}],
    parts:[] },

  { type:'B', svcs:[{id:27,name:'Replace Stabilizer Link',price:700,hours:0.75},{id:28,name:'Replace Stabilizer Bushing',price:600,hours:0.75}],
    parts:[{desc:'Stabilizer Link',qty:2,retail:850,cost:595},{desc:'Stabilizer Bushing',qty:2,retail:450,cost:315}] },

  { type:'B', svcs:[{id:15,name:'Replace Brake Shoes',price:800,hours:1.00},{id:13,name:'Brake Service and Cleaning',price:800,hours:1.25}],
    parts:[{desc:'Rear Brake Shoes',qty:1,retail:1100,cost:770},{desc:'Brake Fluid DOT4 (1L)',qty:1,retail:350,cost:245}] },

  { type:'B', svcs:[{id:23,name:'Replace Tie Rod End',price:800,hours:1.00},{id:18,name:'Wheel Alignment',price:900,hours:1.00}],
    parts:[{desc:'Tie Rod End',qty:2,retail:1200,cost:840}] },

  // ── TYPE C: Heavy (3–4 services) ──────────────────────────────────────────
  { type:'C', svcs:[{id:49,name:'Replace Timing Belt / Chain',price:3500,hours:4.00},{id:39,name:'Coolant Flush',price:350,hours:0.75},{id:41,name:'Replace Water Pump',price:2500,hours:2.00}],
    parts:[{desc:'Timing Belt',qty:1,retail:4200,cost:2940},{desc:'Water Pump',qty:1,retail:3800,cost:2660},{desc:'Coolant (1.5L)',qty:1,retail:450,cost:315},{desc:'Tensioner Pulley',qty:1,retail:1800,cost:1260}] },

  { type:'C', svcs:[{id:21,name:'Replace Shock Absorbers',price:1200,hours:2.00},{id:18,name:'Wheel Alignment',price:900,hours:1.00},{id:19,name:'Wheel Balancing',price:500,hours:0.50}],
    parts:[{desc:'Front Shock Absorbers',qty:2,retail:2800,cost:1960},{desc:'Rear Shock Absorbers',qty:2,retail:2600,cost:1820}] },

  { type:'C', svcs:[{id:37,name:'Air Conditioning Cleaning and Freon Charge',price:3500,hours:3.00},{id:39,name:'Coolant Flush',price:350,hours:0.75}],
    parts:[{desc:'Refrigerant R134a (500g)',qty:1,retail:1800,cost:1260},{desc:'A/C Filter Drier',qty:1,retail:950,cost:665},{desc:'Coolant (1.5L)',qty:1,retail:450,cost:315}] },

  { type:'C', svcs:[{id:9,name:'Cleaning EGR',price:4500,hours:3.50},{id:10,name:'Throttle Body Cleaning',price:550,hours:0.75},{id:1,name:'Change Oil',price:650,hours:0.75}],
    parts:[{desc:'EGR Gasket',qty:1,retail:850,cost:595},{desc:'Throttle Body Cleaner',qty:1,retail:350,cost:245},{desc:'Engine Oil 10W-40 (5L)',qty:1,retail:600,cost:420},{desc:'Oil Filter',qty:1,retail:250,cost:175}] },

  { type:'C', svcs:[{id:22,name:'Replace Suspension Bushing',price:1500,hours:2.50},{id:30,name:'Replace Ball Joint',price:1200,hours:1.25},{id:18,name:'Wheel Alignment',price:900,hours:1.00}],
    parts:[{desc:'Suspension Bushings Set',qty:1,retail:2200,cost:1540},{desc:'Ball Joint',qty:2,retail:1800,cost:1260}] },

  { type:'C', svcs:[{id:45,name:'Alternator Repair / Replacement',price:1800,hours:1.50},{id:43,name:'Engine Diagnostics and Electrical Scan',price:1500,hours:0.75},{id:48,name:'Replace Fan Belt / Serpentine Belt',price:1100,hours:1.00}],
    parts:[{desc:'Alternator Assembly',qty:1,retail:8500,cost:5950},{desc:'Fan Belt',qty:1,retail:850,cost:595}] },

  { type:'C', svcs:[{id:36,name:'Down Clutch / Pulldown Transmission',price:3500,hours:4.50},{id:2,name:'Change ATF / Transmission Fluid',price:650,hours:0.75}],
    parts:[{desc:'Pressure Plate',qty:1,retail:3500,cost:2450},{desc:'Clutch Disc',qty:1,retail:4200,cost:2940},{desc:'Release Bearing',qty:1,retail:1200,cost:840},{desc:'ATF Fluid (4L)',qty:1,retail:1800,cost:1260}] },

  { type:'C', svcs:[{id:31,name:'Replace Wheel Bearing',price:1350,hours:1.50},{id:32,name:'Replace CV Joint',price:1800,hours:1.50},{id:33,name:'Replace Axle Boot',price:800,hours:1.00}],
    parts:[{desc:'Wheel Bearing',qty:2,retail:1600,cost:1120},{desc:'CV Joint Assembly',qty:1,retail:3200,cost:2240},{desc:'Axle Boot Kit',qty:1,retail:850,cost:595}] },

  // ── TYPE D: Major overhauls ────────────────────────────────────────────────
  { type:'D', svcs:[{id:53,name:'Top Overhaul',price:15000,hours:14.00}],
    parts:[{desc:'Valve Seals',qty:16,retail:120,cost:84},{desc:'Cylinder Head Gasket',qty:1,retail:1800,cost:1260},{desc:'Piston Rings',qty:4,retail:950,cost:665},{desc:'Engine Oil 10W-40 (5L)',qty:1,retail:600,cost:420}] },

  { type:'D', svcs:[{id:54,name:'General Engine Overhaul',price:22000,hours:24.00}],
    parts:[{desc:'Piston Set',qty:4,retail:4500,cost:3150},{desc:'Crankshaft Bearing Set',qty:1,retail:3200,cost:2240},{desc:'Cylinder Head Gasket',qty:1,retail:1800,cost:1260},{desc:'Engine Oil 10W-40 (5L)',qty:2,retail:600,cost:420},{desc:'Oil Filter',qty:1,retail:250,cost:175},{desc:'Valve Seals',qty:16,retail:120,cost:84}] },

  { type:'D', svcs:[{id:26,name:'Overhaul / Replace Steering Rack and Pinion',price:4500,hours:4.00},{id:35,name:'Power Steering Pump Overhaul / Replacement',price:1800,hours:2.00}],
    parts:[{desc:'Steering Rack Assembly',qty:1,retail:12000,cost:8400},{desc:'Power Steering Pump',qty:1,retail:6500,cost:4550},{desc:'Power Steering Fluid (1L)',qty:1,retail:650,cost:455}] },
];

// ── STATUS ASSIGNMENT ─────────────────────────────────────────────────────────
function pickStatus(joDate: Date): string {
  const now = new Date('2026-09-24T22:00:00+08:00');
  const daysSince = (now.getTime() - joDate.getTime()) / 86_400_000;
  const r = Math.random();

  if (daysSince > 180) {
    return r < 0.03 ? 'cancelled' : 'released';
  } else if (daysSince > 60) {
    if (r < 0.03) return 'cancelled';
    if (r < 0.09) return 'completed';
    return 'released';
  } else if (daysSince > 14) {
    if (r < 0.04) return 'cancelled';
    if (r < 0.16) return 'completed';
    if (r < 0.22) return 'in_progress';
    return 'released';
  } else {
    if (r < 0.28) return 'released';
    if (r < 0.45) return 'completed';
    if (r < 0.60) return 'in_progress';
    if (r < 0.70) return 'waiting_on_parts';
    if (r < 0.80) return 'pending_customer_approval';
    if (r < 0.90) return 'inspecting';
    return 'cancelled';
  }
}

function pickPackage(): Pkg {
  const r = Math.random();
  if (r < 0.30) return pick(PKGS.filter(p => p.type === 'A'));
  if (r < 0.70) return pick(PKGS.filter(p => p.type === 'B'));
  if (r < 0.90) return pick(PKGS.filter(p => p.type === 'C'));
  return pick(PKGS.filter(p => p.type === 'D'));
}

// ── TIMESTAMP BUILDER ─────────────────────────────────────────────────────────
interface Timestamps {
  dateArrived: Date; datePromised: Date;
  startedAt: Date|null; completedAt: Date|null; releasedAt: Date|null;
  actualDuration: number|null;
}

function buildTimestamps(joDate: Date, status: string, totalHours: number): Timestamps {
  const dateArrived = new Date(joDate);
  dateArrived.setHours(rnd(7, 11), rnd(0, 59), rnd(0, 59), 0);

  const datePromised = addH(dateArrived, Math.ceil(totalHours) + rnd(2, 8));

  let startedAt:    Date|null = null;
  let completedAt:  Date|null = null;
  let releasedAt:   Date|null = null;

  if (['in_progress','waiting_on_parts','completed','released'].includes(status)) {
    startedAt = addH(dateArrived, rnd(1, 2) + Math.random());
  }
  if (['completed','released'].includes(status)) {
    const actHrs = totalHours * (0.85 + Math.random() * 0.35);
    completedAt = addH(startedAt!, actHrs);
  }
  if (status === 'released') {
    releasedAt = addH(completedAt!, rnd(1, 10) + Math.random());
  }

  const actualDuration = (startedAt && completedAt)
    ? (completedAt.getTime() - startedAt.getTime()) / 3_600_000
    : null;

  return { dateArrived, datePromised, startedAt, completedAt, releasedAt, actualDuration };
}

// ── BATCH INSERT HELPER ───────────────────────────────────────────────────────
async function batchInsert(
  sql: string,
  values: string[],
  batchSize = 50,
  label = ''
) {
  let done = 0;
  for (let b = 0; b < values.length; b += batchSize) {
    const chunk = values.slice(b, b + batchSize);
    await db.query(`${sql} ${chunk.join(',')}`);
    done = Math.min(b + batchSize, values.length);
    process.stdout.write(`  ${label}: ${done}/${values.length}\r`);
  }
  if (values.length > 0) process.stdout.write('\n');
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  AutoKita Seed — 1,000 Job Orders\n');

  // ── 1. Max IDs ──────────────────────────────────────────────────────────────
  const { rows: [mx] } = await db.query<{
    mu:string; mv:string; mt:string; mj:string; mjs:string; mjp:string; mp:string; mw:string; mr:string;
  }>(`SELECT
    (SELECT COALESCE(MAX(id),699) FROM users)               mu,
    (SELECT COALESCE(MAX(id),500) FROM vehicles)            mv,
    (SELECT COALESCE(MAX(id),1001) FROM service_tickets)    mt,
    (SELECT COALESCE(MAX(id),1001) FROM job_orders)         mj,
    (SELECT COALESCE(MAX(id),0)    FROM job_order_services) mjs,
    (SELECT COALESCE(MAX(id),0)    FROM job_order_parts)    mjp,
    (SELECT COALESCE(MAX(id),0)    FROM payments)           mp,
    (SELECT COALESCE(MAX(id),0)    FROM warranties)         mw,
    (SELECT COALESCE(MAX(id),0)    FROM repair_progress_logs) mr
  `);

  let maxU  = parseInt(mx.mu);  let maxV  = parseInt(mx.mv);
  let maxT  = parseInt(mx.mt);  let maxJ  = parseInt(mx.mj);
  let maxJS = parseInt(mx.mjs); let maxJP = parseInt(mx.mjp);
  let maxP  = parseInt(mx.mp);  let maxW  = parseInt(mx.mw);
  let maxR  = parseInt(mx.mr);

  console.log(`📊 Current max IDs  users=${maxU}  vehicles=${maxV}  tickets=${maxT}  jobs=${maxJ}`);

  // ── 2. Insert 300 new users ─────────────────────────────────────────────────
  console.log('\n👤 Inserting 300 new users…');
  const newUsers: Array<{id:number}> = [];
  const uRows: string[] = [];

  for (let i = 0; i < 300; i++) {
    const uid = maxU + 1 + i;
    const fn = pick(FIRST_NAMES), ln = pick(LAST_NAMES);
    const regDate = new Date(
      new Date('2023-01-01').getTime() +
      Math.random() * (new Date('2026-09-24').getTime() - new Date('2023-01-01').getTime())
    );
    newUsers.push({ id: uid });
    uRows.push(
      `(${uid},'customer${uid}@example.com','${esc(fn)}','password123_u${uid}','${esc(fn)}','${esc(ln)}',`+
      `'091234${String(uid).padStart(5,'0')}','${rnd(10,999)} ${esc(pick(STREETS))}, ${esc(pick(CITIES))}',`+
      `'${fmt(regDate)}','c')`
    );
  }

  await batchInsert(
    `INSERT INTO users (id,email,nickname,password,first_name,last_name,contact_number,address,registration_date,role) OVERRIDING SYSTEM VALUE VALUES`,
    uRows, 50, 'Users'
  );
  console.log('  ✅ Users done');

  // ── 3. Insert 300 new vehicles ──────────────────────────────────────────────
  console.log('🚗 Inserting 300 new vehicles…');
  const vRows: string[] = [];

  for (let i = 0; i < 300; i++) {
    const vid = maxV + 1 + i;
    const uid = newUsers[i].id;
    const v   = pick(VEHICLES_POOL);
    const yr  = pick(VYEARS);
    const mil = rnd(3000, 150000);
    const vin = `VIN${String(vid).padStart(14,'0')}`;
    const plate = `ABC${String(vid).padStart(4,'0')}`;
    // live schema: id, user_id, vin, plate_number, vehicle_model, vehicle_year, mileage, vehicle_type, vehicle_make
    vRows.push(
      `(${vid},${uid},'${vin}','${plate}','${esc(v.model)}',${yr},${mil}.00,'${esc(v.type)}','${esc(v.make)}')`
    );
  }

  await batchInsert(
    `INSERT INTO vehicles (id,user_id,vin,plate_number,vehicle_model,vehicle_year,mileage,vehicle_type,vehicle_make) OVERRIDING SYSTEM VALUE VALUES`,
    vRows, 50, 'Vehicles'
  );
  console.log('  ✅ Vehicles done');

  // ── 4. Generate 1,000 JO metadata ──────────────────────────────────────────
  console.log('\n📋 Generating 1,000 job order metadata…');

  interface JoMeta {
    ticketId: number; joId: number;
    userId: number; vehicleId: number;
    joDate: Date; status: string; pkg: Pkg;
    mode: string; concern: string;
    ts: Timestamps;
    estTotal: number; actTotal: number;
    quotApproved: boolean;
  }

  const START_MS = new Date('2024-01-01').getTime();
  const END_MS   = new Date('2026-09-24').getTime();
  const joMetas: JoMeta[] = [];

  for (let i = 0; i < 1000; i++) {
    const ticketId = maxT + 1 + i;
    const joId     = maxJ + 1 + i;

    // 65% reuse existing users (200–maxU), 35% use new users
    let userId: number, vehicleId: number;
    if (chance(0.65)) {
      userId = rnd(200, maxU);
      vehicleId = userId - 199; // original mapping: user N → vehicle N-199
    } else {
      const ni = i % newUsers.length;
      userId    = newUsers[ni].id;
      vehicleId = maxV + 1 + ni;
    }

    const joDate = new Date(START_MS + Math.random() * (END_MS - START_MS));
    joDate.setHours(rnd(7, 15), rnd(0, 59), 0, 0);

    const status = pickStatus(joDate);
    const pkg    = pickPackage();
    const totalHours = pkg.svcs.reduce((s, sv) => s + sv.hours, 0);
    const ts     = buildTimestamps(joDate, status, totalHours);

    const laborTotal = pkg.svcs.reduce((s, sv) => s + sv.price, 0);
    const partsTotal = pkg.parts.reduce((s, pt) => s + pt.qty * pt.retail, 0);
    const estTotal   = laborTotal + partsTotal;
    const actTotal   = ['completed','released'].includes(status) ? estTotal : 0;
    const quotApproved = ['in_progress','waiting_on_parts','completed','released'].includes(status);

    joMetas.push({
      ticketId, joId, userId, vehicleId,
      joDate, status, pkg, ts, estTotal, actTotal, quotApproved,
      mode: chance(0.7) ? 'walk_in' : 'home_service',
      concern: pick(CONCERNS),
    });
  }

  // Sort chronologically for realistic ordering
  joMetas.sort((a, b) => a.joDate.getTime() - b.joDate.getTime());

  // ── 5. Service tickets ──────────────────────────────────────────────────────
  console.log('  Inserting service tickets…');
  const tRows = joMetas.map(jm => {
    const reqDate = addH(jm.joDate, -rnd(1, 24));
    // live schema includes preferred_datetime (nullable)
    return `(${jm.ticketId},${jm.userId},${jm.vehicleId},'${jm.mode}','None','${esc(jm.concern)}','approved','${fmt(reqDate)}',NULL)`;
  });
  await batchInsert(
    `INSERT INTO service_tickets (id,user_id,vehicle_id,service_mode,home_service_address,customer_concern,ticket_status,request_date,preferred_datetime) OVERRIDING SYSTEM VALUE VALUES`,

    tRows, 50, 'Tickets'
  );
  console.log('  ✅ Tickets done');

  // ── 6. Job orders ───────────────────────────────────────────────────────────
  console.log('  Inserting job orders…');
  const joRows = joMetas.map(jm => {
    const { ts, pkg, status, estTotal, actTotal, quotApproved } = jm;
    const totalHours = pkg.svcs.reduce((s, sv) => s + sv.hours, 0);
    const partial  = (status === 'released' && chance(0.15))
      ? Math.round(actTotal * 0.3 / 100) * 100 : 0;
    const balance  = actTotal - partial;
    const estDur   = `'${fmtTime(totalHours)}'`;
    const actDur   = ts.actualDuration ? `'${fmtTime(ts.actualDuration)}'` : 'NULL';
    const sa  = ts.startedAt   ? `'${fmt(ts.startedAt)}'`   : 'NULL';
    const ca  = ts.completedAt ? `'${fmt(ts.completedAt)}'` : 'NULL';
    const ra  = ts.releasedAt  ? `'${fmt(ts.releasedAt)}'`  : 'NULL';
    const qn  = quotApproved   ? `'${esc(pick(QUOT_NOTES))}'` : 'NULL';

    return `(${jm.joId},${jm.ticketId},${jm.userId},${jm.vehicleId},`+
      `'${fmtD(jm.joDate)}','${fmt(ts.dateArrived)}','${fmt(ts.datePromised)}',`+
      `${sa},${ca},${ra},${estDur},${actDur},`+
      `${estTotal.toFixed(2)},${actTotal.toFixed(2)},${partial.toFixed(2)},${balance.toFixed(2)},`+
      `'${status}',${qn},${quotApproved})`;
  });
  await batchInsert(
    `INSERT INTO job_orders (id,ticket_id,user_id,vehicle_id,jo_date,date_arrived,date_promised,started_at,completed_at,released_at,estimated_duration,actual_duration,estimated_grand_total,actual_grand_total,partial_payment,balance,status,quotation_notes,quotation_approved) OVERRIDING SYSTEM VALUE VALUES`,
    joRows, 50, 'Job Orders'
  );
  console.log('  ✅ Job Orders done');

  // ── 7. Services & 8. Parts ──────────────────────────────────────────────────
  console.log('  Inserting job order services and parts…');
  const josRows: string[] = [];
  const jopRows: string[] = [];
  let josId = maxJS, jopId = maxJP;

  for (const jm of joMetas) {
    const { status, ts } = jm;
    let firstSvcId = josId + 1;  // track first service ID for this JO (parts link here)
    let firstSvcSet = false;

    for (const svc of jm.pkg.svcs) {
      josId++;
      if (!firstSvcSet) { firstSvcId = josId; firstSvcSet = true; }

      const actHrs = ['completed','released'].includes(status)
        ? svc.hours * (0.88 + Math.random() * 0.32) : null;
      const estAmt = svc.price;
      const actAmt = ['completed','released'].includes(status) ? estAmt : 0;

      josRows.push(
        `(${josId},${jm.joId},${svc.id},'${esc(svc.name)}',`+
        `'${fmtTime(svc.hours)}',${actHrs ? `'${fmtTime(actHrs)}'` : 'NULL'},`+
        `${svc.hours.toFixed(2)},${actHrs ? actHrs.toFixed(2) : 'NULL'},`+
        `${estAmt},${actAmt},NULL)`  // finding_id = NULL
      );
    }

    const partStatus =
      status === 'released'         ? 'installed'
      : status === 'completed'      ? 'received'
      : status === 'in_progress'    ? 'received'
      : status === 'waiting_on_parts' ? 'ordered'
      : 'in_stock';

    for (const pt of jm.pkg.parts) {
      jopId++;
      const total = (pt.qty * pt.retail).toFixed(2);
      // live schema: ..., is_oem, tier, replaces_part_id, is_warranty_replacement, finding_id, warranty_months
      jopRows.push(
        `(${jopId},${jm.joId},${firstSvcId},NULL,'${partStatus}',NULL,`+
        `'${esc(pt.desc)}',${pt.qty},${pt.retail.toFixed(2)},${total},${pt.cost.toFixed(2)},false,'standard',NULL,false,NULL,NULL)`
      );
    }
  }

  await batchInsert(
    `INSERT INTO job_order_services (id,job_order_id,service_id,description_of_work,estimated_duration,actual_duration,estimated_hours,actual_hours,estimated_amount,actual_amount,finding_id) OVERRIDING SYSTEM VALUE VALUES`,

    josRows, 50, 'Services'
  );
  console.log(`  ✅ Services done (${josRows.length})`);

  await batchInsert(
    `INSERT INTO job_order_parts (id,job_order_id,job_order_service_id,purchase_order_id,status,part_number,description,quantity,retail_unit_price,total_retail_amount,supplier_unit_cost,is_oem,tier,replaces_part_id,is_warranty_replacement,finding_id,warranty_months) OVERRIDING SYSTEM VALUE VALUES`,

    jopRows, 50, 'Parts'
  );
  console.log(`  ✅ Parts done (${jopRows.length})`);

  // ── 9. Payments ─────────────────────────────────────────────────────────────
  console.log('  Inserting payments…');
  const payRows: string[] = [];
  let payId = maxP;

  for (const jm of joMetas) {
    if (!['released','completed'].includes(jm.status)) continue;
    payId++;
    const method  = pick(PAY_METHODS);
    const channel = pick(PAY_CHANNELS[method]);
    const payDate = jm.ts.releasedAt || jm.ts.completedAt || jm.joDate;
    const ref     = method !== 'cash' ? `'REF${String(payId).padStart(8,'0')}'` : 'NULL';
    const chan    = channel ? `'${esc(channel)}'` : 'NULL';

    payRows.push(
      `(${payId},${jm.joId},'${method}',NULL,${jm.actTotal.toFixed(2)},'${fmt(payDate)}','verified',${chan},${ref})`
    );
  }

  await batchInsert(
    `INSERT INTO payments (id,job_order_id,payment_method,proof_of_payment_image,amount_paid,payment_date,verification_status,payment_channel,reference_number) OVERRIDING SYSTEM VALUE VALUES`,
    payRows, 50, 'Payments'
  );
  console.log(`  ✅ Payments done (${payRows.length})`);

  // ── 10. Warranties ───────────────────────────────────────────────────────────
  console.log('  Inserting warranties…');
  const warRows: string[] = [];
  let warId = maxW;
  const NOW = new Date('2026-09-24');

  for (const jm of joMetas) {
    if (jm.status !== 'released') continue;
    // Quick services: 40% chance to skip warranty; major services always get one
    if (jm.pkg.type === 'A' && chance(0.60)) continue;

    warId++;
    const startDate = jm.ts.releasedAt || jm.joDate;
    const expDate   = new Date(startDate); expDate.setFullYear(expDate.getFullYear() + 1);
    const daysLeft  = (expDate.getTime() - NOW.getTime()) / 86_400_000;
    const warStatus = daysLeft < 0 ? 'expired' : daysLeft < 30 ? 'nearing_expiration' : 'active';

    warRows.push(
      `(${warId},${jm.joId},'Standard 1-year parts and labor warranty','${fmtD(startDate)}','${fmtD(expDate)}','${warStatus}')`
    );
  }

  await batchInsert(
    `INSERT INTO warranties (id,job_order_id,coverage_description,start_date,expiration_date,status) OVERRIDING SYSTEM VALUE VALUES`,
    warRows, 50, 'Warranties'
  );
  console.log(`  ✅ Warranties done (${warRows.length})`);

  // ── 11. Repair progress logs ────────────────────────────────────────────────
  console.log('  Inserting repair progress logs…');
  const rplRows: string[] = [];
  let rplId = maxR;

  for (const jm of joMetas) {
    if (jm.status === 'cancelled') continue;

    const base = jm.ts.startedAt || jm.ts.dateArrived;
    const totalHours = jm.pkg.svcs.reduce((s, sv) => s + sv.hours, 0);

    const numLogs =
      jm.status === 'released'    ? rnd(4, 7)
      : jm.status === 'completed' ? rnd(3, 5)
      : jm.status === 'in_progress' || jm.status === 'waiting_on_parts' ? rnd(2, 4)
      : 1;

    for (let li = 0; li < numLogs; li++) {
      rplId++;
      const logTime = addH(base, (totalHours / Math.max(numLogs, 1)) * li + Math.random() * 0.5);
      const template = PROG_LOGS[Math.min(li, PROG_LOGS.length - 1)];
      rplRows.push(`(${rplId},${jm.joId},'${esc(template)}','${fmt(logTime)}')`);
    }
  }

  await batchInsert(
    `INSERT INTO repair_progress_logs (id,job_order_id,activity_description,log_time) OVERRIDING SYSTEM VALUE VALUES`,
    rplRows, 100, 'Progress Logs'
  );
  console.log(`  ✅ Progress Logs done (${rplRows.length})`);

  // ── 12. Update sequences ─────────────────────────────────────────────────────
  console.log('\n🔄 Updating sequences…');
  const seqTables = [
    ['users','id'],['vehicles','id'],['service_tickets','id'],['job_orders','id'],
    ['job_order_services','id'],['job_order_parts','id'],
    ['payments','id'],['warranties','id'],['repair_progress_logs','id'],
  ];
  for (const [tbl, col] of seqTables) {
    await db.query(
      `SELECT setval(pg_get_serial_sequence('${tbl}','${col}'), (SELECT MAX(${col}) FROM ${tbl}))`
    );
  }
  console.log('  ✅ Sequences updated');

  // ── Summary ──────────────────────────────────────────────────────────────────
  const statusCount: Record<string,number> = {};
  const typeCount:   Record<string,number> = {};
  for (const jm of joMetas) {
    statusCount[jm.status] = (statusCount[jm.status] || 0) + 1;
    typeCount[jm.pkg.type] = (typeCount[jm.pkg.type] || 0) + 1;
  }

  console.log('\n🎉  Seed complete!\n');
  console.log(`   Users     +300  (IDs ${maxU+1}–${maxU+300})`);
  console.log(`   Vehicles  +300  (IDs ${maxV+1}–${maxV+300})`);
  console.log(`   Tickets   +1000`);
  console.log(`   Job Orders +1000`);
  console.log(`   Services  +${josRows.length}`);
  console.log(`   Parts     +${jopRows.length}`);
  console.log(`   Payments  +${payRows.length}`);
  console.log(`   Warranties +${warRows.length}`);
  console.log(`   Logs      +${rplRows.length}`);
  console.log(`\n   Status breakdown:`);
  for (const [s, n] of Object.entries(statusCount).sort((a,b) => b[1]-a[1])) {
    console.log(`     ${s.padEnd(28)} ${n}`);
  }
  console.log(`\n   Service type breakdown:`);
  for (const [t, n] of Object.entries(typeCount)) {
    const label = {A:'Quick (Type A)',B:'Mid-range (Type B)',C:'Heavy (Type C)',D:'Overhaul (Type D)'}[t] || t;
    console.log(`     ${label.padEnd(20)} ${n}`);
  }
}

main()
  .then(() => { console.log('\n✅ Done.'); process.exit(0); })
  .catch(err => { console.error('\n❌ Seed failed:', err); process.exit(1); });
