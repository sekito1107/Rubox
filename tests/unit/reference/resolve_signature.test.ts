import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResolveSignature } from '../../../src/reference/resolve_signature'

describe('ResolveSignature', () => {
  let resolver: ResolveSignature
  let mockClient: any

  beforeEach(() => {
    mockClient = {
      sendRequest: vi.fn()
    }
    resolver = new ResolveSignature(mockClient)
  })

  describe('resolve', () => {
    it('Ruby VM からの解決結果を正しく返却すること', async () => {
      mockClient.sendRequest.mockResolvedValue({
        signature: 'Kernel#puts',
        className: 'Kernel',
        methodName: 'puts',
        separator: '#'
      })

      const result = await resolver.resolve('Kernel', 'puts')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Kernel#puts')
      expect(result!.className).toBe('Kernel')
      expect(result!.separator).toBe('#')
      expect(result!.url).toContain('Kernel/m/puts.html')
    })

    it('Kernelモジュールの特異メソッドの場合、URLをモジュール関数(/m/)に書き換えること', async () => {
      mockClient.sendRequest.mockResolvedValue({
        signature: 'Kernel.puts',
        className: 'Kernel',
        methodName: 'puts',
        separator: '.'
      })
      const result = await resolver.resolve('Kernel', 'puts')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Kernel.puts')
      expect(result!.url).toContain('/m/puts.html')
    })

    it('Ruby VM が解決できなかった場合に null を返すこと', async () => {
      mockClient.sendRequest.mockResolvedValue(null)
      const result = await resolver.resolve('Unknown', 'method')
      expect(result).toBeNull()
    })

    it('コマンド実行中にエラーが発生した場合にエラーをログ出力して null を返すこと', async () => {
      const consoleSpacer = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockClient.sendRequest.mockRejectedValue(new Error('LSP Error'))
      
      const result = await resolver.resolve('Object', 'nil?')
      
      expect(result).toBeNull()
      expect(consoleSpacer).toHaveBeenCalled()
      consoleSpacer.mockRestore()
    })
  })
})
