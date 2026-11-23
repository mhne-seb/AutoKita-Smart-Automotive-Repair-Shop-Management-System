import { createHash } from 'node:crypto'
import { EncryptJWT, jwtDecrypt } from 'jose'

export const GENERATED_PASSWORD_COOKIE = 'autokita_generated_password'

export const generatedPasswordCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth/google/generated-password',
    maxAge: 300, // five minutes
}

function encryptionKey(): Uint8Array {
    const secret = process.env.SESSION_SECRET
    if (!secret || secret.length < 32) {
        throw new Error('SESSION_SECRET is missing or too short')
    }

    // Use a separate key for this cookie, derived from the session secret.
    return createHash('sha256')
        .update('autokita-generated-password-cookie:')
        .update(secret)
        .digest()
}

export async function encryptGeneratedPassword(
    customerId: number,
    password: string,
    passwordHash: string
): Promise<string> {
    return new EncryptJWT({ password, passwordHash })
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .setSubject(String(customerId))
        .setIssuedAt()
        .setExpirationTime('5m')
        .encrypt(encryptionKey())
}

export async function decryptGeneratedPassword(
    token: string | undefined
): Promise<{ customerId: number; password: string; passwordHash: string } | null> {
    if (!token) return null

    try {
        const { payload } = await jwtDecrypt(token, encryptionKey())
        const customerId = Number(payload.sub)

        if (
            !Number.isSafeInteger(customerId) ||
            customerId <= 0 ||
            typeof payload.password !== 'string' ||
            typeof payload.passwordHash !== 'string'
        ) {
            return null
        }

        return { customerId, password: payload.password, passwordHash: payload.passwordHash }
    } catch {
        return null // Missing, expired, or altered cookie
    }
}
