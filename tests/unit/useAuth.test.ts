import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAuth } from '../../src/hooks/useAuth'

const { mockStartSignIn, mockCheckSession, mockRevokeSession } = vi.hoisted(() => ({
  mockStartSignIn: vi.fn(),
  mockCheckSession: vi.fn().mockResolvedValue(false),
  mockRevokeSession: vi.fn(),
}))

vi.mock('../../src/api/auth', () => ({
  startSignIn: mockStartSignIn,
  checkSession: mockCheckSession,
  revokeSession: mockRevokeSession,
}))

beforeEach(() => {
  mockStartSignIn.mockReset()
  mockCheckSession.mockReset()
  mockCheckSession.mockResolvedValue(false)
  mockRevokeSession.mockReset()
})

describe('useAuth', () => {
  it('initializes with status initializing', () => {
    mockCheckSession.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook(() => useAuth())
    expect(result.current.status).toBe('initializing')
    expect(result.current.authReady).toBe(false)
  })

  it('sets signedIn when checkSession returns true', async () => {
    mockCheckSession.mockResolvedValue(true)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedIn'))
    expect(result.current.authReady).toBe(true)
  })

  it('sets signedOut when checkSession returns false', async () => {
    mockCheckSession.mockResolvedValue(false)

    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))
    expect(result.current.authReady).toBe(true)
  })

  it('signIn calls startSignIn', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    act(() => result.current.signIn())

    expect(mockStartSignIn).toHaveBeenCalledOnce()
  })

  it('signOut calls revokeSession and resets status', async () => {
    mockRevokeSession.mockResolvedValue(undefined)
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    act(() => result.current.signOut())

    expect(mockRevokeSession).toHaveBeenCalledOnce()
    expect(result.current.status).toBe('signedOut')
    expect(result.current.tokenExpired).toBe(false)
  })

  it('signOut does not throw when revokeSession fails', async () => {
    mockRevokeSession.mockRejectedValue(new Error('network error'))
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    act(() => result.current.signOut())

    await waitFor(() => {
      expect(result.current.status).toBe('signedOut')
    })
  })

  it('handleExpired sets tokenExpired to true', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    act(() => result.current.handleExpired())

    expect(result.current.tokenExpired).toBe(true)
  })

  it('retryAfterExpired calls startSignIn', async () => {
    const { result } = renderHook(() => useAuth())
    await waitFor(() => expect(result.current.status).toBe('signedOut'))

    act(() => result.current.retryAfterExpired())

    expect(mockStartSignIn).toHaveBeenCalledOnce()
  })

  it('cancels checkSession on unmount', async () => {
    mockCheckSession.mockImplementation(() => new Promise(() => {}))
    const { result, unmount } = renderHook(() => useAuth())

    unmount()

    expect(result.current.status).toBe('initializing')
  })
})
