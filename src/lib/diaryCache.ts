import type { DiaryEntry, DriveFileMeta } from '../types'

const DB_NAME = 'linger_diary_cache'
const DB_VERSION = 1
const STORE = 'entries'

export interface CachedEntry {
  date: string
  meta: DriveFileMeta
  content?: DiaryEntry
  snippet?: string
}

let _db: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'date' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function getDB(): Promise<IDBDatabase> {
  if (!_db) _db = openDB().catch(e => { _db = null; throw e })
  return _db
}

function idbOp<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function getAllCached(): Promise<CachedEntry[]> {
  const db = await getDB()
  return idbOp(db.transaction(STORE, 'readonly').objectStore(STORE).getAll())
}

export async function putCached(entry: CachedEntry): Promise<void> {
  const db = await getDB()
  await idbOp(db.transaction(STORE, 'readwrite').objectStore(STORE).put(entry))
}

export async function deleteCached(date: string): Promise<void> {
  const db = await getDB()
  await idbOp(db.transaction(STORE, 'readwrite').objectStore(STORE).delete(date))
}

export async function clearCache(): Promise<void> {
  const db = await getDB()
  await idbOp(db.transaction(STORE, 'readwrite').objectStore(STORE).clear())
}
