// app/api/chat/admin/route.ts
// Admin / Mechanic chatbot endpoint.
// Model: gpt-5.4 (configurable via OPENAI_ADMIN_MODEL env var)
// Features: 11 read-only SQL tools, Pinecone Hybrid RAG, agentic tool loop, token budget.

// ─── Token-Reduction Constants ────────────────────────────────────────────────
// Keep only the last N user/assistant messages (tool messages excluded from this
// count — they're managed separately during the agentic loop).
const MAX_HISTORY_MESSAGES = 14; // ~7 turns of back-and-forth
// Hard cap on generated output. Concise What/Why/How format — 800 tokens is enough for any procedure answer.
const MAX_OUTPUT_TOKENS = 800;
// Cap each RAG chunk to this many characters before injecting into the system prompt.
// Reduces prompt tokens while keeping the most relevant part of each manual excerpt.
const MAX_RAG_CHUNK_CHARS = 900;

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, ADMIN_MODEL } from '@/lib/openai';
import { hasBudget, deduct, remaining } from '@/lib/tokenBudget';
import { db } from '@/lib/db';
import { getAdminIndex } from '@/lib/pinecone';
import { semanticSearch, formatContext } from '@/lib/vectorSearch';
import { getObd2CodeDetails, extractObd2Code, formatObd2NotFoundContext } from '@/lib/obd2';
import type { ChatCompletionTool, ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ─── SQL Tool Definitions ────────────────────────────────────────────────────

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'List available repair/maintenance services.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vehicle_info',
      description: 'Lookup vehicle info (make, model, year, etc).',
      parameters: {
        type: 'object',
        properties: {
          plate_number: { type: 'string', description: 'Exact plate' },
          model: { type: 'string', description: 'Partial model name' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_job_orders',
      description: 'Query job orders by status or date.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
          from_date: { type: 'string' },
          to_date: { type: 'string' },
          limit: { type: 'number' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_cost_stats',
      description: 'Avg cost and hours for services.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_vehicle_repair_history',
      description: 'Repair history for a vehicle.',
      parameters: {
        type: 'object',
        properties: {
          plate_number: { type: 'string' },
        },
        required: ['plate_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_part_fitment',
      description: 'Look up OEM parts compatible with a vehicle from the shop database. Covers Toyota Hiace (2005–2013), Toyota Hilux (2005–2011), and Toyota Vios (2005–2011). Always use this tool for part number lookups — never guess or fabricate part numbers.',
      parameters: {
        type: 'object',
        properties: {
          vehicle_model:  { type: 'string', description: 'Model name (e.g. "Hiace", "Hilux", or "Vios")' },
          vehicle_year:   { type: 'number', description: 'Year of the vehicle (e.g. 2010, 2011, 2012)' },
          part_category:  { type: 'string', description: 'Category filter: "Body", "Chassis & Driveline", "Electrical", or "Engine & Fuel"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_parts_by_name',
      description: 'Search the shop\'s OEM parts database by part name keyword (e.g. "oil filter", "brake pad", "timing belt"). Returns exact OEM part numbers with vehicle fitment. Covers Toyota Hiace, Hilux, and Vios. Always use this for parts questions — never fabricate part numbers.',
      parameters: {
        type: 'object',
        properties: {
          keyword:        { type: 'string', description: 'Part name keyword to search (e.g. "oil filter")' },
          vehicle_model:  { type: 'string', description: 'Optional: use "Hiace", "Hilux", or "Vios" to narrow results' },
          part_category:  { type: 'string', description: 'Optional category: "Body", "Chassis & Driveline", "Electrical", "Engine & Fuel"' },
        },
        required: ['keyword'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_order_parts',
      description: 'List parts used in a job order.',
      parameters: {
        type: 'object',
        properties: {
          job_order_id: { type: 'number' },
        },
        required: ['job_order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_order_services',
      description: 'List services in a job order.',
      parameters: {
        type: 'object',
        properties: {
          job_order_id: { type: 'number' },
        },
        required: ['job_order_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_job_order_counts',
      description: 'Get job order count by status.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_kpi_summary',
      description: 'Shop KPI summary (revenue, active jobs).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_obd2_code',
      description: 'Look up verified OBD-II Diagnostic Trouble Code (DTC) information from the database (covers Powertrain P-codes, Body B-codes, Chassis C-codes, Network U-codes, plus sibling sub-codes like P0002-P0004). Returns exact technical definition, symptoms, causes, severity, driving safety advice, diagnostic procedures, and related sibling codes to eliminate AI hallucinations. ALWAYS call this tool whenever a diagnostic code like P0001, P0002, P0008, C0035, U0100, etc. is mentioned. If the code does not exist in the database, you CANNOT say much about it and must not speculate.',
      parameters: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'The OBD-II DTC code (e.g. "P0001", "P0002", "P0008", "C0035", "U0100")' },
        },
        required: ['code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_obd2_diagnostics',
      description: 'Retrieve OBD-II diagnostic scan reports linked to a job order or search recent shop vehicle scans by DTC code.',
      parameters: {
        type: 'object',
        properties: {
          job_order_id: { type: 'number', description: 'Optional: Job order ID to retrieve linked OBD-II report and DTCs' },
          dtc_code: { type: 'string', description: 'Optional: Specific diagnostic code to search in recent vehicle scans (e.g. "P0300", "C1401")' },
        },
        required: [],
      },
    },
  },
];

// ─── Tool Executors — delegates to existing PostgreSQL stored procedures ──────

async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'get_services': {
        // No stored proc for services list — simple select is fine here
        const res = await db.query(`
          SELECT service_name, description, base_price, base_duration_hours, is_price_fixed
          FROM services
          WHERE is_active = true
          ORDER BY service_name
          LIMIT 20
        `);
        return JSON.stringify(res.rows);
      }

      case 'get_vehicle_info': {
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (args.plate_number) {
          conditions.push(`plate_number = $${params.length + 1}`);
          params.push(args.plate_number);
        }
        if (args.model) {
          conditions.push(`vehicle_model ILIKE $${params.length + 1}`);
          params.push(`%${args.model}%`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const res = await db.query(`
          SELECT vehicle_make, vehicle_model, vehicle_year, vehicle_type, mileage, plate_number
          FROM vehicles ${where}
          LIMIT 10
        `, params);
        return JSON.stringify(res.rows);
      }

      case 'query_job_orders': {
        // Use get_job_orders_list() — already joins vehicles and users with safe columns
        const res = await db.query(`SELECT * FROM get_job_orders_list()`);
        let rows = res.rows;
        // Filter in JS since the stored proc returns all rows (no params)
        if (args.status) rows = rows.filter((r: Record<string, unknown>) => r.status === args.status);
        if (args.from_date) rows = rows.filter((r: Record<string, unknown>) => String(r.jo_date) >= String(args.from_date));
        if (args.to_date) rows = rows.filter((r: Record<string, unknown>) => String(r.jo_date) <= String(args.to_date));
        const limit = typeof args.limit === 'number' ? Math.min(args.limit, 15) : 15;
        // Strip personal data (first_name/last_name returned by the function)
        return JSON.stringify(
          rows.slice(0, limit).map(({ first_name: _f, last_name: _l, ...safe }: Record<string, unknown>) => safe)
        );
      }

      case 'get_job_order_counts': {
        const res = await db.query(`
          SELECT status, COUNT(*) as count
          FROM job_orders
          GROUP BY status
          ORDER BY count DESC
        `);
        return JSON.stringify(res.rows);
      }

      case 'get_service_cost_stats': {
        // Use get_admin_service_mix() — returns service_name, service_count, percentage
        const res = await db.query(`SELECT * FROM get_admin_service_mix()`);
        return JSON.stringify(res.rows);
      }

      case 'get_kpi_summary': {
        // Use get_admin_kpi_summary() — pending tickets, active jobs, mechanics, revenue
        const res = await db.query(`SELECT * FROM get_admin_kpi_summary()`);
        return JSON.stringify(res.rows);
      }

      case 'get_vehicle_repair_history': {
        // Use get_vehicle_service_history(vehicle_id, exclude_jo_id)
        // First resolve plate_number -> vehicle id
        const vehicle = await db.query(
          `SELECT id FROM vehicles WHERE plate_number = $1 LIMIT 1`,
          [args.plate_number]
        );
        if (!vehicle.rows.length) return JSON.stringify({ error: 'Vehicle not found.' });
        const vehicleId = vehicle.rows[0].id;
        const res = await db.query(
          `SELECT * FROM get_vehicle_service_history($1, $2)`,
          [vehicleId, 0] // 0 = don't exclude any JO
        );
        return JSON.stringify(res.rows);
      }

      case 'get_part_fitment': {
        // Deterministic lookup from part_catalog + part_fitments + vehicle_catalog
        const conditions: string[] = [];
        const params: unknown[] = [];
        if (args.vehicle_model) {
          conditions.push(`(vc.make ILIKE $${params.length + 1} OR vc.model ILIKE $${params.length + 1})`);
          params.push(`%${args.vehicle_model}%`);
        }
        if (args.vehicle_year) {
          conditions.push(`(vc.year_start <= $${params.length + 1} AND (vc.year_end IS NULL OR vc.year_end >= $${params.length + 1}))`);
          params.push(args.vehicle_year);
          params.push(args.vehicle_year);
        }
        if (args.part_category) {
          conditions.push(`pc.part_category ILIKE $${params.length + 1}`);
          params.push(`%${args.part_category}%`);
        }
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const res = await db.query(`
          SELECT pc.part_name, pc.oem_part_number, pc.brand, pc.part_category,
                 vc.make, vc.model, vc.year_start, vc.year_end, pf.notes
          FROM part_fitments pf
          JOIN part_catalog pc ON pf.part_catalog_id = pc.id
          JOIN vehicle_catalog vc ON pf.vehicle_catalog_id = vc.id
          ${where}
          ORDER BY pc.part_category, pc.part_name
          LIMIT 20
        `, params);
        if (res.rows.length === 0) {
          return JSON.stringify({ message: 'No parts found in database for those criteria. Parts data covers Toyota Hiace (2005–2013), Hilux (2005–2011), and Vios (2005–2011). Verify the vehicle model, year, and category.' });
        }
        return JSON.stringify(res.rows);
      }

      case 'search_parts_by_name': {
        // Keyword search on part_name — deterministic, no hallucination
        const conditions: string[] = ['pc.part_name ILIKE $1'];
        const params: unknown[] = [`%${args.keyword}%`];
        if (args.vehicle_model) {
          conditions.push(`(vc.make ILIKE $${params.length + 1} OR vc.model ILIKE $${params.length + 1})`);
          params.push(`%${args.vehicle_model}%`);
        }
        if (args.part_category) {
          conditions.push(`pc.part_category ILIKE $${params.length + 1}`);
          params.push(`%${args.part_category}%`);
        }
        const where = `WHERE ${conditions.join(' AND ')}`;
        const res = await db.query(`
          SELECT pc.part_name, pc.oem_part_number, pc.brand, pc.part_category,
                 vc.make, vc.model, vc.year_start, vc.year_end, pf.notes
          FROM part_fitments pf
          JOIN part_catalog pc ON pf.part_catalog_id = pc.id
          JOIN vehicle_catalog vc ON pf.vehicle_catalog_id = vc.id
          ${where}
          ORDER BY pc.part_name
          LIMIT 20
        `, params);
        if (res.rows.length === 0) {
          return JSON.stringify({ message: `No parts matching "${args.keyword}" found in database. Parts data covers Toyota Hiace, Hilux, and Vios. Verify the part name keyword or vehicle model.` });
        }
        return JSON.stringify(res.rows);
      }

      case 'get_job_order_parts': {
        // Use get_job_order_parts(p_job_order_id) stored proc
        const res = await db.query(
          `SELECT * FROM get_job_order_parts($1)`,
          [args.job_order_id]
        );
        return JSON.stringify(res.rows);
      }

      case 'get_job_order_services': {
        // Use get_job_order_services(p_job_order_id) stored proc
        const res = await db.query(
          `SELECT * FROM get_job_order_services($1)`,
          [args.job_order_id]
        );
        return JSON.stringify(res.rows);
      }

      case 'lookup_obd2_code': {
        const code = String(args.code ?? '').trim();
        if (!code) {
          return JSON.stringify({ error: 'Please provide an OBD-II diagnostic trouble code (e.g. "P0001", "P0008", "C1401").' });
        }
        const record = await getObd2CodeDetails(code);
        if (!record) {
          const upperCode = code.toUpperCase();
          return JSON.stringify({
            found: false,
            code: upperCode,
            status: 'NOT_FOUND_IN_DATABASE',
            message: `DTC code "${upperCode}" is NOT registered in AutoKita's verified diagnostic database.`,
            directive: `STRICT ZERO-HALLUCINATION GUARDRAIL: You do NOT have verified data for code ${upperCode}. You CANNOT say much about this code. Do NOT speculate, guess root causes, invent symptoms, or guess diagnostic procedures. State plainly: "Code ${upperCode} is not registered in AutoKita's verified diagnostic database. Please verify the code on your scan tool or perform an official in-shop diagnostic scan at AutoKita."`
          });
        }
        return JSON.stringify({
          found: true,
          code: record.code,
          category: record.category,
          description: record.description,
          is_primary: record.is_primary,
          parent_code: record.parent_code,
          related_codes: record.related_codes,
          meaning: record.meaning,
          symptoms: record.symptoms,
          causes: record.causes,
          seriousness: record.seriousness,
          can_i_still_drive: record.can_i_still_drive,
          how_to_diagnose: record.how_to_diagnose,
          inspection_difficulty: record.inspection_difficulty,
          more_about: record.more_about,
          directive: 'CRITICAL ANTI-HALLUCINATION RULE: All explanations of symptoms, causes, severity, driving risks, and diagnosis procedures MUST strictly reflect this verified database record. Do NOT invent causes or guess safety consequences.'
        });
      }

      case 'lookup_obd2_diagnostics': {
        const results: Record<string, unknown> = {};

        if (args.dtc_code) {
          const rawCode = String(args.dtc_code).trim().toUpperCase();
          const codeMatch = rawCode.match(/[PBCU][0-9A-Z]{4}/i);
          const cleanCode = codeMatch ? codeMatch[0].toUpperCase() : rawCode;

          // 1. Deterministic reference lookup in obd2_codes
          const refRes = await db.query(
            `SELECT code, category, description, meaning, symptoms, causes,
                    seriousness, can_i_still_drive, how_to_diagnose, inspection_difficulty,
                    more_about, related_codes, is_primary, parent_code
             FROM obd2_codes
             WHERE code = $1 OR $1 = ANY(related_codes)
             LIMIT 1`,
            [cleanCode]
          );

          if (refRes.rows.length > 0) {
            results.code_reference = refRes.rows[0];
          }

          // 2. Also check recent job order scans
          const scanRes = await db.query(
            `SELECT dtc_code, description, state, system, datetime_logged
             FROM obd2_dtc_codes
             WHERE dtc_code ILIKE $1
             ORDER BY id DESC
             LIMIT 5`,
            [`%${cleanCode}%`]
          );
          if (scanRes.rows.length > 0) {
            results.recent_job_scans = scanRes.rows;
          }

          if (!results.code_reference && !results.recent_job_scans) {
            return JSON.stringify({
              message: `DTC code "${args.dtc_code}" not found in OBD-II reference database or recent shop scans.`
            });
          }
        }

        if (args.job_order_id) {
          const res = await db.query(`SELECT * FROM get_obd2_report_for_job_order($1)`, [args.job_order_id]);
          if (res.rows.length > 0) {
            results.job_order_scan_report = res.rows;
          } else if (!results.code_reference) {
            return JSON.stringify({ message: `No OBD-II scan report linked to Job Order #${args.job_order_id} yet.` });
          }
        }

        if (Object.keys(results).length === 0) {
          return JSON.stringify({ error: 'Please provide either job_order_id or dtc_code.' });
        }

        return JSON.stringify(results);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (err) {
    console.error(`Tool ${name} error:`, err);
    return JSON.stringify({ error: 'Database query failed.' });
  }
}


// ─── System Prompt ───────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a concise automotive technical assistant for AutoKita workshop. You assist mechanics with OEM parts, official workshop manual procedures, diagnostics, and shop operations.

Coverage: Toyota Hiace (2005–2013), Toyota Hilux (2005–2011), Toyota Vios/Yaris (2005–2011).

━━━ RESPONSE MODES ━━━

### MODE 1 — PARTS & FITMENT
Triggered when the user asks about parts, OEM numbers, fitment, compatibility, or inventory.
- NEVER guess or fabricate part numbers. ALWAYS call \`search_parts_by_name\` or \`get_part_fitment\` first.
- Output format:

🔩 **Parts & Fitment**
- **Vehicle**: [Year Make Model]
- **Status**: VERIFIED / VARIANT REQUIRED / NOT FOUND

| Part Name | OEM # | Brand | Notes |
|:---|:---|:---|:---|
| ... | \`..\` | ... | ... |

- **Action**: [exact order quantities or request VIN/engine code if variants exist]

---

### MODE 2 — MANUAL PROCEDURE / DIAGNOSTIC
Triggered when the user asks HOW to repair, diagnose, or service a component.
You MUST use the exact format below — no introduction, no conclusion.

**What:** [One sentence. The component/system and the procedure being performed.]

**Why:**
- [Root cause or symptom 1]
- [Root cause or symptom 2]
- [Root cause or symptom 3 — optional]

**How (Step-by-Step):**
1. [First actionable step]
2. [Next step]
3. [...]

**Specs:** [Only include if present in retrieved context — torque in N·m/kgf·cm, voltage in V, clearance in mm, SST numbers]

CRITICAL CONSTRAINTS for Mode 2:
- Output ONLY the four headers above. No intro. No summary. No closing remarks.
- Do NOT list standard hand tools, basic shop fluids, or generic safety steps (e.g. disconnect battery, raise the vehicle) UNLESS the context specifies a special OEM tool (SST).
- If specs exist in the retrieved manual context, include them under **Specs**. If not, omit the **Specs** line entirely.

---

### MODE 3 — HYBRID (Parts + Procedure)
Present Mode 1 first, then Mode 2 below it.

---

### MODE 4 — SHOP / JOB ORDER QUERIES
For revenue, job order status, service history, or mechanic workload: use concise tables and bullet points.

---

### MODE 5 — OBD-II DIAGNOSTIC CODE (Token-Optimized)
Triggered when the user asks about an OBD-II diagnostic trouble code (e.g. P0001, P0002, P0008, C0035, U0100).
You MUST use the exact token-optimized format below to conserve tokens (~120-150 tokens max). No conversational filler, no polite intro, no generic closing remarks.

🔍 **DTC [CODE] — [Definition]** ([Category])
- **Driveability**: [⛔ DO NOT DRIVE / ⚠️ DRIVE WITH CAUTION / ℹ️ SAFE TO DRIVE TO SHOP] — [1 sentence safety verdict]
- **Top Causes**:
  • [Cause 1]
  • [Cause 2]
  • [Cause 3]
- **Symptoms**: [Comma-separated: e.g. Check Engine Light, rough idle, hard start, rattle]
- **Shop Diagnostics**:
  1. [Actionable test step 1]
  2. [Actionable test step 2]
- **Related Codes**: [Sibling codes e.g. P0002–P0004 or omit line if none]

*If code is NOT found in database*: You CANNOT say much. Do NOT speculate or invent causes. Output ONLY:
🔍 **DTC [CODE] — Not in Verified Database**
- **Status**: Code [CODE] is not registered in AutoKita's verified database.
- **Action**: Verify the code on the scan tool or perform an official diagnostic scan. Do not guess root causes or driving risks.

━━━ TOOL RULES ━━━
- Parts → \`search_parts_by_name\` / \`get_part_fitment\`
- OBD-II DTC Codes → \`lookup_obd2_code\` (ALWAYS call this whenever an OBD-II code is mentioned. If the code does NOT exist in the database, you CANNOT say much about it—do NOT speculate or invent causes/procedures; state plainly that it is not in the verified database and advise an in-shop scan).
- Job Order OBD Scans → \`lookup_obd2_diagnostics\` (for vehicle scan reports or recent vehicle scan logs)
- Vehicle history → \`get_vehicle_repair_history\`
- Job order → \`get_job_order_parts\` / \`get_job_order_services\`
- Retrieved manual chunks take priority for exact torque, clearance, and SST values.
- Never disclose customer passwords or personal records.`;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Get caller IP for token budgeting
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  // Check token budget
  if (!hasBudget(ip, 'admin')) {
    return NextResponse.json(
      { error: "You've reached your daily AI limit. Try again tomorrow." },
      { status: 429 }
    );
  }

  // Track which sources were consulted this request (for UI status indicator)
  // 'pinecone' will be added once Pinecone is configured (Phase 2).
  const sourcesUsed = new Set<string>();

  // Check API key
  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json(
      { error: 'AI assistant is currently unavailable. Please contact the administrator.' },
      { status: 503 }
    );
  }

  // Parse request body
  let messages: ChatCompletionMessageParam[];
  let jobOrderContext: string | undefined;
  let incomingSessionId: number | null = null;
  let employeeId: number | null = null;
  let vehicleId: number | null = null;
  let queryCategory: string = 'diagnostic';

  try {
    const body = await req.json();
    messages = body.messages ?? [];
    jobOrderContext = typeof body.jobOrderContext === 'string' ? body.jobOrderContext : undefined;
    if (body.sessionId) incomingSessionId = parseInt(String(body.sessionId), 10) || null;
    if (body.employeeId) employeeId = parseInt(String(body.employeeId), 10) || null;
    if (body.vehicleId) vehicleId = parseInt(String(body.vehicleId), 10) || null;
    if (body.category) queryCategory = String(body.category);

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── History trimming ────────────────────────────────────────────────────────
  // Keep only the last MAX_HISTORY_MESSAGES user/assistant turns to prevent
  // unbounded token growth. Tool messages are appended fresh each request.
  const trimmedMessages = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-MAX_HISTORY_MESSAGES);

  // Extract latest user message
  const userMessage = trimmedMessages.filter((m) => m.role === 'user').slice(-1)[0];
  const userText = typeof userMessage?.content === 'string' ? userMessage.content : '';

  // ── Validate employeeId for internal AI session ─────────────────────────────
  let validatedEmployeeId: number | null = null;
  try {
    if (employeeId) {
      const empRes = await db.query(`SELECT id FROM employees WHERE id = $1`, [employeeId]);
      if (empRes.rows.length > 0) {
        validatedEmployeeId = empRes.rows[0].id;
      }
    }
    // If still null, fallback to the primary active employee so session is always attributed to an employee
    if (!validatedEmployeeId) {
      const defaultEmp = await db.query(`SELECT id FROM employees ORDER BY id ASC LIMIT 1`);
      if (defaultEmp.rows.length > 0) {
        validatedEmployeeId = defaultEmp.rows[0].id;
      }
    }
  } catch (empErr) {
    console.error('Error validating employee id for internal AI chat:', empErr);
  }

  // ── Session persistence in Supabase (internal_ai_sessions / messages) ───────
  let activeSessionId = incomingSessionId;
  try {
    if (activeSessionId) {
      const sessCheck = await db.query(
        `SELECT id, employee_id, context_vehicle_id FROM internal_ai_sessions WHERE id = $1`,
        [activeSessionId]
      );
      if (sessCheck.rows.length > 0) {
        // Update employee_id and vehicle_id if missing or updated
        if (validatedEmployeeId || vehicleId) {
          await db.query(
            `UPDATE internal_ai_sessions 
             SET employee_id = COALESCE(employee_id, $2),
                 context_vehicle_id = COALESCE(context_vehicle_id, $3)
             WHERE id = $1`,
            [activeSessionId, validatedEmployeeId, vehicleId]
          );
        }
      } else {
        activeSessionId = null;
      }
    }

    if (!activeSessionId) {
      const newSess = await db.query(
        `INSERT INTO internal_ai_sessions (
          employee_id,
          query_category,
          context_vehicle_id,
          started_at
        ) VALUES ($1, $2, $3, NOW())
        RETURNING id`,
        [validatedEmployeeId, queryCategory, vehicleId]
      );
      activeSessionId = newSess.rows[0]?.id ?? null;
    }

    // Record incoming employee query
    if (activeSessionId && userText) {
      await db.query(
        `INSERT INTO internal_ai_messages (
          session_id,
          sender,
          message_text,
          sent_at
        ) VALUES ($1, 'employee', $2, NOW())`,
        [activeSessionId, userText]
      );
    }
  } catch (dbErr) {
    console.error('Failed to record internal AI session/message into Supabase:', dbErr);
  }

  // Prepend system prompt
  const fullMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimmedMessages,
  ];

  let totalTokens = 0;

  try {
    // ── Pinecone Semantic Search (Hybrid RAG) ─────────────────────────────────
    // Embed the latest user message and retrieve the top-3 relevant knowledge
    // chunks from the admin vector index. Inject them into the system prompt.
    const adminIndex = getAdminIndex();
    // top-3 with 0.40 threshold — higher threshold keeps only highly-relevant manual chunks,
    // reducing hallucination risk and prompt token cost.
    const knowledgeChunks = await semanticSearch(userText, adminIndex, 3, 0.40);
    // Cap each chunk to MAX_RAG_CHUNK_CHARS before formatting to limit prompt token bloat.
    const cappedChunks = knowledgeChunks.map((c) => ({
      ...c,
      text: c.text.length > MAX_RAG_CHUNK_CHARS ? c.text.slice(0, MAX_RAG_CHUNK_CHARS) + '…' : c.text,
    }));
    const pineconeContext = formatContext(cappedChunks);
    if (knowledgeChunks.length > 0) sourcesUsed.add('pinecone');

    // Rebuild system prompt with injected Pinecone context (if any)
    // and optionally the active job order context
    let enrichedSystem = pineconeContext
      ? `${SYSTEM_PROMPT}${pineconeContext}`
      : SYSTEM_PROMPT;

    if (jobOrderContext) {
      enrichedSystem += `\n\n## Currently Active Job Order\n${jobOrderContext}\n\nWhen answering questions, refer to this job order's vehicle, services, parts, and inspection notes as the primary context. Be specific and use the real data above.`;
    }

    // ── Deterministic OBD-II Pre-Check Guardrail ──────────────────────────────
    // If the query mentions an OBD-II code that does NOT exist in the verified database,
    // inject the strict not-found guardrail directly into the prompt so the bot cannot say much.
    const detectedAdminObdCode = extractObd2Code(userText);
    if (detectedAdminObdCode) {
      const codeRecord = await getObd2CodeDetails(detectedAdminObdCode);
      if (!codeRecord) {
        enrichedSystem += `\n\n${formatObd2NotFoundContext(detectedAdminObdCode)}`;
      }
    }

    // Replace the system message in fullMessages with the enriched version
    fullMessages[0] = { role: 'system', content: enrichedSystem };

    // Agentic tool loop (max 3 tool-call rounds)
    for (let round = 0; round < 3; round++) {
      const response = await client.chat.completions.create({
        model: ADMIN_MODEL,
        messages: fullMessages,
        tools: TOOLS,
        tool_choice: 'auto',
        max_completion_tokens: MAX_OUTPUT_TOKENS,
      });

      const choice = response.choices[0];
      totalTokens += response.usage?.total_tokens ?? 0;

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls) {
        // Execute each tool call — filter to standard 'function' type calls only
        fullMessages.push(choice.message);
        sourcesUsed.add('sql');
        for (const tc of choice.message.tool_calls) {
          if (tc.type !== 'function') continue;
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(tc.function.arguments); } catch { /* empty args */ }
          const result = await executeTool(tc.function.name, args);
          // Truncate very large tool results to avoid bloating the context.
          // 2 000 chars ≈ ~500 tokens — enough for any realistic DB result set.
          const trimmedResult = result.length > 2000 ? result.slice(0, 2000) + '…(truncated)' : result;
          fullMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: trimmedResult,
          });
        }
        continue; // next round with tool results injected
      }

      // Derive status string for UI indicators
      const hasSql = sourcesUsed.has('sql');
      const hasPinecone = sourcesUsed.has('pinecone');
      const toolCallStatus = hasSql && hasPinecone ? 'both' : hasSql ? 'sql' : hasPinecone ? 'pinecone' : 'none';

      // Final answer
      const replyText = choice.message.content ?? '';
      deduct(ip, 'admin', totalTokens);

      // Record AI assistant reply in internal_ai_messages
      if (activeSessionId && replyText) {
        try {
          await db.query(
            `INSERT INTO internal_ai_messages (
              session_id,
              sender,
              message_text,
              sent_at
            ) VALUES ($1, 'bot', $2, NOW())`,
            [activeSessionId, replyText]
          );
        } catch (dbErr) {
          console.error('Failed to record internal AI assistant reply into Supabase:', dbErr);
        }
      }

      return NextResponse.json({
        reply: replyText,
        sessionId: activeSessionId,
        tokensUsed: totalTokens,
        tokensRemaining: remaining(ip, 'admin'),
        toolCallStatus,
      });
    }

    // Fallback if tool loop exhausted without a final text response
    const fallbackText = 'I was unable to complete the lookup after multiple attempts. Please try rephrasing your question.';
    deduct(ip, 'admin', totalTokens);

    if (activeSessionId) {
      try {
        await db.query(
          `INSERT INTO internal_ai_messages (
            session_id,
            sender,
            message_text,
            sent_at
          ) VALUES ($1, 'bot', $2, NOW())`,
          [activeSessionId, fallbackText]
        );
      } catch (dbErr) {
        console.error('Failed to record fallback internal AI reply into Supabase:', dbErr);
      }
    }

    return NextResponse.json({
      reply: fallbackText,
      sessionId: activeSessionId,
      tokensUsed: totalTokens,
      tokensRemaining: remaining(ip, 'admin'),
      toolCallStatus: sourcesUsed.has('sql') ? 'sql' : 'none',
    });
  } catch (err: unknown) {
    // Handle OpenAI API errors gracefully
    const apiErr = err as { status?: number; code?: string };
    if (apiErr?.status === 429) {
      const isBilling = apiErr?.code === 'credit_balance_exhausted' || apiErr?.code === 'insufficient_quota';
      return NextResponse.json(
        { error: isBilling
            ? 'The AI service is temporarily unavailable due to billing. Please contact the administrator.'
            : 'AI rate limit reached. Please wait a moment and try again.' },
        { status: 503 }
      );
    }
    console.error('OpenAI error (admin):', err);
    return NextResponse.json(
      { error: 'The AI assistant encountered an unexpected error. Please try again.' },
      { status: 503 }
    );
  }
}
