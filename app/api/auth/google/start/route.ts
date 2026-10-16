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
  const { searchParams } = new URL(req.url)
  const remember = searchParams.get('remember') === '1'
  const returnParam = searchParams.get('return')
  const returnTo = (returnParam === 'book' || returnParam === 'vehicles') ? returnParam : 'login'

  if (!googleConfigured() || !sessionSecretConfigured()) {
    const dest = returnTo === 'login' ? '/login' : '/book'
    return NextResponse.redirect(new URL(`${dest}?google=unavailable`, req.url))
  }

  const state = randomToken()
  const nonce = randomToken()
  const verifier = randomToken(64)
  const challenge = pkceChallenge(verifier)

  const token = await signOauthCookie({ state, nonce, verifier, remember, returnTo })
  const res = NextResponse.redirect(buildAuthUrl({ state, nonce, challenge }))
  res.cookies.set('autokita_google_oauth', token, oauthCookieOptions)

  return res
}
