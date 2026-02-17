import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Resolver } from '../../../src/analysis/resolver'

describe('Resolver', () => {
  let resolver: Resolver
  let mockLspManager: any
  let mockRurima: any

  beforeEach(() => {
    mockLspManager = {}
    mockRurima = {
      resolve: vi.fn()
    }
    resolver = new Resolver(mockLspManager, mockRurima)
    
    // 内部の Resolution インスタンスをモック化
    vi.spyOn(resolver.resolution, 'resolveMethodAt').mockImplementation(vi.fn())
    vi.spyOn(resolver.resolution, 'resolveAtPosition').mockImplementation(vi.fn())
  })

  describe('resolve', () => {
    it('LSP でメソッドが直接解決された場合、Rurima 情報を返すこと', async () => {
      const resolution = resolver.resolution
      vi.mocked(resolution.resolveMethodAt).mockResolvedValue('Array')
      mockRurima.resolve.mockResolvedValue({
        className: 'Array',
        url: 'https://docs.ruby-lang.org/ja/latest/class/Array.html#I_PUSH',
        separator: '#'
      })

      const result = await resolver.resolve('push', 10, 5)

      expect(result.status).toBe('resolved')
      expect(result.className).toBe('Array')
      expect(result.url).toContain('Array.html#I_PUSH')
      expect(resolution.resolveMethodAt).toHaveBeenCalledWith(10, 5)
    })

    it('直接の解決が失敗した場合、レシーバ（ドットの左）の解決を試みること（フォールバック）', async () => {
      const resolution = resolver.resolution
      vi.mocked(resolution.resolveMethodAt).mockResolvedValue(null)
      vi.mocked(resolution.resolveAtPosition).mockResolvedValue('String') // レシーバが String

      mockRurima.resolve.mockResolvedValue({
        className: 'String',
        url: 'url...',
        separator: '#'
      })

      const result = await resolver.resolve('upcase', 10, 10)

      expect(resolution.resolveAtPosition).toHaveBeenCalledWith(10, 9)
      expect(result.status).toBe('resolved')
      expect(result.className).toBe('String')
    })

    it('LSP でクラス名は特定できたが、Rurima に該当がない場合は unknown を返すこと', async () => {
      const resolution = resolver.resolution
      vi.mocked(resolution.resolveMethodAt).mockResolvedValue('UnknownClass')
      mockRurima.resolve.mockResolvedValue(null)

      const result = await resolver.resolve('missing_method', 1, 1)

      expect(result.status).toBe('unknown')
    })

    it('エラーが発生した場合、例外をそのままスローすること', async () => {
      const resolution = resolver.resolution
      vi.mocked(resolution.resolveMethodAt).mockRejectedValue(new Error('LSP Error'))

      await expect(resolver.resolve('error_method', 1, 1)).rejects.toThrow('LSP Error')
    })

  })
})
