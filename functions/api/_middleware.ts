import type { Env, Data } from '../_shared/session'
import { parseSessionId, getSession, getValidAccessToken, jsonResponse } from '../_shared/session'

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
  return context.next()
}
