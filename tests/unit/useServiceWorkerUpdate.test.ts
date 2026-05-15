import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useServiceWorkerUpdate } from '../../src/hooks/useServiceWorkerUpdate'

type MockSW = EventTarget & { controller: object | null }

function makeMockSW(hasController: boolean): MockSW {
  const et = new EventTarget()
  return Object.assign(et, { controller: hasController ? {} : null })
}

let originalDEV: boolean
let mockSW: MockSW

beforeEach(() => {
  originalDEV = import.meta.env.DEV
  ;(import.meta.env as Record<string, unknown>).DEV = false

  mockSW = makeMockSW(true)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: mockSW,
  })
})

afterEach(() => {
  ;(import.meta.env as Record<string, unknown>).DEV = originalDEV
  vi.restoreAllMocks()
})

describe('useServiceWorkerUpdate', () => {
  it('returns false initially', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())
    expect(result.current).toBe(false)
  })

  it('returns true when controllerchange fires and a previous controller existed', () => {
    const { result } = renderHook(() => useServiceWorkerUpdate())

    act(() => {
      mockSW.dispatchEvent(new Event('controllerchange'))
    })

    expect(result.current).toBe(true)
  })

  it('stays false when there was no previous controller (first install)', () => {
    const noControllerSW = makeMockSW(false)
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: noControllerSW,
    })

    const { result } = renderHook(() => useServiceWorkerUpdate())

    act(() => {
      noControllerSW.dispatchEvent(new Event('controllerchange'))
    })

    expect(result.current).toBe(false)
  })

  it('stays false when serviceWorker is not available in navigator', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: undefined,
    })
    const { result } = renderHook(() => useServiceWorkerUpdate())
    expect(result.current).toBe(false)
  })

  it('removes the event listener on unmount', () => {
    const removeSpy = vi.spyOn(mockSW, 'removeEventListener')
    const { unmount } = renderHook(() => useServiceWorkerUpdate())

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('controllerchange', expect.any(Function))
  })
})
