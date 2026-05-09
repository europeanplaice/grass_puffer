import type { DriveRevisionMeta, DiaryEntry } from '../types'
import { apiFetch, TokenExpiredError, DriveHttpError } from './driveEntries'

export type { TokenExpiredError, DriveHttpError }

const BASE = '/api/drive/revisions'

type ListRevisionsResponse = DriveRevisionMeta[] | { revisions?: DriveRevisionMeta[] }

export async function listRevisions(fileId: string): Promise<DriveRevisionMeta[]> {
  const { data } = await apiFetch<ListRevisionsResponse>(`${BASE}/${fileId}`)
  if (Array.isArray(data)) return data
  return data?.revisions ?? []
}

export async function getRevisionContent(fileId: string, revisionId: string): Promise<DiaryEntry> {
  const { data, status } = await apiFetch<DiaryEntry>(`${BASE}/${fileId}/${revisionId}`)
  if (status === 404 || !data) throw new DriveHttpError(404, 'Not found')
  return data
}
