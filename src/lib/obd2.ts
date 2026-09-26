// src/lib/obd2.ts
// ---------------------------------------------------------------------------
// Deterministic OBD-II Diagnostic Trouble Code (DTC) Service
// Provides zero-hallucination lookups from the obd2_codes database table.
// Covers Powertrain (P), Body (B), Chassis (C), and Network (U) trouble codes,
// including sibling/sub-codes (e.g., P0002-P0004 under P0001).
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';

export interface Obd2CodeRecord {
  id: number;
  code: string;
  category: string;
  description: string;
  meaning: string | null;
  symptoms: string | null;
  causes: string | null;
  seriousness: string | null;
  can_i_still_drive: string | null;
  how_to_diagnose: string | null;
  inspection_difficulty: string | null;
  more_about: string | null;
  related_codes: string[];
  is_primary: boolean;
  parent_code: string | null;
  source_url: string | null;
}

/**
 * Extracts a standardized 5-character OBD-II code (e.g., P0001, P0008, C1401, U0100)
 * from user input text.
 */
export function extractObd2Code(input: string): string | null {
  if (!input) return null;
  const match = input.match(/\b([PBCU][0-9A-Z]{4})\b/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Deterministically retrieves verified OBD-II code details from the database.
 * Supports exact code matches, parent-child sibling matches, and related-code matches.
 */
export async function getObd2CodeDetails(codeQuery: string): Promise<Obd2CodeRecord | null> {
  const cleanCode = extractObd2Code(codeQuery) ?? codeQuery.trim().toUpperCase();
  if (!cleanCode) return null;

  try {
    const res = await db.query<Obd2CodeRecord>(
      `SELECT id, code, category, description, meaning, symptoms, causes,
              seriousness, can_i_still_drive, how_to_diagnose, inspection_difficulty,
              more_about, related_codes, is_primary, parent_code, source_url
       FROM obd2_codes
       WHERE code = $1 OR $1 = ANY(related_codes)
       ORDER BY (code = $1) DESC, is_primary DESC
       LIMIT 1`,
      [cleanCode]
    );

    return res.rows[0] ?? null;
  } catch (err) {
    console.error(`[OBD2] Failed to lookup code "${cleanCode}":`, err);
    return null;
  }
}

/**
 * Searches the OBD-II database by keyword or description (e.g., "fuel volume regulator", "camshaft slow response").
 */
export async function searchObd2Codes(
  keyword: string,
  limit: number = 5
): Promise<Array<Pick<Obd2CodeRecord, 'code' | 'category' | 'description' | 'is_primary' | 'parent_code'>>> {
  const cleanKeyword = keyword.trim();
  if (!cleanKeyword) return [];

  try {
    const res = await db.query(
      `SELECT code, category, description, is_primary, parent_code
       FROM obd2_codes
       WHERE code ILIKE $1 
          OR description ILIKE $1 
          OR symptoms ILIKE $1 
          OR causes ILIKE $1
       ORDER BY (code ILIKE $1) DESC, is_primary DESC
       LIMIT $2`,
      [`%${cleanKeyword}%`, Math.min(limit, 10)]
    );

    return res.rows;
  } catch (err) {
    console.error(`[OBD2] Search failed for keyword "${cleanKeyword}":`, err);
    return [];
  }
}

function clipText(text: string | null | undefined, maxChars = 240): string {
  if (!text) return '';
  const cleaned = text.trim().replace(/\s+/g, ' ');
  return cleaned.length > maxChars ? `${cleaned.slice(0, maxChars).trim()}…` : cleaned;
}

/**
 * Formats an OBD-II code record into a structured, token-optimized context block
 * with strict anti-hallucination directives for the LLM.
 * Caps verbose fields to keep prompt overhead under ~120-150 tokens.
 */
export function formatObd2AntiHallucinationContext(record: Obd2CodeRecord): string {
  const lines: string[] = [
    `### Verified OBD-II Reference: ${record.code} (${record.category}) — ${record.description}`,
    `- **DTC**: ${record.code} | Category: ${record.category}`,
    `- **Definition**: ${record.description}`,
  ];

  if (!record.is_primary && record.parent_code) {
    lines.push(`- **Parent Family**: ${record.parent_code} (Sub-variant of ${record.parent_code})`);
  }

  if (record.related_codes && record.related_codes.length > 0) {
    lines.push(`- **Related Sibling Codes**: ${record.related_codes.slice(0, 6).join(', ')}`);
  }

  if (record.meaning) {
    lines.push(`- **Meaning**: ${clipText(record.meaning, 220)}`);
  }

  if (record.causes) {
    lines.push(`- **Causes**: ${clipText(record.causes, 200)}`);
  }

  if (record.symptoms) {
    lines.push(`- **Symptoms**: ${clipText(record.symptoms, 180)}`);
  }

  if (record.seriousness) {
    lines.push(`- **Severity**: ${clipText(record.seriousness, 160)}`);
  }

  if (record.can_i_still_drive) {
    lines.push(`- **Can Still Drive?**: ${clipText(record.can_i_still_drive, 160)}`);
  }

  if (record.how_to_diagnose) {
    lines.push(`- **Diagnosis Procedure**: ${clipText(record.how_to_diagnose, 180)}`);
  }

  lines.push('> Strict Anti-Hallucination Directive: State facts ONLY from this verified record. Do not invent causes, symptoms, or safety risks.');

  return lines.join('\n');
}

/**
 * Formats a strict "not found" context block when a code does not exist in the database.
 * Instructs the AI that it cannot say much about the code and must avoid any speculative diagnosis.
 */
export function formatObd2NotFoundContext(code: string): string {
  return [
    `### OBD-II Diagnostic Code: ${code} [NOT IN DATABASE]`,
    `- Status: Code ${code} is NOT present in AutoKita's verified OBD-II diagnostic database.`,
    `> [!CRITICAL ZERO-HALLUCINATION GUARDRAIL]`,
    `> You do NOT have verified data for code ${code} in the database.`,
    `> Therefore, you CANNOT say much about this code for both customer and admin queries.`,
    `> STRICT FORBIDDEN ACTIONS:`,
    `> - Do NOT guess or speculate on what this code means.`,
    `> - Do NOT invent causes, components, or diagnostic steps.`,
    `> - Do NOT make claims about vehicle driveability or safety risks.`,
    `> REQUIRED MINIMAL ACTION:`,
    `> - State plainly: "Code ${code} is not registered in AutoKita's verified diagnostic database."`,
    `> - Direct the user to verify the code or have the vehicle scanned with an official OBD-II diagnostic tool at AutoKita workshop.`,
  ].join('\n');
}

