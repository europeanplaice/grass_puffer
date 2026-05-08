import type { Env } from '../_shared/session'
import { parseSessionId, clearSessionCookie } from '../_shared/session'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const sessionId = parseSessionId(request)
  if (sessionId) {
    await env.SESSIONS.delete(`session:${sessionId}`)
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
    },
  })
}
