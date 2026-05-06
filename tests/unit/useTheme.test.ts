import { renderHook, act } from '@testing-library/react'
import { useTheme } from '../../src/hooks/useTheme'

function mockSystemTheme(theme: 'light' | 'dark') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: theme === 'dark' && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  })
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

test('initializes with stored theme from localStorage', () => {
  mockSystemTheme('light')
  localStorage.setItem('grass_puffer_theme', 'dark')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('dark')
  expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
})

test('defaults to system when no stored theme', () => {
  mockSystemTheme('light')
  localStorage.removeItem('grass_puffer_theme')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('system')
})

test('toggleTheme cycles dark → light → dark', () => {
  mockSystemTheme('light')
  localStorage.setItem('grass_puffer_theme', 'dark')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('dark')

  act(() => result.current.toggleTheme())
  expect(result.current.mode).toBe('light')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('light')

  act(() => result.current.toggleTheme())
  expect(result.current.mode).toBe('dark')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('dark')
})

test('effectiveTheme returns system preference when mode is system', () => {
  mockSystemTheme('dark')
  localStorage.removeItem('grass_puffer_theme')
  const { result } = renderHook(() => useTheme())
  expect(result.current.effectiveTheme).toBe('dark')
})

test('setMode changes mode to dark and persists to localStorage', () => {
  mockSystemTheme('light')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('system')

  act(() => result.current.setMode('dark'))
  expect(result.current.mode).toBe('dark')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('dark')
})

test('setMode changes mode to system and persists to localStorage', () => {
  mockSystemTheme('light')
  localStorage.setItem('grass_puffer_theme', 'dark')
  const { result } = renderHook(() => useTheme())

  act(() => result.current.setMode('system'))
  expect(result.current.mode).toBe('system')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('system')
})

test('readStoredTheme reads system from localStorage', () => {
  mockSystemTheme('light')
  localStorage.setItem('grass_puffer_theme', 'system')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('system')
})

test('toggleTheme from system mode (dark effective) switches to light', () => {
  mockSystemTheme('dark')
  localStorage.removeItem('grass_puffer_theme')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('system')
  expect(result.current.effectiveTheme).toBe('dark')

  act(() => result.current.toggleTheme())
  expect(result.current.mode).toBe('light')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('light')
})

test('toggleTheme from system mode (light effective) switches to dark', () => {
  mockSystemTheme('light')
  localStorage.removeItem('grass_puffer_theme')
  const { result } = renderHook(() => useTheme())
  expect(result.current.mode).toBe('system')
  expect(result.current.effectiveTheme).toBe('light')

  act(() => result.current.toggleTheme())
  expect(result.current.mode).toBe('dark')
  expect(localStorage.getItem('grass_puffer_theme')).toBe('dark')
})
