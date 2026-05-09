import type { Env, Data } from '../../../../_shared/session'
import { jsonResponse } from '../../../../_shared/session'
import { getRevisionContent, DriveError } from '../../../../_shared/drive'

export const onRequestGet: PagesFunction<Env, 'fileId' | 'revisionId', Data> = async (context) => {
  const { accessToken } = context.data
  const fileId = context.params.fileId as string
  const revisionId = context.params.revisionId as string

  try {
    const entry = await getRevisionContent(accessToken, fileId, revisionId)
    return jsonResponse(entry)
  } catch (e) {
    if (e instanceof DriveError) return jsonResponse({ error: e.message }, e.status)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
}
