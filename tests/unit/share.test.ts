import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shareApp, shareEntry } from '../../src/utils/share'

describe('share utils', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { origin: 'https://example.com' })
    vi.stubGlobal('navigator', {})
  })

  describe('shareApp', () => {
    it('calls navigator.share and returns "shared" when Web Share API is available', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { share: mockShare, canShare: () => true })

      const result = await shareApp()

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Grass Puffer Diary',
        text: 'Google Drive で管理するプライベート日記アプリ',
        url: 'https://example.com',
      })
      expect(result).toBe('shared')
    })

    it('falls back to clipboard and returns "copied" when navigator.share is absent', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

      const result = await shareApp()

      expect(mockWriteText).toHaveBeenCalledWith('https://example.com')
      expect(result).toBe('copied')
    })

    it('falls back to clipboard when canShare returns false', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', {
        share: vi.fn(),
        canShare: () => false,
        clipboard: { writeText: mockWriteText },
      })

      const result = await shareApp()

      expect(mockWriteText).toHaveBeenCalledWith('https://example.com')
      expect(result).toBe('copied')
    })
  })

  describe('shareEntry', () => {
    it('calls navigator.share with title and text, returns "shared"', async () => {
      const mockShare = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { share: mockShare, canShare: () => true })

      const result = await shareEntry('2026-05-06', 'Today was great.', 'May 6, 2026')

      expect(mockShare).toHaveBeenCalledWith({
        title: 'Diary – May 6, 2026',
        text: 'Today was great.',
      })
      expect(result).toBe('shared')
    })

    it('copies entry text to clipboard and returns "copied" when Web Share API is absent', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

      const result = await shareEntry('2026-05-06', 'Today was great.', 'May 6, 2026')

      expect(mockWriteText).toHaveBeenCalledWith('Today was great.')
      expect(result).toBe('copied')
    })

    it('handles empty content', async () => {
      const mockWriteText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { clipboard: { writeText: mockWriteText } })

      const result = await shareEntry('2026-05-06', '', 'May 6, 2026')

      expect(mockWriteText).toHaveBeenCalledWith('')
      expect(result).toBe('copied')
    })
  })
})
