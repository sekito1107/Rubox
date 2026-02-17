import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Resolution } from '../../../src/analysis/resolution'

describe('Resolution', () => {
  let resolution: Resolution
  let mockLspManager: any
  let mockModel: any

  beforeEach(() => {
    mockModel = {
      getLineContent: vi.fn(),
      getLineCount: vi.fn().mockReturnValue(10),
      getLinesContent: vi.fn().mockReturnValue(new Array(10).fill(''))
    }
    
    mockLspManager = {
      model: mockModel,
      getTypeAtPosition: vi.fn(),
      probeTypeWithTemporaryContent: vi.fn()
    }

    resolution = new Resolution(mockLspManager)
  })

  describe('resolveAtPosition', () => {
    it('LSPが直接型を返せばそれを返す', async () => {
      vi.mocked(mockModel.getLineContent).mockReturnValue('user.name')
      vi.mocked(mockLspManager.getTypeAtPosition).mockResolvedValue('String')

      const result = await resolution.resolveAtPosition(1, 10) // 'name' の位置
      expect(result).toBe('String')
    })

    it('直接解決が失敗しても、少し手前(lookbehind)で解決できればそれを返す', async () => {
      vi.mocked(mockModel.getLineContent).mockReturnValue('user.name')
      // 直撃はnull
      vi.mocked(mockLspManager.getTypeAtPosition)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce('User') // 2回目 (lookbehind) でヒット

      // col 5 (dot) の直後の n (col 6) あたりを想定
      const result = await resolution.resolveAtPosition(1, 6) 
      expect(result).toBe('User')
    })

  })
})
