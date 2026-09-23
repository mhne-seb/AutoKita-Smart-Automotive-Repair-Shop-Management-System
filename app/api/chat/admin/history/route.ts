// app/api/chat/admin/history/route.ts
// Returns the most recent internal_ai_session + its messages for a given employee.
// Used by the MechanicAIAssistant to restore chat history when the panel re-opens.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const employeeIdRaw = url.searchParams.get("employee_id");
  const limitRaw = url.searchParams.get("limit") ?? "30";

  if (!employeeIdRaw) {
    return NextResponse.json({ error: "employee_id is required." }, { status: 400 });
  }

  const employeeId = parseInt(employeeIdRaw, 10);
  if (isNaN(employeeId)) {
    return NextResponse.json({ error: "employee_id must be a number." }, { status: 400 });
  }

  const msgLimit = Math.min(parseInt(limitRaw, 10) || 30, 100);

  try {
    // Validate employee exists
    const empCheck = await db.query(
      "SELECT id FROM employees WHERE id = $1",
      [employeeId]
    );
    if (empCheck.rows.length === 0) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    // Get the most recent session for this employee
    const sessResult = await db.query(
      `SELECT id, query_category, context_vehicle_id, started_at
       FROM internal_ai_sessions
       WHERE employee_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [employeeId]
    );

    if (sessResult.rows.length === 0) {
      // No history yet — return empty
      return NextResponse.json({ sessionId: null, messages: [] });
    }

    const session = sessResult.rows[0];

    // Get the N most recent messages for that session
    const msgResult = await db.query(
      `SELECT id, sender, message_text, sent_at
       FROM internal_ai_messages
       WHERE session_id = $1
       ORDER BY id ASC
       LIMIT $2`,
      [session.id, msgLimit]
    );

    return NextResponse.json({
      sessionId: session.id,
      queryCategory: session.query_category,
      startedAt: session.started_at,
      messages: msgResult.rows.map((m: { sender: string; message_text: string; sent_at: Date }) => ({
        role: m.sender === "employee" ? "user" : "bot",
        text: m.message_text,
        time: new Date(m.sent_at).toLocaleTimeString("en-PH", {
          hour: "numeric",
          minute: "2-digit",
        }),
      })),
    });
  } catch (err) {
    console.error("Error fetching AI chat history:", err);
    return NextResponse.json({ error: "Failed to load chat history." }, { status: 500 });
  }
}
