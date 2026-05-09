import type { Env, Data } from '../../_shared/session'
import { jsonResponse } from '../../_shared/session'
import { searchEntries } from '../../_shared/drive'

export const onRequestGet: PagesFunction<Env, string, Data> = async (context) => {
  const { accessToken, sessionId, session } = context.data
  const query = new URL(context.request.url).searchParams.get('q') ?? ''
  if (!query.trim()) return jsonResponse({ files: [] })

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const files = await searchEntries(accessToken, sessionId, session, context.env, query)
    return jsonResponse({ files })
  } catch (e) {
    const status = (e instanceof Error && 'status' in e) ? (e as { status: number }).status : 500
    return jsonResponse({ error: String(e) }, status)
  }
}
