import { NextRequest, NextResponse } from 'next/server'
import { requireCustomer } from '@/lib/authGuard'
import {
    GENERATED_PASSWORD_COOKIE,
    generatedPasswordCookieOptions,
    decryptGeneratedPassword,
} from '@/lib/generatedPasswordCookie'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    const auth = await requireCustomer()
    if (!auth.ok) return auth.response

    const token = req.cookies.get(GENERATED_PASSWORD_COOKIE)?.value
    const result = await decryptGeneratedPassword(token)

    const response = NextResponse.json(
        {
            success: true,
            password:
                result?.customerId === auth.session.userId
                    ? result.password
                    : null,
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