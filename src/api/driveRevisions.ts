import type { DriveRevisionMeta, DiaryEntry } from '../types'
import { withRetry, headers, TokenExpiredError, DriveHttpError } from './driveEntries'

export type { TokenExpiredError, DriveHttpError }

const BASE = 'https://www.googleapis.com/drive/v3'

export async function listRevisions(token: string, fileId: string): Promise<DriveRevisionMeta[]> {
  const fields = encodeURIComponent('revisions(id,modifiedTime,size)')
  const revisions = await withRetry(() => {
    const p = fetch(`${BASE}/files/${fileId}/revisions?fields=${fields}`, { headers: headers(token) })
    return p.then(res => ({ res, parse: () => res.json() as Promise<{ revisions: DriveRevisionMeta[] }> }))
  })
  return (revisions.revisions ?? []).slice().reverse()
}

export async function getRevisionContent(token: string, fileId: string, revisionId: string): Promise<DiaryEntry> {
  return withRetry(() => {
    const p = fetch(`${BASE}/files/${fileId}/revisions/${revisionId}?alt=media`, { headers: headers(token) })
    return p.then(res => ({ res, parse: () => res.json() as Promise<DiaryEntry> }))
  })
}
