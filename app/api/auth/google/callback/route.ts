import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { STAFF_ACCESS_SQL, staffMayUseAdminSite } from '@/lib/staffAccess'
import { setSessionCookies } from '@/lib/session'
import {
  exchangeCode,
  verifyIdToken,
  readOauthCookie,
  oauthCookieOptions,
} from '@/lib/googleAuth'
import crypto from 'crypto'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  
  const oauthCookieStr = req.cookies.get('autokita_google_oauth')?.value
  const cookieData = await readOauthCookie(oauthCookieStr)
  const returnTo = cookieData?.returnTo || 'login'

  const clearOauthCookie = (res: NextResponse) => {
    res.cookies.set('autokita_google_oauth', '', { ...oauthCookieOptions, maxAge: 0 })
  }

  // Generic redirect helper that clears the oauth cookie
  const fail = (reason: string, extraLog?: any) => {
    if (extraLog) console.error('[Google OAuth]', reason, extraLog)
    const dest = returnTo === 'login' ? '/login' : '/book'
    const res = NextResponse.redirect(new URL(`${dest}?google=${reason}`, req.url))
    clearOauthCookie(res)
    return res
  }

  const error = url.searchParams.get('error')
  if (error) {
    return fail('cancelled', error)
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  
  if (!code || !state || !oauthCookieStr) {
    return fail('failed', 'Missing code, state, or cookie')
  }

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
        } else {
          // 4d. Brand-new person: create the customer right now. The phone number is asked
          // inside the account setup (/setup), which the customer pages force until it is
          // finished (setup_completed_at stays NULL for this account).
          const clean = (s: string) => s.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, 40)
          const first = clean(givenName || name.split(' ')[0] || '')
          const last = clean(familyName || name.split(' ').slice(1).join(' ') || '')
          const nick = (first.split(' ')[0] || 'Customer').substring(0, 40)
          try {
            const created = await db.query(
              `INSERT INTO users (first_name, last_name, nickname, contact_number, email, password, registration_date)
               VALUES ($1, $2, $3, '', $4, NULL, NOW())
               RETURNING id`,
              [first, last, nick, email]
            )
            accountId = created.rows[0].id
          } catch (insertErr: any) {
            // Two sign-ins at the same moment: the unique email rule stops the second one.
            if (insertErr?.code !== '23505') throw insertErr
            const again = await db.query(`SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1`, [email])
            if (again.rows.length === 0) throw insertErr
            accountId = again.rows[0].id
          }
          accountType = 'customer'
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
      let doneUrl = `/login/google-done?role=${accountRole}&remember=${cookieData.remember ? '1' : '0'}`
      if (accountRole === 'customer') {
        if (cookieData.returnTo === 'book') {
          doneUrl += '&next=book'
        } else if (cookieData.returnTo === 'vehicles') {
          doneUrl += '&next=vehicles'
        }
      }
      const res = NextResponse.redirect(new URL(doneUrl, req.url))
      await setSessionCookies(res, { userId: accountId, role: accountRole }, cookieData.remember)
      clearOauthCookie(res)
      return res
    }

    return fail('failed', 'No account could be resolved')
  } catch (err) {
    return fail('failed', err)
  }
}
