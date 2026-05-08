import type { Env, Data } from '../../_shared/session'
import { getSession, jsonResponse } from '../../_shared/session'
import { listEntries } from '../../_shared/drive'

export const onRequestGet: PagesFunction<Env, string, Data> = async (context) => {
  const { accessToken, sessionId } = context.data
  const session = await getSession(sessionId, context.env)
  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const files = await listEntries(accessToken, sessionId, session, context.env)
    return jsonResponse({ files })
  } catch (e) {
    const status = (e instanceof Error && 'status' in e) ? (e as { status: number }).status : 500
    return jsonResponse({ error: String(e) }, status)
  }
}
