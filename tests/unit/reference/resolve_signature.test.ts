import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ResolveSignature } from '../../../src/reference/resolve_signature'

describe('ResolveSignature', () => {
  let resolver: ResolveSignature
  let mockSearcher: any

  beforeEach(() => {
    mockSearcher = {
      findMethod: vi.fn(),
      findMethodsByClass: vi.fn()
    }
    resolver = new ResolveSignature(mockSearcher)
  })

  describe('resolve', () => {
    it('インスタンスメソッド(#)と特異メソッド(.)の両方がある場合、インスタンスメソッドを優先すること', () => {
      // Kernel#puts と Kernel.puts の両方が候補にある場合
      const candidates = ['Kernel.puts', 'Kernel#puts']
      mockSearcher.findMethod.mockReturnValue(candidates)

      const result = resolver.resolve('Kernel', 'puts')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Kernel#puts')
      expect(result!.separator).toBe('#')
    })

    it('インスタンスメソッドのみある場合、それを選択すること', () => {
      mockSearcher.findMethod.mockReturnValue(['String#upcase'])
      const result = resolver.resolve('String', 'upcase')
      expect(result!.signature).toBe('String#upcase')
    })

    it('特異メソッドのみある場合、それを選択すること', () => {
      mockSearcher.findMethod.mockReturnValue(['File.open'])
      const result = resolver.resolve('File', 'open')
      expect(result!.signature).toBe('File.open')
    })
    
    it('Kernelモジュールの特異メソッドの場合、URLをモジュール関数(/m/)に書き換えること', () => {
      // indexには Kernel.puts しかないとする
      mockSearcher.findMethod.mockReturnValue(['Kernel.puts'])
      const result = resolver.resolve('Kernel', 'puts')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Kernel.puts') // シグネチャはそのままでよい
      expect(result!.url).toContain('/m/puts.html') // URLは /m/ になっていること
    })

    it('FileクラスがIOやEnumerableを継承していることを考慮して解決できること', () => {
      // File は IO を継承し、IO は Enumerable をインクルードしている
      // Enumerable#entries を探す場合
      mockSearcher.findMethod.mockReturnValue(['Enumerable#entries'])
      const result = resolver.resolve('File', 'entries')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Enumerable#entries')
    })

    it('TimeクラスがComparableを継承していることを考慮して解決できること', () => {
      // Time は Comparable をインクルードしている
      mockSearcher.findMethod.mockReturnValue(['Comparable#<=>'])
      const result = resolver.resolve('Time', '<=>')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Comparable#<=>')
    })

    it('ネストしたクラス(Net::HTTP)が正しく解決できること', () => {
      // Net::HTTP#get などの解決をシミュレート
      mockSearcher.findMethod.mockReturnValue(['Net::HTTP#get'])
      const result = resolver.resolve('Net::HTTP', 'get')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Net::HTTP#get')
      expect(result!.className).toBe('Net::HTTP')
    })

    it('ネストした例外クラス(Errno::ENOENT)が親クラス(Exception)のメソッドを解決できること', () => {
      // Errno::ENOENT は Exception を継承している (Exception <- StandardError <- SystemCallError <- Errno::ENOENT)
      mockSearcher.findMethod.mockReturnValue(['Exception#message'])
      const result = resolver.resolve('Errno::ENOENT', 'message')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Exception#message')
    })
    it('RangeクラスがEnumerableを継承していることを考慮してsumを解決できること', () => {
      // Range は Enumerable をインクルードしている
      mockSearcher.findMethod.mockReturnValue(['Enumerable#sum'])
      const result = resolver.resolve('Range', 'sum')

      expect(result).not.toBeNull()
      expect(result!.signature).toBe('Enumerable#sum')
    })
  })
})
