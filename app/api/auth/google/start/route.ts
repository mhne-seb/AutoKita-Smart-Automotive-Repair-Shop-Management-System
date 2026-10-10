import { NextRequest, NextResponse } from 'next/server'
import {
  googleConfigured,
  randomToken,
  pkceChallenge,
  buildAuthUrl,
  signOauthCookie,
  oauthCookieOptions,
} from '@/lib/googleAuth'
import { sessionSecretConfigured } from '@/lib/session'

export async function GET(req: NextRequest) {
  if (!googleConfigured() || !sessionSecretConfigured()) {
    return NextResponse.redirect(new URL('/login?google=unavailable', req.url))
  }

  const { searchParams } = new URL(req.url)
  const remember = searchParams.get('remember') === '1'

  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken(64)
  const challenge = pkceChallenge(verifier)

  const token = await signOauthCookie({ state, nonce, verifier, remember })
  const res = NextResponse.redirect(buildAuthUrl({ state, nonce, challenge }))
  res.cookies.set('autokita_google_oauth', token, oauthCookieOptions)

  return res
}
