
import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { STAFF_ACCESS_SQL } from '@/lib/staffAccess'

const TTL_MS = 30 * 60 * 1000
export const RESET_LINK_MINUTES = TTL_MS / 60_000

export type AccountKind = 'customer' | 'staff'

export type ResetAccount = {
  kind: AccountKind
  id: number
  email: string
  name: string
  passwordHash: string
}

function secret(): string {
  const s = process.env.OTP_SECRET
  if (!s || s.length < 16) throw new Error('OTP_SECRET is missing or too short (see .env.example)')
  return s
}

// "password-reset" is part of the signed text, so a signature made here can
// never be passed off as a quotation code or anything else signed with OTP_SECRET.
function sign(kind: AccountKind, id: number, exp: number, passwordHash: string): string {
  return createHmac('sha256', secret())
    .update(`password-reset|${kind}|${id}|${exp}|${passwordHash}`)
    .digest('base64url')
}

export function createResetToken(account: ResetAccount): string {
  const exp = Date.now() + TTL_MS
  const mac = sign(account.kind, account.id, exp, account.passwordHash)
  return Buffer.from(`${account.kind}|${account.id}|${exp}|${mac}`).toString('base64url')
}

// Same lookup order as login: customers first, then staff.
export async function findAccountByEmail(email: string): Promise<ResetAccount | null> {
  const customer = await db.query(
    `SELECT id, email, COALESCE(NULLIF(first_name, ''), nickname, 'there') AS name, password
     FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email],
  )
  if (customer.rows[0]) return toAccount('customer', customer.rows[0])

  const staff = await db.query(
    `SELECT id, email, COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), 'there') AS name, password
     FROM employees WHERE LOWER(email) = LOWER($1) AND ${STAFF_ACCESS_SQL} LIMIT 1`,
    [email],
  )
  if (staff.rows[0]) return toAccount('staff', staff.rows[0])
  return null
}

async function findAccountById(kind: AccountKind, id: number): Promise<ResetAccount | null> {
  const sql = kind === 'customer'
    ? `SELECT id, email, COALESCE(NULLIF(first_name, ''), nickname, 'there') AS name, password FROM users WHERE id = $1`
    : `SELECT id, email, COALESCE(NULLIF(split_part(full_name, ' ', 1), ''), 'there') AS name, password FROM employees WHERE id = $1 AND ${STAFF_ACCESS_SQL}`
  const { rows } = await db.query(sql, [id])
  return rows[0] ? toAccount(kind, rows[0]) : null
}

function toAccount(kind: AccountKind, row: { id: number; email: string; name: string; password: string | null }): ResetAccount {
  return { kind, id: row.id, email: row.email, name: row.name, passwordHash: row.password ?? '' }
}

export async function checkResetToken(
  token: string,
): Promise<{ ok: true; account: ResetAccount } | { ok: false; reason: 'expired' | 'invalid' }> {
  let parts: string[]
  try {
    parts = Buffer.from(String(token), 'base64url').toString('utf8').split('|')
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (parts.length !== 4) return { ok: false, reason: 'invalid' }

  const [kind, idText, expText, mac] = parts
  const id = Number(idText)
  const exp = Number(expText)
  if ((kind !== 'customer' && kind !== 'staff') || !Number.isInteger(id) || !Number.isFinite(exp)) {
    return { ok: false, reason: 'invalid' }
  }
  if (Date.now() > exp) return { ok: false, reason: 'expired' }

  const account = await findAccountById(kind, id)
  if (!account) return { ok: false, reason: 'invalid' }

  // A used link lands here too: the password hash changed, so the signature differs.
  const expected = Buffer.from(sign(kind, id, exp, account.passwordHash))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid' }
  }
  return { ok: true, account }
}
