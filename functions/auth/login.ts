import type { Env } from '../_shared/session'
import { jsonResponse } from '../_shared/session'

const SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const state = crypto.randomUUID()
  await env.SESSIONS.put(`oauth_state:${state}`, '1', { expirationTtl: 300 })

  const returnPath = new URL(request.url).searchParams.get('redirect') ?? '/'

  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.SESSION_DOMAIN}/auth/callback`,
    response_type: 'code',
    scope: SCOPE,
    state: `${state}:${encodeURIComponent(returnPath)}`,
    access_type: 'offline',
    prompt: 'consent',
  })

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302)
}

export const onRequestPost: PagesFunction<Env> = async () => {
  return jsonResponse({ error: 'Method not allowed' }, 405)
}
