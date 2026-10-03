// app/api/chat/customer/route.ts
// Customer-facing chatbot endpoint.
// Model: gpt-5.4-mini (configurable via OPENAI_CUSTOMER_MODEL env var)
// Features: Pinecone Static RAG (service/FAQ context), token budget, no DB/tool access.

import { NextRequest, NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/authGuard';
import { getOpenAIClient, CUSTOMER_MODEL } from '@/lib/openai';
import { checkRateLimit, recordRequestStart, recordRequestEnd, remaining } from '@/lib/tokenBudget';
import { getCustomerIndex } from '@/lib/pinecone';
import { semanticSearch, formatContext } from '@/lib/vectorSearch';
import { db } from '@/lib/db';
import { getObd2CodeDetails, extractObd2Code, formatObd2AntiHallucinationContext, formatObd2NotFoundContext } from '@/lib/obd2';
import { getLiveCustomerPricingContext } from '@/lib/servicePricing';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ─── Constants ────────────────────────────────────────────────────────────────

// Keep only the last N user+assistant turns to cap input tokens.
// 10 messages = 5 turns of back-and-forth — enough context for any conversation.
const MAX_HISTORY_MESSAGES = 10;

// Hard cap on generated output tokens. Concise formatted answers are short; 350 is ample.
const MAX_OUTPUT_TOKENS = 350;

const STATUS_MAP: Record<string, { label: string; progress: number; slug: string }> = {
  inspecting: { label: 'Under Inspection', progress: 20, slug: 'inspecting' },
  pending_customer_approval: { label: 'Quotation Ready', progress: 35, slug: 'quotation' },
  revision_pending: { label: 'Quotation Revised', progress: 35, slug: 'quotation' },
  waiting_on_parts: { label: 'Waiting on Parts', progress: 50, slug: 'in-progress' },
  in_progress: { label: 'Repair in Progress', progress: 65, slug: 'in-progress' },
  testing: { label: 'Quality Road Testing', progress: 85, slug: 'testing' },
  completed: { label: 'Billing & Payment', progress: 95, slug: 'billing' },
  released: { label: 'Vehicle Released', progress: 100, slug: 'completed' },
  cancelled: { label: 'Cancelled', progress: 0, slug: 'completed' },
};

// ─── System Prompt ────────────────────────────────────────────────────────────
// Token-optimized, structured persona. Eliminates conversational filler and generic preambles.

const SYSTEM_PROMPT = `You are AutoKita's AI customer assistant for a premier automotive repair shop in the Philippines.
You provide crisp, professional, formatted responses. To minimize token consumption, you avoid filler words, generic greetings ("Hello!", "How can I help you today?"), and long concluding paragraphs.

━━━ STRICT DOMAIN SCOPE & GUARDRAILS (CRITICAL ZERO-TOLERANCE) ━━━
- You are EXCLUSIVELY an automotive service and repair shop assistant for AutoKita.
- ALLOWED TOPICS:
  1. AutoKita repair and maintenance services, labor pricing ranges, and turnaround durations.
  2. AutoKita booking appointments, shop operating hours (Mon-Sat 8:00 AM - 5:00 PM), and shop location/contact.
  3. Vehicle maintenance symptoms, automotive care guidance, and OBD-II trouble codes.
  4. Real-time status, tracking, and progress inquiries regarding the customer's active vehicle service order.
- FORBIDDEN TOPICS:
  You must NEVER answer, entertain, assist with, or converse about anything outside vehicles, automotive repair, and AutoKita services. This includes, but is not limited to:
  • Food, restaurants, food delivery, recipes ("i'm hungry", "cheap food", etc.)
  • Entertainment, movies, music, sports, gaming, jokes, trivia
  • Personal life, general chit-chat, relationship advice, health/medical advice
  • Coding, academic questions, politics, non-automotive topics
- OUT-OF-SCOPE REFUSAL PROTOCOL:
  If a customer asks about anything outside automotive care or AutoKita services, respond strictly with:
  "I am AutoKita's automotive service assistant. I can only assist with vehicle maintenance, repair inquiries, service pricing, and booking appointments at AutoKita. How may I help you with your vehicle today?"

━━━ RESPONSE MODES & FORMATS ━━━

### MODE 1: SERVICE PRICING & DURATION INQUIRIES
When the customer asks about any automotive repair or maintenance service, pricing, or turnaround duration, you MUST format the response using this exact card:

🔧 **[Exact Service Name]**

- **Estimated Labor Range**: ₱[Min] – ₱[Max]
- **Estimated Duration**: [Time Range based on data, e.g. 45 mins / 1 – 1.5 hours / 2 – 3 hours]
- **Scope**: [1 concise sentence on the procedure performed]
- **Parts / Fluids**: [Quoted separately based on vehicle make, model, engine displacement, and oil/part grade]
- **Next Step**: Go to **Book Appointment** on AutoKita to reserve your service slot.

RULES FOR MODE 1:
- ALWAYS provide a PRICE RANGE (e.g. ₱450 – ₱1,200), NEVER just a single flat average.
- ALWAYS provide the empirical DURATION / time taken based on data.
- ALWAYS use standard markdown bullet dashes (- ) on separate lines with blank lines around lists.
- If asking about multiple services, output a card or clean bullet for each.
- If a service is not specifically indexed, state that labor starts with general mechanical inspection at ₱300 – ₱1,500 (~30-45 mins).

### MODE 2: OBD-II DIAGNOSTIC TROUBLE CODES
When the customer asks about an OBD-II code (e.g. P0300, P0171, C0035, U0100), you MUST format the response using this exact structure:

🔍 **DTC [CODE] — [Definition]** ([Category])

- **Driveability**: [⛔ DO NOT DRIVE / ⚠️ DRIVE WITH CAUTION / ℹ️ SAFE TO DRIVE TO SHOP] — [1 sentence verdict]
- **Top Causes**:
  - [Cause 1]
  - [Cause 2]
  - [Cause 3]
- **Symptoms**: [Comma-separated: e.g. Check Engine Light, rough idle, hard start, engine hesitation]
- **Shop Diagnostics**:
  1. [Actionable test step 1]
  2. [Actionable test step 2]
- **Related Codes**: [Sibling codes e.g. P0301–P0304 or omit line if none]

RULES FOR MODE 2:
- ALWAYS use standard markdown dashes (- ) on separate lines for all list items.
- If code is NOT in verified database, output ONLY:
  🔍 **DTC [CODE] — Not in Verified Database**

  - **Status**: Code [CODE] is not registered in AutoKita's verified technical database.
  - **Action**: Bring your vehicle to AutoKita workshop for an official OBD-II diagnostic scan. Do not guess root causes or driving risks.

### MODE 3: SHOP & APPOINTMENT BOOKING INQUIRIES
- Keep answers strictly within 2–3 sentences.
- Booking flow: website → Book Appointment → select vehicle & service → pick date/time → confirm.
- Shop hours: Monday – Saturday, 8:00 AM – 5:00 PM.
- In-shop services: General PMS, brake service, engine diagnosis, suspension, air conditioning, electrical systems.

### MODE 4: ACTIVE VEHICLE SERVICE TRACKING & STATUS
When the customer asks about the status of their vehicle, active service, or repair progress:
- If an ACTIVE SERVICE IN PROGRESS exists in their authenticated profile:
  🔧 **[Vehicle Year Make Model] — Job Order [Job Order ID]**

  - **Current Status**: [Status Label] — **[X]% complete**
  - **Stage**: [Stage Name]
  - **Service Being Performed**: [Service Names]
  - **Next Step**: You can view real-time photo findings, technician notes, and full tracking directly on your AutoKita dashboard.
- If NO active service is in progress:
  Politely inform the customer that their vehicle is not currently checked in for active repair. If they have registered vehicles, mention their vehicle and offer to help them book an appointment.

━━━ PRIVACY & ISOLATION CONSTRAINTS (STRICT ZERO-TOLERANCE) ━━━
- Connect ONLY to verified reference OBD-II codes from the reference database.
- ZERO SCANNER INFORMATION: Never disclose or reference diagnostic scanner hardware tools (Launch/Autel), scanner software versions, scanner report files, or internal shop scan logs.
- ZERO CROSS-CUSTOMER PII: Never disclose, query, or mention other customers' private data, phone numbers, email addresses, or other vehicles' repair history. You may only refer to the currently authenticated customer's own first name, registered vehicles, and active service order if provided in their profile context.
- Never discuss competitors. Keep tone helpful, technical, and concise.`;

// ─── Route Handlers ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUserId = searchParams.get('userId');
  const guard = await (rawUserId ? requireCustomer(parseInt(rawUserId, 10)) : requireCustomer())
  if (!guard.ok) return guard.response
  const userId = guard.session.userId

  try {
    // 1. Fetch user profile from Supabase
    const userRes = await db.query(
      `SELECT id, first_name, last_name, nickname, email FROM users WHERE id = $1`,
      [userId]
    );
    const user = userRes.rows[0] || null;
    const firstName = user?.first_name || user?.nickname || 'there';

    // 2. Fetch active job order (if any) from Supabase
    const joRes = await db.query(`
      SELECT jo.id, jo.status, jo.date_arrived, jo.date_promised,
             v.vehicle_make, v.vehicle_model, v.vehicle_year, v.plate_number,
             COALESCE(
               (SELECT STRING_AGG(s.service_name, ', ')
                FROM job_order_services jos
                JOIN services s ON s.id = jos.service_id
                WHERE jos.job_order_id = jo.id),
               'General Automotive Service'
             ) AS service_names
      FROM job_orders jo
      LEFT JOIN vehicles v ON v.id = jo.vehicle_id
      WHERE jo.user_id = $1 AND jo.status NOT IN ('released', 'cancelled', 'completed')
      ORDER BY jo.id DESC
      LIMIT 1
    `, [userId]);

    let activeJob = null;
    if (joRes.rows.length > 0) {
      const row = joRes.rows[0];
      const vehTitle = `${row.vehicle_year || ''} ${row.vehicle_make || ''} ${row.vehicle_model || ''}`.trim() || 'Vehicle';
      const meta = STATUS_MAP[row.status] || { label: row.status.replace(/_/g, ' '), progress: 50, slug: 'in-progress' };
      activeJob = {
        id: row.id,
        jobOrderNumber: `#JO-${row.id}`,
        vehicle: vehTitle,
        plateNumber: row.plate_number,
        serviceName: row.service_names,
        rawStatus: row.status,
        statusLabel: meta.label,
        progressPercent: meta.progress,
        trackingSlug: meta.slug,
      };
    }

    // 3. Fetch past messages for this user from Supabase (latest session)
    const msgRes = await db.query(`
      SELECT cs.id AS session_id, cm.id, cm.sender_type, cm.message_text, cm.sent_at
      FROM (
        SELECT id FROM chat_sessions 
        WHERE customer_user_id = $1 
        ORDER BY last_activity_at DESC NULLS LAST, id DESC 
        LIMIT 1
      ) cs
      JOIN chat_messages cm ON cm.session_id = cs.id
      ORDER BY cm.sent_at ASC, cm.id ASC
      LIMIT 30
    `, [userId]);

    const recentMessages = msgRes.rows.map((r: any) => ({
      id: String(r.id),
      role: r.sender_type === 'customer' ? 'user' : 'bot',
      text: r.message_text,
      time: new Date(r.sent_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    }));

    const activeSessionId = msgRes.rows[0]?.session_id ?? null;

    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        firstName,
        fullName: [user?.first_name, user?.last_name].filter(Boolean).join(' ') || firstName,
      },
      activeJob,
      recentMessages,
      sessionId: activeSessionId,
    });
  } catch (error) {
    console.error('Error in GET /api/chat/customer:', error);
    return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  // Fast-rate malicious bot failsafe & rolling daily token budget check
  const rateLimit = checkRateLimit(ip, 'customer');
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: rateLimit.reason },
      { 
        status: 429,
        headers: rateLimit.retryAfterSeconds ? { 'Retry-After': String(rateLimit.retryAfterSeconds) } : undefined
      }
    );
  }

  // Record active in-flight request to prevent parallel concurrency floods
  recordRequestStart(ip, 'customer');

  // Check API key
  const client = getOpenAIClient();
  if (!client) {
    recordRequestEnd(ip, 'customer', 0);
    return NextResponse.json(
      { error: 'Our AI assistant is temporarily unavailable. Please contact us directly for assistance.' },
      { status: 503 }
    );
  }

  // Parse request body
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    recordRequestEnd(ip, 'customer', 0);
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawUserId = body?.userId;
  const guard = await (rawUserId ? requireCustomer(parseInt(String(rawUserId), 10)) : requireCustomer());
  if (!guard.ok) {
    recordRequestEnd(ip, 'customer', 0);
    return guard.response;
  }

  const messages: ChatCompletionMessageParam[] = body?.messages ?? [];
  let incomingSessionId: number | null = null;
  let customerUserId: number | null = guard.session.userId ?? null;
  let employeeId: number | null = null;
  let jobOrderId: number | null = null;

  if (body?.sessionId) incomingSessionId = parseInt(String(body.sessionId), 10) || null;
  if (body?.userId) customerUserId = parseInt(String(body.userId), 10) || customerUserId;
  if (body?.employeeId) employeeId = parseInt(String(body.employeeId), 10) || null;
  if (body?.jobOrderId) jobOrderId = parseInt(String(body.jobOrderId), 10) || null;

  if (!Array.isArray(messages) || messages.length === 0) {
    recordRequestEnd(ip, 'customer', 0);
    return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
  }

  // ── History trimming: keep only the last MAX_HISTORY_MESSAGES messages ──────
  // Prevents unbounded input token growth as conversations get longer.
  const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);

  // Extract latest user message
  const userMessage = trimmedMessages.filter((m) => m.role === 'user').slice(-1)[0];
  const userText = typeof userMessage?.content === 'string' ? userMessage.content : '';

  // ── Verify sender identity depending on employeeId ──────────────────────────
  let isEmployeeSender = false;
  let validatedEmployeeId: number | null = null;
  let validatedCustomerId: number | null = null;

  try {
    if (employeeId) {
      const empRes = await db.query(`SELECT id FROM employees WHERE id = $1`, [employeeId]);
      if (empRes.rows.length > 0) {
        isEmployeeSender = true;
        validatedEmployeeId = empRes.rows[0].id;
      }
    }

    // If employeeId was not provided, but customerUserId was, check if it belongs to an employee
    if (!isEmployeeSender && customerUserId) {
      const empRes = await db.query(`SELECT id FROM employees WHERE id = $1`, [customerUserId]);
      if (empRes.rows.length > 0) {
        isEmployeeSender = true;
        validatedEmployeeId = empRes.rows[0].id;
      } else {
        const userRes = await db.query(`SELECT id FROM users WHERE id = $1`, [customerUserId]);
        if (userRes.rows.length > 0) {
          validatedCustomerId = userRes.rows[0].id;
        } else {
          validatedCustomerId = customerUserId;
        }
      }
    }
  } catch (idErr) {
    console.error('Error verifying sender identity:', idErr);
  }

  // ── Session persistence in Supabase ─────────────────────────────────────────
  let activeSessionId = incomingSessionId;
  try {
    if (activeSessionId) {
      const sessCheck = await db.query(
        `SELECT id, customer_user_id, assigned_employee_id FROM chat_sessions WHERE id = $1`,
        [activeSessionId]
      );
      if (sessCheck.rows.length > 0) {
        if (isEmployeeSender && validatedEmployeeId) {
          await db.query(
            `UPDATE chat_sessions 
             SET last_activity_at = NOW(),
                 assigned_employee_id = COALESCE(assigned_employee_id, $2),
                 session_status = 'admin_handling'
             WHERE id = $1`,
            [activeSessionId, validatedEmployeeId]
          );
        } else {
          await db.query(
            `UPDATE chat_sessions 
             SET last_activity_at = NOW(),
                 customer_user_id = COALESCE(customer_user_id, $2)
             WHERE id = $1`,
            [activeSessionId, validatedCustomerId]
          );
        }
      } else {
        activeSessionId = null;
      }
    }

    if (!activeSessionId) {
      if (isEmployeeSender && validatedEmployeeId) {
        const newSess = await db.query(
          `INSERT INTO chat_sessions (
            customer_user_id, 
            assigned_employee_id,
            reference_type, 
            reference_id, 
            session_status, 
            started_at, 
            last_activity_at
          ) VALUES ($1, $2, $3, $4, 'admin_handling', NOW(), NOW())
          RETURNING id`,
          [validatedCustomerId, validatedEmployeeId, jobOrderId ? 'job_order' : 'general', jobOrderId]
        );
        activeSessionId = newSess.rows[0]?.id ?? null;
      } else {
        const newSess = await db.query(
          `INSERT INTO chat_sessions (
            customer_user_id, 
            assigned_employee_id,
            reference_type, 
            reference_id, 
            session_status, 
            started_at, 
            last_activity_at
          ) VALUES ($1, NULL, $2, $3, 'bot_handling', NOW(), NOW())
          RETURNING id`,
          [validatedCustomerId, jobOrderId ? 'job_order' : 'general', jobOrderId]
        );
        activeSessionId = newSess.rows[0]?.id ?? null;
      }
    }

    // Record incoming message depending on employee id / sender identity
    if (activeSessionId && userText) {
      if (isEmployeeSender && validatedEmployeeId) {
        // Admin / Employee message
        await db.query(
          `INSERT INTO chat_messages (
            session_id, 
            sender_type, 
            sender_id, 
            message_text, 
            sent_at,
            is_read_by_customer,
            is_read_by_admin
          ) VALUES ($1, 'admin', $2, $3, NOW(), FALSE, TRUE)`,
          [activeSessionId, validatedEmployeeId, userText]
        );
      } else {
        // Customer message
        await db.query(
          `INSERT INTO chat_messages (
            session_id, 
            sender_type, 
            sender_id, 
            message_text, 
            sent_at,
            is_read_by_customer,
            is_read_by_admin
          ) VALUES ($1, 'customer', $2, $3, NOW(), TRUE, FALSE)`,
          [activeSessionId, validatedCustomerId, userText]
        );
      }
    }
  } catch (dbErr) {
    console.error('Failed to record chat session/message into Supabase:', dbErr);
  }

  // Build full message history with system prompt
  const fullMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimmedMessages,
  ];

  try {
    // ── Live Supabase Customer Profile & Active Job Context ──────────────────
    let customerContext = '';
    let activeJobData: any = null;
    if (validatedCustomerId) {
      try {
        const uRes = await db.query(`SELECT first_name, last_name, nickname FROM users WHERE id = $1`, [validatedCustomerId]);
        const userRow = uRes.rows[0];
        const custName = userRow?.first_name || userRow?.nickname || 'Customer';

        const vRes = await db.query(
          `SELECT vehicle_make, vehicle_model, vehicle_year, plate_number FROM vehicles WHERE user_id = $1 ORDER BY id ASC`,
          [validatedCustomerId]
        );
        const vehList = vRes.rows.map((r: any) => `${r.vehicle_year || ''} ${r.vehicle_make || ''} ${r.vehicle_model || ''} (Plate: ${r.plate_number || 'N/A'})`.trim()).join('; ');

        const joRes = await db.query(`
          SELECT jo.id, jo.status, jo.date_arrived, jo.date_promised,
                 v.vehicle_make, v.vehicle_model, v.vehicle_year, v.plate_number,
                 COALESCE(
                   (SELECT STRING_AGG(s.service_name, ', ')
                    FROM job_order_services jos
                    JOIN services s ON s.id = jos.service_id
                    WHERE jos.job_order_id = jo.id),
                   'General Automotive Service'
                 ) AS service_names
          FROM job_orders jo
          LEFT JOIN vehicles v ON v.id = jo.vehicle_id
          WHERE jo.user_id = $1 AND jo.status NOT IN ('released', 'cancelled', 'completed')
          ORDER BY jo.id DESC
          LIMIT 1
        `, [validatedCustomerId]);

        if (joRes.rows.length > 0) {
          const row = joRes.rows[0];
          const vehTitle = `${row.vehicle_year || ''} ${row.vehicle_make || ''} ${row.vehicle_model || ''}`.trim() || 'Vehicle';
          const meta = STATUS_MAP[row.status] || { label: row.status.replace(/_/g, ' '), progress: 50, slug: 'in-progress' };
          activeJobData = {
            id: row.id,
            jobOrderNumber: `#JO-${row.id}`,
            vehicle: vehTitle,
            plateNumber: row.plate_number,
            serviceName: row.service_names,
            rawStatus: row.status,
            statusLabel: meta.label,
            progressPercent: meta.progress,
            trackingSlug: meta.slug,
          };

          customerContext = `\n\n## Authenticated Customer Profile (Supabase Verified)
- Customer Name: ${custName}
- Registered Vehicles: ${vehList || 'None registered yet'}
- ACTIVE SERVICE IN PROGRESS:
  • Job Order ID: #JO-${row.id}
  • Vehicle: ${vehTitle} (Plate: ${row.plate_number || 'N/A'})
  • Services: ${row.service_names}
  • Live Status: ${meta.label} (${meta.progress}% complete)
  • Internal Status: ${row.status}`;
        } else {
          customerContext = `\n\n## Authenticated Customer Profile (Supabase Verified)
- Customer Name: ${custName}
- Registered Vehicles: ${vehList || 'None registered yet'}
- ACTIVE SERVICE IN PROGRESS: None currently active in the workshop.`;
        }
      } catch (custErr) {
        console.error('Error fetching customer context from Supabase:', custErr);
      }
    }

    // ── Live Supabase Service Pricing & Duration ─────────────────────────────
    const pricingContext = await getLiveCustomerPricingContext(userText);

    // ── Pinecone Static RAG ───────────────────────────────────────────────────
    let serviceContext = '';
    try {
      const customerIndex = getCustomerIndex();
      const serviceChunks = await semanticSearch(userText, customerIndex, 2, 0.5);
      serviceContext = formatContext(serviceChunks);
    } catch (pineconeErr) {
      // Graceful fallback if Pinecone is not reachable
    }

    // ── Deterministic OBD-II Code Lookup (Zero Scanner Data, Zero PII) ────────
    let obdContext = '';
    const detectedCode = extractObd2Code(userText);
    if (detectedCode) {
      const record = await getObd2CodeDetails(detectedCode);
      if (record) {
        obdContext = `\n\n${formatObd2AntiHallucinationContext(record)}`;
      } else {
        obdContext = `\n\n${formatObd2NotFoundContext(detectedCode)}`;
      }
    }

    // Enrich system prompt with customer context, live service & verified OBD-II context if found
    const contextAdditions = [
      customerContext,
      pricingContext ? `\n\n${pricingContext}` : '',
      serviceContext ? `\n\n## Relevant Services & Knowledge\n${serviceContext}` : '',
      obdContext,
    ].filter(Boolean).join('');

    if (contextAdditions) {
      fullMessages[0] = {
        role: 'system',
        content: `${SYSTEM_PROMPT}${contextAdditions}`,
      };
    }

    const response = await client.chat.completions.create({
      model: CUSTOMER_MODEL,
      messages: fullMessages,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
    });

    const replyText = response.choices[0]?.message.content ?? '';
    const totalTokens = response.usage?.total_tokens ?? 0;
    recordRequestEnd(ip, 'customer', totalTokens);

    // Record AI bot reply in chat_messages
    if (activeSessionId && replyText) {
      try {
        await db.query(
          `INSERT INTO chat_messages (
            session_id, 
            sender_type, 
            sender_id, 
            message_text, 
            sent_at,
            is_read_by_customer,
            is_read_by_admin
          ) VALUES ($1, 'bot', NULL, $2, NOW(), TRUE, TRUE)`,
          [activeSessionId, replyText]
        );
      } catch (dbErr) {
        console.error('Failed to record bot reply into Supabase:', dbErr);
      }
    }

    const isStatusQuery = /\b(status|track|tracking|progress|update|my car|my vehicle|my service|ongoing|current service)\b/i.test(userText);

    return NextResponse.json({
      reply: replyText,
      sessionId: activeSessionId,
      tokensUsed: totalTokens,
      tokensRemaining: remaining(ip, 'customer'),
      activeJob: activeJobData,
      showJobCard: Boolean(isStatusQuery && activeJobData),
    });
  } catch (err: unknown) {
    recordRequestEnd(ip, 'customer', 0);
    const apiErr = err as { status?: number; code?: string };
    if (apiErr?.status === 429) {
      const isBilling = apiErr?.code === 'credit_balance_exhausted' || apiErr?.code === 'insufficient_quota';
      return NextResponse.json(
        { error: isBilling
            ? 'Our AI assistant is temporarily unavailable. Please contact us directly for assistance.'
            : 'Too many requests. Please wait a moment and try again.' },
        { status: 503 }
      );
    }
    console.error('OpenAI error (customer):', err);
    return NextResponse.json(
      { error: 'Our AI assistant encountered an unexpected error. Please try again.' },
      { status: 503 }
    );
  }
}
