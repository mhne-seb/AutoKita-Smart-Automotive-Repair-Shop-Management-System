import { db } from "@/lib/db";

async function main() {
  const r1 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'internal_ai_sessions' ORDER BY ordinal_position");
  console.log("sessions:", r1.rows.map((r: any) => r.column_name).join(", "));

  const r2 = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'internal_ai_messages' ORDER BY ordinal_position");
  console.log("messages:", r2.rows.map((r: any) => r.column_name).join(", "));

  const r3 = await db.query("SELECT id, employee_id, query_category, started_at FROM internal_ai_sessions ORDER BY id DESC LIMIT 5");
  console.log("recent sessions:", JSON.stringify(r3.rows));

  const r4 = await db.query("SELECT id, session_id, sender, substring(message_text, 1, 60) as msg FROM internal_ai_messages ORDER BY id DESC LIMIT 8");
  console.log("recent messages:", JSON.stringify(r4.rows));
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
