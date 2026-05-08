import type { DriveRevisionMeta, DiaryEntry } from '../types'
import { TokenExpiredError, DriveHttpError } from './driveEntries'

export type { TokenExpiredError, DriveHttpError }

const BASE = '/api/drive/revisions'

type RevisionsResponse = DriveRevisionMeta[] | { revisions?: DriveRevisionMeta[] }

async function revisionsFetch<T>(url: string): Promise<T> {
  const delays = [250, 500, 1000]
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { credentials: 'include' })

    if (res.ok) return res.json() as Promise<T>
    if (res.status === 401) throw new TokenExpiredError()

    const body = await res.text()
    if ((res.status === 429 || res.status >= 500) && attempt < delays.length) {
      let delay = delays[attempt]
      const ra = res.headers.get('Retry-After')
      if (ra) { const s = parseFloat(ra); if (!isNaN(s)) delay = s * 1000 }
      await new Promise(r => setTimeout(r, delay * (1 + 0.2 * (Math.random() * 2 - 1))))
      continue
    }
    throw new DriveHttpError(res.status, body)
  }
}

export async function listRevisions(fileId: string): Promise<DriveRevisionMeta[]> {
  const data = await revisionsFetch<RevisionsResponse>(`${BASE}/${fileId}`)
  return Array.isArray(data) ? data : data.revisions ?? []
}

export async function getRevisionContent(fileId: string, revisionId: string): Promise<DiaryEntry> {
  return revisionsFetch<DiaryEntry>(`${BASE}/${fileId}/${revisionId}`)
}
