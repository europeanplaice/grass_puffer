import type { DriveRevisionMeta, DiaryEntry } from '../types'
import { apiFetch, TokenExpiredError, DriveHttpError } from './driveEntries'

export type { TokenExpiredError, DriveHttpError }

const BASE = '/api/drive/revisions'

export async function listRevisions(fileId: string): Promise<DriveRevisionMeta[]> {
  const { data } = await apiFetch<DriveRevisionMeta[]>(`${BASE}/${fileId}`)
  return data ?? []
}

export async function getRevisionContent(fileId: string, revisionId: string): Promise<DiaryEntry> {
  const { data, status } = await apiFetch<DiaryEntry>(`${BASE}/${fileId}/${revisionId}`)
  if (status === 404 || !data) throw new DriveHttpError(404, 'Not found')
  return data
}
