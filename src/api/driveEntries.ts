import type { DiaryEntry, DriveFileMeta, LoadedDiaryEntry } from '../types'

const BASE = '/api/drive'

export class TokenExpiredError extends Error {
  constructor() {
    super('Session expired')
    this.name = 'TokenExpiredError'
  }
}

export class DriveHttpError extends Error {
  status: number
  constructor(status: number, body: string) {
    super(`API ${status}: ${body}`)
    this.name = 'DriveHttpError'
    this.status = status
  }
}

function shouldRetry(status: number): boolean {
  return status === 429 || status >= 500
}

function retryDelay(attempt: number): number {
  switch (attempt) {
    case 0:
      return 250
    case 1:
      return 500
    default:
      return 1000
  }
}

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<{ data: T; status: number }> {
  const delays = [250, 500, 1000]
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' })

    if (res.ok) return { data: await res.json() as T, status: res.status }
    if (res.status === 401) throw new TokenExpiredError()
    if (res.status === 404) return { data: null as T, status: 404 }

    const body = await res.text()
    if (shouldRetry(res.status) && attempt < delays.length) {
      let delay = retryDelay(attempt)
      const ra = res.headers.get('Retry-After')
      if (ra) { const s = parseFloat(ra); if (!isNaN(s)) delay = s * 1000 }
      await new Promise(r => setTimeout(r, delay * (1 + 0.2 * (Math.random() * 2 - 1))))
      continue
    }
    throw new DriveHttpError(res.status, body)
  }
}

async function apiFetchNoContent(url: string, init?: RequestInit): Promise<void> {
  const delays = [250, 500, 1000]
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, credentials: 'include', cache: 'no-store' })

    if (res.ok || res.status === 204) return
    if (res.status === 401) throw new TokenExpiredError()

    const body = await res.text()
    if (shouldRetry(res.status) && attempt < delays.length) {
      let delay = retryDelay(attempt)
      const ra = res.headers.get('Retry-After')
      if (ra) { const s = parseFloat(ra); if (!isNaN(s)) delay = s * 1000 }
      await new Promise(r => setTimeout(r, delay * (1 + 0.2 * (Math.random() * 2 - 1))))
      continue
    }
    throw new DriveHttpError(res.status, body)
  }
}

export async function listEntries(): Promise<DriveFileMeta[]> {
  const { data } = await apiFetch<{ files: DriveFileMeta[] }>(`${BASE}/entries`)
  return data?.files ?? []
}

export async function searchEntries(query: string): Promise<DriveFileMeta[]> {
  const { data } = await apiFetch<{ files: DriveFileMeta[] }>(`${BASE}/search?q=${encodeURIComponent(query)}`)
  return data?.files ?? []
}

export async function getEntryByDate(date: string): Promise<LoadedDiaryEntry | null> {
  const { data, status } = await apiFetch<{ entry: DiaryEntry; meta: DriveFileMeta }>(`${BASE}/entry/${encodeURIComponent(date)}`)
  if (status === 404 || !data) return null
  return { entry: data.entry, meta: data.meta }
}

export async function saveEntry(date: string, entry: DiaryEntry, fileId?: string): Promise<DriveFileMeta> {
  const { data } = await apiFetch<DriveFileMeta>(`${BASE}/entry/${encodeURIComponent(date)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: entry.content, fileId }),
  })
  return data
}

export async function deleteEntry(date: string): Promise<void> {
  await apiFetchNoContent(`${BASE}/entry/${encodeURIComponent(date)}`, { method: 'DELETE' })
}
