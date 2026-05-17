import { renderHook, act } from '@testing-library/react'
import { useFontSize } from '../../src/hooks/useFontSize'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.style.removeProperty('--editor-font-size')
})

test('defaults to md when no stored value', () => {
  const { result } = renderHook(() => useFontSize())
  expect(result.current.fontSize).toBe('md')
  expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('1.05rem')
})

test('initializes from stored value in localStorage', () => {
  localStorage.setItem('linger_fontsize', 'lg')
  const { result } = renderHook(() => useFontSize())
  expect(result.current.fontSize).toBe('lg')
  expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('1.2rem')
})

test('ignores invalid stored value and defaults to md', () => {
  localStorage.setItem('linger_fontsize', 'invalid')
  const { result } = renderHook(() => useFontSize())
  expect(result.current.fontSize).toBe('md')
})

test('setFontSize updates state, localStorage, and CSS variable', () => {
  const { result } = renderHook(() => useFontSize())

  act(() => result.current.setFontSize('xl'))
  expect(result.current.fontSize).toBe('xl')
  expect(localStorage.getItem('linger_fontsize')).toBe('xl')
  expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe('1.35rem')
})

test('all four sizes apply correct CSS values', () => {
  const { result } = renderHook(() => useFontSize())
  const expected: Record<string, string> = {
    sm: '0.9rem',
    md: '1.05rem',
    lg: '1.2rem',
    xl: '1.35rem',
  }
  for (const [size, value] of Object.entries(expected)) {
    act(() => result.current.setFontSize(size as 'sm' | 'md' | 'lg' | 'xl'))
    expect(document.documentElement.style.getPropertyValue('--editor-font-size')).toBe(value)
  }
})
