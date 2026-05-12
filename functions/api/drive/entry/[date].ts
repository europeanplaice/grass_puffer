import type { Env, Data } from '../../../_shared/session'
import { jsonResponse } from '../../../_shared/session'
import {
  findEntryMeta,
  getEntryContent,
  saveEntry,
  deleteEntry,
  ensureFolder,
  getDiaryFileMeta,
  DriveError,
} from '../../../_shared/drive'
import type { DiaryEntry } from '../../../_shared/drive'

const MAX_ENTRY_CONTENT_LENGTH = 500_000
const MAX_ENTRY_BODY_BYTES = 1_000_000

export const onRequestGet: PagesFunction<Env, 'date', Data> = async (context) => {
  const { accessToken, sessionId, session } = context.data
  const date = context.params.date as string

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonResponse({ error: 'Invalid date' }, 400)

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const fileIdParam = new URL(context.request.url).searchParams.get('fileId')
    const trustedFileId = fileIdParam && /^[a-zA-Z0-9_-]{10,60}$/.test(fileIdParam) ? fileIdParam : null

    let meta = null
    if (trustedFileId) {
      try { meta = await getDiaryFileMeta(accessToken, sessionId, session, context.env, trustedFileId, date) } catch (e) {
        if (e instanceof DriveError && e.status === 404) return jsonResponse({ error: 'not_found' }, 404)
        throw e
      }
    } else {
      meta = await findEntryMeta(accessToken, sessionId, session, context.env, date)
    }
    if (!meta) return jsonResponse({ error: 'not_found' }, 404)

    const ifNoneMatch = context.request.headers.get('If-None-Match')
    if (ifNoneMatch && meta.version && ifNoneMatch === meta.version) {
      return new Response(null, { status: 304 })
    }

    const entry = await getEntryContent(accessToken, meta.id)
    return jsonResponse({ entry, meta }, 200, meta.version ? { ETag: meta.version } : undefined)
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

  const contentLength = context.request.headers.get('Content-Length')
  if (contentLength && Number(contentLength) > MAX_ENTRY_BODY_BYTES) {
    return jsonResponse({ error: 'Entry is too large' }, 413)
  }

  let body: { content: string; fileId?: string }
  try {
    body = await context.request.json() as { content: string; fileId?: string }
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  if (typeof body.content !== 'string') return jsonResponse({ error: 'content is required' }, 400)
  if (body.content.length > MAX_ENTRY_CONTENT_LENGTH) return jsonResponse({ error: 'Entry is too large' }, 413)

  if (!session) return jsonResponse({ error: 'Unauthorized' }, 401)

  try {
    const entry: DiaryEntry = { date, content: body.content, updated_at: new Date().toISOString() }
    const folderId = await ensureFolder(accessToken, sessionId, session, context.env)
    let fileId: string | undefined
    if (body.fileId) {
      if (!/^[a-zA-Z0-9_-]{10,200}$/.test(body.fileId)) return jsonResponse({ error: 'Invalid file ID' }, 400)
      const meta = await getDiaryFileMeta(accessToken, sessionId, session, context.env, body.fileId, date)
      fileId = meta.id
    } else {
      fileId = (await findEntryMeta(accessToken, sessionId, session, context.env, date))?.id
    }
    const savedMeta = await saveEntry(accessToken, entry, folderId, fileId)
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
