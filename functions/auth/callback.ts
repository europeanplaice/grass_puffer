import type { Env, SessionData } from '../_shared/session'
import { saveSession, makeSessionCookie, SESSION_TTL, jsonResponse } from '../_shared/session'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state') ?? ''

  const colonIdx = stateParam.indexOf(':')
  const state = colonIdx === -1 ? stateParam : stateParam.slice(0, colonIdx)
  const returnPath = colonIdx === -1 ? '/' : decodeURIComponent(stateParam.slice(colonIdx + 1))

  if (!code || !state) {
    return jsonResponse({ error: 'Missing code or state' }, 400)
  }

  const codeVerifier = await env.SESSIONS.get(`oauth_state:${state}`)
  if (!codeVerifier) {
    return jsonResponse({ error: 'Invalid or expired state' }, 400)
  }
  await env.SESSIONS.delete(`oauth_state:${state}`)

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${env.SESSION_DOMAIN}/auth/callback`,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }).toString(),
  })

  if (!tokenResp.ok) {
    const body = await tokenResp.text()
    return jsonResponse({ error: `Token exchange failed: ${body}` }, 502)
  }

  const tokens = await tokenResp.json() as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  if (!tokens.refresh_token) {
    return jsonResponse({ error: 'No refresh token received. Revoke app access and try again.' }, 502)
  }

  const sessionId = crypto.randomUUID()
  const session: SessionData = {
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    expires_at: Date.now() + tokens.expires_in * 1000,
  }
  await saveSession(sessionId, session, env)

  const safeReturnPath = returnPath.startsWith('/') ? returnPath : '/'

  const secure = !env.SESSION_DOMAIN.startsWith('http://')

  return new Response(null, {
    status: 302,
    headers: {
      Location: safeReturnPath,
      'Set-Cookie': makeSessionCookie(sessionId, SESSION_TTL, secure),
    },
  })
}
