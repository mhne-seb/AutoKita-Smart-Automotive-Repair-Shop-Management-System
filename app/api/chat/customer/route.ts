// app/api/chat/customer/route.ts
// Customer-facing chatbot endpoint.
// Model: gpt-5.4-mini (configurable via OPENAI_CUSTOMER_MODEL env var)
// Features: Pinecone Static RAG (service/FAQ context), token budget, no DB/tool access.

import { NextRequest, NextResponse } from 'next/server';
import { getOpenAIClient, CUSTOMER_MODEL } from '@/lib/openai';
import { hasBudget, deduct, remaining } from '@/lib/tokenBudget';
import { getCustomerIndex } from '@/lib/pinecone';
import { semanticSearch, formatContext } from '@/lib/vectorSearch';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// ─── Constants ────────────────────────────────────────────────────────────────

// Keep only the last N user+assistant turns to cap input tokens.
// 10 messages = 5 turns of back-and-forth — enough context for any conversation.
const MAX_HISTORY_MESSAGES = 10;

// Hard cap on generated output tokens. Customer answers are short; 350 is ample.
const MAX_OUTPUT_TOKENS = 350;

// ─── System Prompt ────────────────────────────────────────────────────────────
// Condensed to reduce per-call overhead while keeping all key instructions.

const SYSTEM_PROMPT = `You are AutoKita's friendly AI assistant for a professional automotive repair shop in the Philippines.

Help customers with: services (oil changes, brakes, diagnostics, transmission, aircon, suspension, tire rotation, battery), pricing, booking, and maintenance tips.

Vehicles with full coverage: Toyota Hilux & Vios (2005–2011). Other vehicles are assessed directly at the shop.

Booking: website → Book Appointment → select vehicle & service → choose date → confirm.

Rules:
- No OEM part numbers via chat — direct customer to shop.
- No fabricated prices — say "For an accurate quote, contact us directly or visit our shop."
- Friendly, concise, professional tone. Never discuss competitors.`;

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
  try {
    const body = await req.json();
    messages = body.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // ── History trimming: keep only the last MAX_HISTORY_MESSAGES messages ──────
  // Prevents unbounded input token growth as conversations get longer.
  const trimmedMessages = messages.slice(-MAX_HISTORY_MESSAGES);

  // Build full message history with system prompt
  const fullMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...trimmedMessages,
  ];

  try {
    // ── Pinecone Static RAG ───────────────────────────────────────────────────
    // Embed the latest user message and retrieve the top-2 matching services
    // or FAQs from the customer vector index. Inject them as dynamic context.
    // Using top-2 (down from 3) and a 0.5 score threshold to avoid injecting
    // low-relevance noise that wastes tokens.
    const userMessage = trimmedMessages.filter((m) => m.role === 'user').slice(-1)[0];
    const userText = typeof userMessage?.content === 'string' ? userMessage.content : '';

    const customerIndex = getCustomerIndex();
    const serviceChunks = await semanticSearch(userText, customerIndex, 2, 0.5);
    const serviceContext = formatContext(serviceChunks);

    // Enrich system prompt with live service context if found
    if (serviceContext) {
      fullMessages[0] = {
        role: 'system',
        content: `${SYSTEM_PROMPT}\n\n## Relevant Services${serviceContext}`,
      };
    }

    const response = await client.chat.completions.create({
      model: CUSTOMER_MODEL,
      messages: fullMessages,
      max_completion_tokens: MAX_OUTPUT_TOKENS,
    });

    const totalTokens = response.usage?.total_tokens ?? 0;
    deduct(ip, 'customer', totalTokens);

    return NextResponse.json({
      reply: response.choices[0].message.content ?? '',
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
