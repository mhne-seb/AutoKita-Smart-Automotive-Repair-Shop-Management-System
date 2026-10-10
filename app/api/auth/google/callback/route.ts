import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { STAFF_ACCESS_SQL, staffMayUseAdminSite } from '@/lib/staffAccess'
import { setSessionCookies } from '@/lib/session'
import {
  exchangeCode,
  verifyIdToken,
  readOauthCookie,
  signSignupCookie,
  signupCookieOptions,
  oauthCookieOptions,
} from '@/lib/googleAuth'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  
  const clearOauthCookie = (res: NextResponse) => {
    res.cookies.set('autokita_google_oauth', '', { ...oauthCookieOptions, maxAge: 0 })
  }

  // Generic redirect helper that clears the oauth cookie
  const fail = (reason: string, extraLog?: any) => {
    if (extraLog) console.error('[Google OAuth]', reason, extraLog)
    const res = NextResponse.redirect(new URL(`/login?google=${reason}`, req.url))
    clearOauthCookie(res)
    return res
  }

  const error = url.searchParams.get('error')
  if (error) {
    return fail('cancelled', error)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthCookieStr = req.cookies.get('autokita_google_oauth')?.value
  
  if (!code || !state || !oauthCookieStr) {
    return fail('failed', 'Missing code, state, or cookie')
  }

  const cookieData = await readOauthCookie(oauthCookieStr)
  if (!cookieData) {
    return fail('failed', 'Invalid or expired oauth cookie')
  }

  // Use timingSafeEqual to prevent timing attacks on state comparison
  try {
    const stateBuf = Buffer.from(state)
    const cookieStateBuf = Buffer.from(cookieData.state)
    if (stateBuf.length !== cookieStateBuf.length || !crypto.timingSafeEqual(stateBuf, cookieStateBuf)) {
      return fail('failed', 'State mismatch')
    }
  } catch {
    return fail('failed', 'State comparison failed')
  }

  let sub: string, email: string, givenName: string, familyName: string, name: string
  try {
    const idToken = await exchangeCode(code, cookieData.verifier)
    const payload = await verifyIdToken(idToken, cookieData.nonce)
    sub = payload.sub
    email = payload.email
    givenName = payload.givenName
    familyName = payload.familyName
    name = payload.name
  } catch (err) {
    return fail('failed', err)
  }

  try {
    let accountType: 'customer' | 'staff' | null = null
    let accountId: number | null = null
    let accountRole: 'customer' | 'staff' | null = null

    // 4a. Existing link
    const existing = await db.query(
      `SELECT account_type, account_id FROM auth_identities WHERE provider = 'google' AND provider_subject = $1 LIMIT 1`,
      [sub]
    )
    if (existing.rows.length > 0) {
      accountType = existing.rows[0].account_type
      accountId = existing.rows[0].account_id
      
      if (accountType === 'staff') {
        const ok = await staffMayUseAdminSite(accountId!)
        if (!ok) return fail('not_allowed', 'Staff account access denied')
        accountRole = 'staff'
      } else {
        const custRes = await db.query(`SELECT id FROM users WHERE id = $1 LIMIT 1`, [accountId])
        if (custRes.rows.length === 0) return fail('not_allowed', 'Linked customer account no longer exists')
        accountRole = 'customer'
      }
    } else {
      // 4b. Staff by email
      const staffByEmail = await db.query(
        `SELECT id, email, full_name, role::text AS role, status::text AS status, can_sign_in FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
        [email]
      )
      
      if (staffByEmail.rows.length > 0) {
        // Evaluate the rule explicitly in JS or execute the SQL
        const staffRes = await db.query(
          `SELECT id FROM employees WHERE LOWER(email) = $1 AND ${STAFF_ACCESS_SQL} LIMIT 1`,
          [email]
        )
        if (staffRes.rows.length === 0) {
          return fail('not_allowed', 'Employee email found but not allowed access')
        }
        accountType = 'staff'
        accountId = staffRes.rows[0].id
        accountRole = 'staff'
      } else {
        // 4c. Customer by email
        const userByEmail = await db.query(
          `SELECT id, email, nickname, first_name, last_name FROM users WHERE LOWER(email) = $1 ORDER BY (email = $1) DESC LIMIT 1`,
          [email]
        )
        
        if (userByEmail.rows.length > 0) {
          accountType = 'customer'
          accountId = userByEmail.rows[0].id
          accountRole = 'customer'
        }
      }
    }

    if (accountType && accountId && accountRole) {
      // 5. Link
      await db.query(
        `INSERT INTO auth_identities (provider, provider_subject, account_type, account_id, email)
         VALUES ('google', $1, $2, $3, $4)
         ON CONFLICT (provider, provider_subject) DO NOTHING`,
        [sub, accountType, accountId, email]
      )

      // 6. Sign in
      const res = NextResponse.redirect(new URL(`/login/google-done?role=${accountRole}&remember=${cookieData.remember ? '1' : '0'}`, req.url))
      await setSessionCookies(res, { userId: accountId, role: accountRole }, cookieData.remember)
      clearOauthCookie(res)
      return res
    } else {
      // 4d. Not found anywhere
      const signupToken = await signSignupCookie({
        sub,
        email,
        firstName: givenName || name.split(' ')[0] || '',
        lastName: familyName || name.split(' ').slice(1).join(' ') || '',
        remember: cookieData.remember
      })
      const res = NextResponse.redirect(new URL('/login/google-signup', req.url))
      res.cookies.set('autokita_google_signup', signupToken, signupCookieOptions)
      clearOauthCookie(res)
      return res
    }
  } catch (err) {
    return fail('failed', err)
  }
}
