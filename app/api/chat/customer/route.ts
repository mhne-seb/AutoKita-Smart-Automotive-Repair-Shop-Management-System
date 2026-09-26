// app/api/chat/customer/route.ts
// Customer-facing chatbot endpoint.
// Model: gpt-5.4-mini (configurable via OPENAI_CUSTOMER_MODEL env var)
// Features: Pinecone Static RAG (service/FAQ context), token budget, no DB/tool access.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, CUSTOMER_MODEL } from '@/lib/openai';
import { hasBudget, deduct, remaining } from '@/lib/tokenBudget';
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

// ─── System Prompt ────────────────────────────────────────────────────────────
// Token-optimized, structured persona. Eliminates conversational filler and generic preambles.

const SYSTEM_PROMPT = `You are AutoKita's AI customer assistant for a premier automotive repair shop in the Philippines.
You provide crisp, professional, formatted responses. To minimize token consumption, you avoid filler words, generic greetings ("Hello!", "How can I help you today?"), and long concluding paragraphs.

━━━ RESPONSE MODES & FORMATS ━━━

### MODE 1: SERVICE PRICING & DURATION INQUIRIES
When the customer asks about any automotive repair or maintenance service, pricing, or turnaround duration, you MUST format the response using this exact card:

🔧 **[Exact Service Name]**
• **Estimated Labor Range**: ₱[Min] – ₱[Max]
• **Estimated Duration**: [Time Range based on data, e.g. 45 mins / 1 – 1.5 hours / 2 – 3 hours]
• **Scope**: [1 concise sentence on the procedure performed]
• **Parts / Fluids**: [Quoted separately based on vehicle make, model, engine displacement, and oil/part grade]
• **Next Step**: Go to **Book Appointment** on AutoKita to reserve your service slot.

RULES FOR MODE 1:
- ALWAYS provide a PRICE RANGE (e.g. ₱450 – ₱1,200), NEVER just a single flat average.
- ALWAYS provide the empirical DURATION / time taken based on data.
- If asking about multiple services, output a card or clean bullet for each.
- If a service is not specifically indexed, state that labor starts with general mechanical inspection at ₱300 – ₱1,500 (~30-45 mins).

### MODE 2: OBD-II DIAGNOSTIC TROUBLE CODES
When the customer asks about an OBD-II code (e.g. P0300, P0171, C0035, U0100), you MUST format the response using this exact structure (identical to technical diagnostics):

🔍 **DTC [CODE] — [Definition]** ([Category])
• **Driveability**: [⛔ DO NOT DRIVE / ⚠️ DRIVE WITH CAUTION / ℹ️ SAFE TO DRIVE TO SHOP] — [1 sentence verdict]
• **Top Causes**:
  - [Cause 1]
  - [Cause 2]
  - [Cause 3]
• **Symptoms**: [Comma-separated: e.g. Check Engine Light, rough idle, hard start, engine hesitation]
• **Shop Diagnostics**:
  1. [Actionable test step 1]
  2. [Actionable test step 2]
• **Related Codes**: [Sibling codes e.g. P0301–P0304 or omit line if none]

RULES FOR MODE 2:
- If code is NOT in verified database, output ONLY:
  🔍 **DTC [CODE] — Not in Verified Database**
  • **Status**: Code [CODE] is not registered in AutoKita's verified technical database.
  • **Action**: Bring your vehicle to AutoKita workshop for an official OBD-II diagnostic scan. Do not guess root causes or driving risks.

### MODE 3: GENERAL & BOOKING INQUIRIES
- Keep answers strictly within 2–3 sentences.
- Booking flow: website → Book Appointment → select vehicle & service → pick date/time → confirm.
- Shop hours: Monday – Saturday, 8:00 AM – 5:00 PM.

━━━ PRIVACY & ISOLATION CONSTRAINTS (STRICT ZERO-TOLERANCE) ━━━
- Connect ONLY to verified reference OBD-II codes from the reference database.
- ZERO SCANNER INFORMATION: Never disclose or reference diagnostic scanner hardware tools (Launch/Autel), scanner software versions, scanner report files, or internal shop scan logs.
- ZERO PII: Never disclose, query, or mention any Personally Identifiable Information — NO customer names, license plates, VIN numbers, phone numbers, email addresses, or other customers' repair history.
- Never discuss competitors. Keep tone helpful, technical, and concise.`;

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';

  // Check token budget
  if (!hasBudget(ip, 'customer')) {
    return NextResponse.json(
      { error: "You've reached your daily chat limit. Please try again tomorrow." },
      { status: 429 }
    );
  }

  // Check API key
  const client = getOpenAIClient();
  if (!client) {
    return NextResponse.json(
      { error: 'Our AI assistant is temporarily unavailable. Please contact us directly for assistance.' },
      { status: 503 }
    );
  }

  // Parse request body
  let messages: ChatCompletionMessageParam[];
  let incomingSessionId: number | null = null;
  let customerUserId: number | null = null;
  let employeeId: number | null = null;
  let jobOrderId: number | null = null;

  try {
    const body = await req.json();
    messages = body.messages ?? [];
    if (body.sessionId) incomingSessionId = parseInt(String(body.sessionId), 10) || null;
    if (body.userId) customerUserId = parseInt(String(body.userId), 10) || null;
    if (body.employeeId) employeeId = parseInt(String(body.employeeId), 10) || null;
    if (body.jobOrderId) jobOrderId = parseInt(String(body.jobOrderId), 10) || null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
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

    // Enrich system prompt with live service & verified OBD-II context if found
    const contextAdditions = [
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
    deduct(ip, 'customer', totalTokens);

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

    return NextResponse.json({
      reply: replyText,
      sessionId: activeSessionId,
      tokensUsed: totalTokens,
      tokensRemaining: remaining(ip, 'customer'),
    });
  } catch (err: unknown) {
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
