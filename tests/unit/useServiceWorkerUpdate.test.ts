import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useServiceWorkerUpdate } from '../../src/hooks/useServiceWorkerUpdate'

class MockServiceWorker extends EventTarget {
  state = 'installing'
  postMessage = vi.fn()
}

class MockRegistration extends EventTarget {
  waiting: MockServiceWorker | null = null
  installing: MockServiceWorker | null = null
  update = vi.fn()
}

function makeMockContainer(reg: MockRegistration, hasController = true) {
  const et = new EventTarget()
  return Object.assign(et, {
    controller: hasController ? {} : null,
    ready: Promise.resolve(reg),
  })
}

let originalDEV: boolean

beforeEach(() => {
  originalDEV = import.meta.env.DEV
  ;(import.meta.env as Record<string, unknown>).DEV = false
})

afterEach(() => {
  ;(import.meta.env as Record<string, unknown>).DEV = originalDEV
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useServiceWorkerUpdate', () => {
  describe('updateAvailable', () => {
    it('is false before sw.ready resolves', () => {
      const reg = new MockRegistration()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      expect(result.current.updateAvailable).toBe(false)
    })

    it('becomes true when reg.waiting is already set on startup', async () => {
      const reg = new MockRegistration()
      reg.waiting = new MockServiceWorker()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})
      expect(result.current.updateAvailable).toBe(true)
    })

    it('becomes true when a new SW reaches installed state and a controller exists', async () => {
      const reg = new MockRegistration()
      const installing = new MockServiceWorker()
      const container = makeMockContainer(reg, true)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      act(() => {
        reg.installing = installing
        reg.dispatchEvent(new Event('updatefound'))
      })
      act(() => {
        installing.state = 'installed'
        installing.dispatchEvent(new Event('statechange'))
      })

      expect(result.current.updateAvailable).toBe(true)
    })

    it('stays false on first install when no existing controller', async () => {
      const reg = new MockRegistration()
      const installing = new MockServiceWorker()
      const container = makeMockContainer(reg, false)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      act(() => {
        reg.installing = installing
        reg.dispatchEvent(new Event('updatefound'))
      })
      act(() => {
        installing.state = 'installed'
        installing.dispatchEvent(new Event('statechange'))
      })

      expect(result.current.updateAvailable).toBe(false)
    })

    it('detects a subsequent update even when reg.waiting was already set on startup', async () => {
      const reg = new MockRegistration()
      reg.waiting = new MockServiceWorker()
      const container = makeMockContainer(reg, true)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})
      expect(result.current.updateAvailable).toBe(true)

      // A second update arrives via updatefound — should still be caught
      const installing2 = new MockServiceWorker()
      act(() => {
        reg.installing = installing2
        reg.dispatchEvent(new Event('updatefound'))
      })
      act(() => {
        installing2.state = 'installed'
        installing2.dispatchEvent(new Event('statechange'))
      })
      expect(result.current.updateAvailable).toBe(true)
    })

    it('stays false when serviceWorker is unavailable', () => {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: undefined,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      expect(result.current.updateAvailable).toBe(false)
    })
  })

  describe('visibilitychange', () => {
    it('calls reg.update() when the tab becomes visible', async () => {
      const reg = new MockRegistration()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })

      expect(reg.update).toHaveBeenCalledTimes(1)
    })

    it('does not call reg.update() when the tab becomes hidden', async () => {
      const reg = new MockRegistration()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })

      expect(reg.update).not.toHaveBeenCalled()
    })

    it('removes the visibilitychange listener on unmount', async () => {
      const reg = new MockRegistration()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      const { unmount } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})
      unmount()

      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
      act(() => { document.dispatchEvent(new Event('visibilitychange')) })

      expect(reg.update).not.toHaveBeenCalled()
    })
  })

  describe('applyUpdate', () => {
    beforeEach(() => {
      vi.stubGlobal('location', { reload: vi.fn() })
    })

    it('posts SKIP_WAITING to the waiting SW, then reloads on controllerchange', async () => {
      const reg = new MockRegistration()
      const waiting = new MockServiceWorker()
      reg.waiting = waiting
      const container = makeMockContainer(reg)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      act(() => { result.current.applyUpdate() })
      expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING')
      expect(window.location.reload).not.toHaveBeenCalled()

      act(() => { container.dispatchEvent(new Event('controllerchange')) })
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('reloads only once even if controllerchange fires multiple times', async () => {
      const reg = new MockRegistration()
      reg.waiting = new MockServiceWorker()
      const container = makeMockContainer(reg)
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: container,
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      act(() => {
        result.current.applyUpdate()
        container.dispatchEvent(new Event('controllerchange'))
        container.dispatchEvent(new Event('controllerchange'))
      })
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })

    it('reloads immediately when no waiting SW', async () => {
      const reg = new MockRegistration()
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: makeMockContainer(reg),
      })
      const { result } = renderHook(() => useServiceWorkerUpdate())
      await act(async () => {})

      act(() => { result.current.applyUpdate() })
      expect(window.location.reload).toHaveBeenCalledTimes(1)
    })
  })
})
