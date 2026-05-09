import { describe, expect, it, vi } from 'vitest'
import { onRequestGet as onSearch } from '../../functions/api/drive/search'
import { onRequestGet as onListRevisions } from '../../functions/api/drive/revisions/[fileId]'
import { onRequestGet as onGetRevision } from '../../functions/api/drive/revisions/[fileId]/[revisionId]'

vi.mock('../../functions/_shared/drive', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../functions/_shared/drive')>()),
  searchEntries: vi.fn().mockResolvedValue([{ id: 'f1' }]),
  listRevisions: vi.fn().mockResolvedValue([]),
  getRevisionContent: vi.fn().mockResolvedValue({ date: '2026-05-01', content: 'hi', updated_at: '' }),
}))

function makeContext(overrides: Record<string, unknown> = {}) {
  return {
    data: { accessToken: 'tok', sessionId: 'sid', session: {} },
    env: {},
    ...overrides,
  }
}

describe('search handler', () => {
  it('returns empty array for blank query', async () => {
    const ctx = makeContext({ request: new Request('http://localhost/api/drive/search?q=') })
    const res = await onSearch(ctx as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ files: [] })
  })

  it('returns empty array when query exceeds 500 characters', async () => {
    const q = 'a'.repeat(501)
    const ctx = makeContext({ request: new Request(`http://localhost/api/drive/search?q=${q}`) })
    const res = await onSearch(ctx as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ files: [] })
  })

  it('accepts a query of exactly 500 characters', async () => {
    const q = 'a'.repeat(500)
    const ctx = makeContext({ request: new Request(`http://localhost/api/drive/search?q=${q}`) })
    const res = await onSearch(ctx as any)
    expect(res.status).toBe(200)
    const body = await res.json() as { files: unknown[] }
    expect(body.files).toHaveLength(1)
  })
})

describe('list revisions handler', () => {
  it('rejects fileId shorter than 10 characters', async () => {
    const ctx = makeContext({ params: { fileId: 'short' } })
    const res = await onListRevisions(ctx as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid file ID' })
  })

  it('rejects fileId with invalid characters', async () => {
    const ctx = makeContext({ params: { fileId: 'invalid/file/id!!' } })
    const res = await onListRevisions(ctx as any)
    expect(res.status).toBe(400)
  })

  it('accepts a valid fileId', async () => {
    const ctx = makeContext({ params: { fileId: 'validFileId1234567890' } })
    const res = await onListRevisions(ctx as any)
    expect(res.status).toBe(200)
  })
})

describe('get revision content handler', () => {
  it('rejects fileId shorter than 10 characters', async () => {
    const ctx = makeContext({ params: { fileId: 'short', revisionId: 'rev1' } })
    const res = await onGetRevision(ctx as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid file ID' })
  })

  it('rejects revisionId with invalid characters', async () => {
    const ctx = makeContext({ params: { fileId: 'validFileId1234567890', revisionId: 'bad/rev' } })
    const res = await onGetRevision(ctx as any)
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: 'Invalid revision ID' })
  })

  it('accepts valid fileId and revisionId', async () => {
    const ctx = makeContext({ params: { fileId: 'validFileId1234567890', revisionId: 'rev-1' } })
    const res = await onGetRevision(ctx as any)
    expect(res.status).toBe(200)
  })
})
