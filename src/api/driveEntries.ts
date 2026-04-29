import type { DiaryEntry, DriveFileMeta } from '../types'

const FOLDER_NAME = 'GrassPuffer Diary'
const BASE = 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

let cachedFolderId: string | null = null

export class TokenExpiredError extends Error {
  constructor() {
    super('Access token expired')
    this.name = 'TokenExpiredError'
  }
}

function headers(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

async function driveJson<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...headers(token), ...((init?.headers as Record<string, string>) ?? {}) } })
  if (res.status === 401) throw new TokenExpiredError()
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

export async function ensureFolder(token: string): Promise<string> {
  if (cachedFolderId) return cachedFolderId

  const q = encodeURIComponent(`mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`)
  const list = await driveJson<{ files: DriveFileMeta[] }>(token, `${BASE}/files?q=${q}&fields=files(id,name)`)

  if (list.files.length > 0) {
    cachedFolderId = list.files[0].id
    return cachedFolderId
  }

  const created = await driveJson<DriveFileMeta>(token, `${BASE}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  })
  cachedFolderId = created.id
  return cachedFolderId
}

export async function listEntries(token: string, folderId: string): Promise<DriveFileMeta[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/json'`)
  const fields = encodeURIComponent('files(id,name,modifiedTime,version)')
  const res = await driveJson<{ files: DriveFileMeta[] }>(token, `${BASE}/files?q=${q}&fields=${fields}&pageSize=1000`)
  return res.files
}

export async function findEntryMeta(token: string, folderId: string, date: string): Promise<DriveFileMeta | null> {
  const filename = `diary-${date}.json`.replace(/'/g, "\\'")
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and name='${filename}'`)
  const fields = encodeURIComponent('files(id,name,modifiedTime,version)')
  const res = await driveJson<{ files: DriveFileMeta[] }>(token, `${BASE}/files?q=${q}&fields=${fields}&pageSize=1`)
  return res.files[0] ?? null
}

export async function getEntryMeta(token: string, fileId: string): Promise<DriveFileMeta> {
  const fields = encodeURIComponent('id,name,modifiedTime,version')
  return driveJson<DriveFileMeta>(token, `${BASE}/files/${fileId}?fields=${fields}`)
}

export async function getEntry(token: string, fileId: string): Promise<DiaryEntry> {
  const res = await fetch(`${BASE}/files/${fileId}?alt=media`, { headers: headers(token) })
  if (res.status === 401) throw new TokenExpiredError()
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`)
  return res.json() as Promise<DiaryEntry>
}

function buildMultipart(meta: object, body: string): { contentType: string; data: string } {
  const boundary = 'grass_puffer_boundary'
  const data = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(meta),
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    body,
    `--${boundary}--`,
  ].join('\r\n')
  return { contentType: `multipart/related; boundary=${boundary}`, data }
}

export async function saveEntry(
  token: string,
  entry: DiaryEntry,
  folderId: string,
  fileId?: string,
): Promise<DriveFileMeta> {
  const filename = `diary-${entry.date}.json`
  const body = JSON.stringify(entry)

  if (fileId) {
    const { contentType, data } = buildMultipart({}, body)
    const fields = encodeURIComponent('id,name,modifiedTime,version')
    return driveJson<DriveFileMeta>(token, `${UPLOAD_BASE}/files/${fileId}?uploadType=multipart&fields=${fields}`, {
      method: 'PATCH',
      headers: { 'Content-Type': contentType },
      body: data,
    })
  }

  const { contentType, data } = buildMultipart({ name: filename, parents: [folderId] }, body)
  const fields = encodeURIComponent('id,name,modifiedTime,version')
  return driveJson<DriveFileMeta>(token, `${UPLOAD_BASE}/files?uploadType=multipart&fields=${fields}`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: data,
  })
}

export async function deleteEntry(token: string, fileId: string): Promise<void> {
  const res = await fetch(`${BASE}/files/${fileId}`, { method: 'DELETE', headers: headers(token) })
  if (res.status === 401) throw new TokenExpiredError()
  if (!res.ok && res.status !== 204) throw new Error(`Drive API ${res.status}: ${await res.text()}`)
}

export function clearFolderCache(): void {
  cachedFolderId = null
}
