import type { Env, Data } from '../_shared/session'
import { parseSessionId, getSession, getValidAccessToken, makeSessionCookie, SESSION_TTL, jsonResponse } from '../_shared/session'

export const onRequest: PagesFunction<Env, string, Data> = async (context) => {
  const sessionId = parseSessionId(context.request)
  if (!sessionId) return jsonResponse({ error: 'Unauthorized' }, 401)

  const session = await getSession(sessionId, context.env)
  if (!session) return jsonResponse({ error: 'Session not found' }, 401)

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(sessionId, session, context.env)
  } catch {
    return jsonResponse({ error: 'Token refresh failed' }, 401)
  }

  context.data.sessionId = sessionId
  context.data.accessToken = accessToken
  context.data.session = session

  const response = await context.next()
  const secure = !context.env.SESSION_DOMAIN.startsWith('http://')
  const newHeaders = new Headers(response.headers)
  newHeaders.append('Set-Cookie', makeSessionCookie(sessionId, SESSION_TTL, secure))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  })
}
