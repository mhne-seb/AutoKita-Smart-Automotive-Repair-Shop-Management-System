import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/authGuard'
import { db } from '@/lib/db'
import {
    GENERATED_PASSWORD_COOKIE,
    generatedPasswordCookieOptions,
    decryptGeneratedPassword,
} from '@/lib/generatedPasswordCookie'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const auth = await requireCustomer()
    if (!auth.ok) return auth.response

    const token = req.cookies.get(GENERATED_PASSWORD_COOKIE)?.value
    const result = await decryptGeneratedPassword(token)
    let password: string | null = null

    if (result?.customerId === auth.session.userId) {
        try {
            // The conditional update is atomic: a replay or concurrent request cannot
            // reveal the same password twice, even with a saved copy of the cookie.
            const claimed = await db.query(
                `UPDATE users
                 SET generated_password_claimed_at = (NOW() AT TIME ZONE 'Asia/Manila')
                 WHERE id = $1 AND password = $2 AND generated_password_claimed_at IS NULL
                 RETURNING id`,
                [auth.session.userId, result.passwordHash],
            )
            if (claimed.rowCount === 1) password = result.password
        } catch (err) {
            console.error('Generated password claim failed:', err)
            return NextResponse.json(
                { success: false, message: 'Could not load your password. Try again.' },
                { status: 500, headers: { 'Cache-Control': 'no-store' } },
            )
        }
    }

    const response = NextResponse.json(
        {
            success: true,
            password,
        },
        { headers: { 'Cache-Control': 'no-store' } },
    )

    // Remove the temporary cookie whether it was valid or invalid.
    response.cookies.set(GENERATED_PASSWORD_COOKIE, '', {
        ...generatedPasswordCookieOptions,
        maxAge: 0,
    })

    return response
}
