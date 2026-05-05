import { renderHook, act } from '@testing-library/react'
import { useFont } from '../../src/hooks/useFont'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-font')
})

test('initializes with stored font from localStorage', () => {
  localStorage.setItem('grass_puffer_font', 'sans')
  const { result } = renderHook(() => useFont())
  expect(result.current.mode).toBe('sans')
  expect(document.documentElement.getAttribute('data-font')).toBe('sans')
})

test('defaults to serif when no stored font', () => {
  localStorage.removeItem('grass_puffer_font')
  const { result } = renderHook(() => useFont())
  expect(result.current.mode).toBe('serif')
  expect(document.documentElement.getAttribute('data-font')).toBe('serif')
})

test('toggleFont switches serif → sans → serif', () => {
  localStorage.removeItem('grass_puffer_font')
  const { result } = renderHook(() => useFont())
  expect(result.current.mode).toBe('serif')

  act(() => result.current.toggleFont())
  expect(result.current.mode).toBe('sans')
  expect(localStorage.getItem('grass_puffer_font')).toBe('sans')

  act(() => result.current.toggleFont())
  expect(result.current.mode).toBe('serif')
  expect(localStorage.getItem('grass_puffer_font')).toBe('serif')
})
