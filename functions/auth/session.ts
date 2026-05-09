import type { Env } from '../_shared/session'
import { parseSessionId, getSession, jsonResponse } from '../_shared/session'

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const sessionId = parseSessionId(request)
  if (!sessionId) return jsonResponse({ signedIn: false })

  const session = await getSession(sessionId, env)
  return jsonResponse({ signedIn: session !== null })
}
