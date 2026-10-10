import { NextRequest, NextResponse } from 'next/server'
import { readSignupCookie } from '@/lib/googleAuth'
import { db } from '@/lib/db'
import { setSessionCookies } from '@/lib/session'
import { PHONE_RE } from '@/lib/bookingRules'

export async function POST(req: NextRequest) {
  const cookieStr = req.cookies.get('autokita_google_signup')?.value
  const data = await readSignupCookie(cookieStr)

  if (!data) {
    return NextResponse.json(
      { success: false, message: 'Your Google sign-in expired. Please try again.' },
      { status: 401 }
    )
  }

  let phoneRaw: string
  try {
    const body = await req.json()
    phoneRaw = String(body.phone || '').replace(/[\s-]/g, '')
  } catch {
    return NextResponse.json({ success: false, message: 'Invalid body' }, { status: 400 })
  }

  if (!PHONE_RE.test(phoneRaw)) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid mobile number, like 09171234567.' },
      { status: 400 }
    )
  }

  let phone: string
  if (phoneRaw.startsWith('+63')) {
    phone = '0' + phoneRaw.slice(3)
  } else if (phoneRaw.startsWith('63')) {
    phone = '0' + phoneRaw.slice(2)
  } else {
    phone = phoneRaw
  }

  if (!/^09\d{9}$/.test(phone)) {
    return NextResponse.json(
      { success: false, message: 'Enter a valid mobile number, like 09171234567.' },
      { status: 400 }
    )
  }

  const email = data.email
  let userId: number

  try {
    const checkStaff = await db.query(
      `SELECT id FROM employees WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    )
    if (checkStaff.rows.length > 0) {
      return NextResponse.json(
        { success: false, message: 'This email is registered to a staff account.' },
        { status: 409 }
      )
    }

    const checkUser = await db.query(
      `SELECT id, nickname, first_name, last_name FROM users WHERE LOWER(email) = $1 LIMIT 1`,
      [email]
    )
    
    let nameToReturn = ''

    if (checkUser.rows.length > 0) {
      userId = checkUser.rows[0].id
      const row = checkUser.rows[0]
      nameToReturn = row.nickname || [row.first_name, row.last_name].filter(Boolean).join(' ') || email
    } else {
      let fName = data.firstName.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 40)
      let lName = data.lastName.replace(/[\x00-\x1F\x7F]/g, '').substring(0, 40)
      let nick = (fName.split(' ')[0] || 'Customer').substring(0, 40)

      try {
        const insertUser = await db.query(
          `INSERT INTO users (first_name, last_name, nickname, contact_number, email, password, registration_date)
           VALUES ($1, $2, $3, $4, $5, NULL, NOW())
           RETURNING id`,
          [fName, lName, nick, phone, email]
        )
        userId = insertUser.rows[0].id
        nameToReturn = nick
      } catch (err: any) {
        if (err.code === '23505') {
          // unique violation, someone inserted it concurrently
          const getAgain = await db.query(
            `SELECT id, nickname, first_name, last_name FROM users WHERE LOWER(email) = $1 LIMIT 1`,
            [email]
          )
          if (getAgain.rows.length === 0) throw err // shouldn't happen
          userId = getAgain.rows[0].id
          const row = getAgain.rows[0]
          nameToReturn = row.nickname || [row.first_name, row.last_name].filter(Boolean).join(' ') || email
        } else {
          throw err
        }
      }
    }

    // Link identity
    await db.query(
      `INSERT INTO auth_identities (provider, provider_subject, account_type, account_id, email)
       VALUES ('google', $1, 'customer', $2, $3)
       ON CONFLICT (provider, provider_subject) DO NOTHING`,
      [data.sub, userId, email]
    )

    const res = NextResponse.json({
      success: true,
      role: 'customer',
      userId,
      name: nameToReturn,
      remember: data.remember === true,
    })

    await setSessionCookies(res, { userId, role: 'customer' }, data.remember)
    res.cookies.delete('autokita_google_signup')

    return res

  } catch (err) {
    console.error('Google signup complete error:', err)
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 })
  }
}
