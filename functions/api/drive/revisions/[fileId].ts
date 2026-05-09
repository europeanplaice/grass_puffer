import type { Env, Data } from '../../../_shared/session'
import { jsonResponse } from '../../../_shared/session'
import { listRevisions, DriveError } from '../../../_shared/drive'

export const onRequestGet: PagesFunction<Env, 'fileId', Data> = async (context) => {
  const { accessToken } = context.data
  const fileId = context.params.fileId as string

  try {
    const revisions = await listRevisions(accessToken, fileId)
    return jsonResponse(revisions)
  } catch (e) {
    if (e instanceof DriveError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}
