// src/lib/servicePricing.ts
// ---------------------------------------------------------------------------
// Dynamic Supabase Service Pricing & Duration Service for AutoKita
// Directly queries Supabase PostgreSQL tables: `services`, `job_order_services`,
// and `job_order_parts` to provide live, single-source-of-truth price ranges
// and empirical durations for customer chat inquiries.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';

export interface DbServiceRange {
  id: number;
  service_name: string;
  description: string;
  base_price: number;
  base_duration_hours: number;
  is_price_fixed: boolean;
  min_labor: number;
  max_labor: number;
  avg_duration_hours: number;
}

export interface DbPartRange {
  part_name: string;
  min_price: number;
  max_price: number;
  avg_price: number;
}

// Common automotive terminology aliases to map customer slang to shop service names
const SYNONYMS: Record<string, string> = {
  'oil change': 'Oil',
  'change oil': 'Oil',
  'pms': 'Oil',
  'tune up': 'Oil',
  'motor oil': 'Oil',
  'atf': 'Transmission',
  'transmission fluid': 'Transmission',
  'tranny fluid': 'Transmission',
  'brake': 'Brake',
  'brakes': 'Brake',
  'brake pad': 'Brake',
  'brake pads': 'Brake',
  'alignment': 'Alignment',
  'camber': 'Alignment',
  'balancing': 'Balancing',
  'tire rotation': 'Tire',
  'aircon': 'Air Conditioning',
  'ac': 'Air Conditioning',
  'freon': 'Air Conditioning',
  'spark plug': 'Spark',
  'spark plugs': 'Spark',
  'battery': 'Battery',
  'alternator': 'Alternator',
  'starter': 'Starter',
  'shocks': 'Shock',
  'strut': 'Shock',
  'suspension': 'Suspension',
  'bushing': 'Bushing',
  'egr': 'EGR',
  'throttle': 'Throttle',
  'coolant': 'Coolant',
  'radiator': 'Radiator',
  'overhaul': 'Overhaul',
  'scan': 'Diagnostic',
  'check engine': 'Diagnostic',
  'inspection': 'Inspection',
  'check up': 'Inspection',
};

/**
 * Formats duration hours into a customer-friendly estimate.
 */
export function formatDurationEstimate(hours: number): string {
  if (hours <= 0.25) return '15 – 20 minutes';
  if (hours <= 0.5) return '30 – 45 minutes';
  if (hours <= 0.75) return '~45 minutes to 1 hour';
  if (hours <= 1.0) return '1 – 1.5 hours';
  if (hours <= 1.5) return '1.5 – 2 hours';
  if (hours <= 2.0) return '2 – 2.5 hours';
  if (hours <= 3.0) return '2.5 – 3.5 hours';
  if (hours <= 4.0) return '3 – 5 hours';
  return `${Math.floor(hours)} – ${Math.ceil(hours * 1.3)} hours`;
}

/**
 * Extracts searchable terms from customer text based on common automotive synonyms.
 */
function extractSearchTerms(userText: string): string[] {
  const clean = userText.toLowerCase();
  const terms = new Set<string>();

  for (const [key, term] of Object.entries(SYNONYMS)) {
    if (key.length <= 3) {
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(clean)) {
        terms.add(term);
      }
    } else if (clean.includes(key)) {
      terms.add(term);
    }
  }

  // Also include isolated alphanumeric words > 3 chars
  const words = clean.match(/[a-z]{4,}/g) ?? [];
  for (const w of words) {
    if (!['what', 'when', 'much', 'cost', 'price', 'many', 'have', 'does', 'please', 'help', 'need', 'your'].includes(w)) {
      terms.add(w);
    }
  }

  return Array.from(terms);
}

/**
 * Directly queries Supabase PostgreSQL for matching services with empirical
 * min and max labor amounts calculated from actual historical job_order_services.
 */
export async function queryServicesFromDB(userText: string, limit = 3): Promise<DbServiceRange[]> {
  const searchTerms = extractSearchTerms(userText);
  if (searchTerms.length === 0) return [];

  try {
    // Build SQL condition with ILIKE OR for terms
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const term of searchTerms.slice(0, 4)) {
      params.push(`%${term}%`);
      conditions.push(`(s.service_name ILIKE $${params.length} OR s.description ILIKE $${params.length})`);
    }

    const whereClause = conditions.join(' OR ');

    const query = `
      SELECT 
        s.id,
        s.service_name,
        COALESCE(s.description, '') AS description,
        s.base_price::float AS base_price,
        s.base_duration_hours::float AS base_duration_hours,
        s.is_price_fixed,
        COALESCE(ROUND(MIN(jos.actual_amount)), ROUND(s.base_price * 0.85))::float AS min_labor,
        COALESCE(
          ROUND(MAX(jos.actual_amount)), 
          ROUND(CASE WHEN s.is_price_fixed THEN s.base_price ELSE s.base_price * 1.5 END)
        )::float AS max_labor,
        COALESCE(ROUND(AVG(NULLIF(jos.actual_hours, 0))::numeric, 2)::float, s.base_duration_hours::float) AS avg_duration_hours
      FROM services s
      LEFT JOIN job_order_services jos ON jos.service_id = s.id
      WHERE s.is_active = true 
        AND (${whereClause})
      GROUP BY s.id, s.service_name, s.description, s.base_price, s.base_duration_hours, s.is_price_fixed
      ORDER BY (s.service_name ILIKE $1) DESC, s.service_name ASC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const res = await db.query<DbServiceRange>(query, params);
    return res.rows;
  } catch (err) {
    console.error('[servicePricing] Error querying services from Supabase:', err);
    return [];
  }
}

/**
 * Directly queries Supabase PostgreSQL for matching parts pricing from historical
 * `job_order_parts` table records.
 */
export async function queryPartsFromDB(userText: string, limit = 2): Promise<DbPartRange[]> {
  const searchTerms = extractSearchTerms(userText);
  if (searchTerms.length === 0) return [];

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];

    for (const term of searchTerms.slice(0, 3)) {
      params.push(`%${term}%`);
      conditions.push(`jop.description ILIKE $${params.length}`);
    }

    const whereClause = conditions.join(' OR ');

    const query = `
      SELECT 
        jop.description AS part_name,
        ROUND(MIN(jop.retail_unit_price))::float AS min_price,
        ROUND(MAX(jop.retail_unit_price))::float AS max_price,
        ROUND(AVG(jop.retail_unit_price))::float AS avg_price
      FROM job_order_parts jop
      WHERE jop.description IS NOT NULL 
        AND jop.retail_unit_price > 0
        AND (${whereClause})
      GROUP BY jop.description
      ORDER BY COUNT(*) DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    const res = await db.query<DbPartRange>(query, params);
    return res.rows;
  } catch (err) {
    console.error('[servicePricing] Error querying parts from Supabase:', err);
    return [];
  }
}

/**
 * Loads dynamic pricing and duration context directly from Supabase for LLM injection.
 */
export async function getLiveCustomerPricingContext(userText: string): Promise<string> {
  const [services, parts] = await Promise.all([
    queryServicesFromDB(userText),
    queryPartsFromDB(userText),
  ]);

  if (services.length === 0 && parts.length === 0) return '';

  const lines: string[] = ['### Verified AutoKita Live Database Price Ranges & Durations (from Supabase)'];

  for (const s of services) {
    const minLabor = Math.min(s.min_labor, s.base_price);
    const maxLabor = Math.max(s.max_labor, s.base_price);
    const minStr = `₱${minLabor.toLocaleString('en-PH')}`;
    const maxStr = `₱${maxLabor.toLocaleString('en-PH')}`;
    const rangeStr = minLabor === maxLabor ? minStr : `${minStr} – ${maxStr}`;
    const durStr = formatDurationEstimate(s.avg_duration_hours || s.base_duration_hours);

    lines.push(`- **${s.service_name}**`);
    lines.push(`  • Labor Price Range: ${rangeStr} (Labor)`);
    lines.push(`  • Estimated Duration: ${durStr}`);
    if (s.description) lines.push(`  • Scope: ${s.description}`);
  }

  if (parts.length > 0) {
    lines.push('### Related Parts Price Ranges from Shop Records');
    for (const p of parts) {
      const minStr = `₱${p.min_price.toLocaleString('en-PH')}`;
      const maxStr = `₱${p.max_price.toLocaleString('en-PH')}`;
      const partRange = p.min_price === p.max_price ? minStr : `${minStr} – ${maxStr}`;
      lines.push(`- **${p.part_name}**: ${partRange}`);
    }
  }

  lines.push('> Strict Instruction: Quote ONLY these live verified price and duration ranges from the database. Never fabricate numbers or flat averages.');

  return lines.join('\n');
}
