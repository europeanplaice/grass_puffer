import type { Env, Data } from '../../../_shared/session'
import { jsonResponse } from '../../../_shared/session'
import { listRevisions, DriveError } from '../../../_shared/drive'

export const onRequestGet: PagesFunction<Env, 'fileId', Data> = async (context) => {
  const { accessToken } = context.data
  const fileId = context.params.fileId as string
  if (!/^[a-zA-Z0-9_-]{10,}$/.test(fileId)) return jsonResponse({ error: 'Invalid file ID' }, 400)

  try {
    const revisions = await listRevisions(accessToken, fileId)
    return jsonResponse(revisions)
  } catch (e) {
    if (e instanceof DriveError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}
