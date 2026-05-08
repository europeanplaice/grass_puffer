import { describe, expect, it } from 'vitest'
import { jsonResponse } from '../../functions/_shared/session'

describe('jsonResponse', () => {
  it('marks JSON responses as non-cacheable', () => {
    const response = jsonResponse({ ok: true })

    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
