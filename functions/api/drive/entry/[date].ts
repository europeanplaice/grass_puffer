import type { Env, Data } from '../../../_shared/session'
import { jsonResponse } from '../../../_shared/session'
import {
  findEntryMeta,
  getEntryContent,
  saveEntry,
  deleteEntry,
  ensureFolder,
  DriveError,
} from '../../../_shared/drive'
import type { DiaryEntry } from '../../../_shared/drive'

export const onRequestGet: PagesFunction<Env, 'date', Data> = async (context) => {
  const { accessToken, sessionId, session } = context.data
  const date = context.params.date as string

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: 'Invalid date' }, 400)

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const meta = await findEntryMeta(accessToken, sessionId, session, context.env, date)
    if (!meta) return jsonResponse({ error: 'not_found' }, 404)

    const entry = await getEntryContent(accessToken, meta.id)
    return jsonResponse({ entry, meta })
  } catch (e) {
    if (e instanceof DriveError) {
      if (e.status === 404) return jsonResponse({ error: 'not_found' }, 404)
      return jsonResponse({ error: e.message }, e.status)
    }
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}

export const onRequestPost: PagesFunction<Env, 'date', Data> = async (context) => {
  const { accessToken, sessionId, session } = context.data
  const date = context.params.date as string

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: 'Invalid date' }, 400)

  let body: { content: string; fileId?: string }
  try {
    body = await context.request.json() as { content: string; fileId?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body.content !== 'string') return jsonResponse({ error: 'content is required' }, 400)

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const entry: DiaryEntry = { date, content: body.content, updated_at: new Date().toISOString() }
    const folderId = await ensureFolder(accessToken, sessionId, session, context.env)
    const savedMeta = await saveEntry(accessToken, entry, folderId, body.fileId)
    return jsonResponse(savedMeta)
  } catch (e) {
    if (e instanceof DriveError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}

export const onRequestDelete: PagesFunction<Env, 'date', Data> = async (context) => {
  const { accessToken, sessionId, session } = context.data
  const date = context.params.date as string

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: 'Invalid date' }, 400)

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const meta = await findEntryMeta(accessToken, sessionId, session, context.env, date)
    if (!meta) return new Response(null, { status: 204 })

    await deleteEntry(accessToken, meta.id)
    return new Response(null, { status: 204 })
  } catch (e) {
    if (e instanceof DriveError) {
      if (e.status === 404) return new Response(null, { status: 204 })
      return jsonResponse({ error: e.message }, e.status)
    }
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}
