import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Share } from '../../../src/persistence/share'

describe('Share', () => {
  let share: Share

  beforeEach(() => {
    share = new Share()
    // Mock window.location
    vi.stubGlobal('location', {
      href: 'http://localhost:5173/'
    })
    // Mock window.history
    vi.stubGlobal('history', {
      replaceState: vi.fn()
    })
  })

  describe('compress', () => {
    it('Rubyコードを圧縮・エンコードし、正しくURLを生成すること', () => {
      const code = 'puts "hello"'
      const url = share.compress(code)
      
      expect(url).toContain('http://localhost:5173/#code=')
      // URL-safe Base64 check (no +, /, or = in the payload)
      const hash = new URL(url).hash
      const payload = hash.split('=')[1]
      expect(payload).not.toMatch(/[+/=]/)
    })

    it('日本語を含むコードを正しく処理できること', () => {
      const code = 'puts "こんにちは"'
      const url = share.compress(code)
      const hash = url.split('#code=')[1]
      
      const recovered = share.decompress(hash)
      expect(recovered).toBe(code)
    })
  })

  describe('decompress', () => {
    it('正しいハッシュからコードを復元できること', () => {
      const code = 'x = 10\nputs x'
      const url = share.compress(code)
      const hash = url.split('#code=')[1]
      
      const recovered = share.decompress(hash)
      expect(recovered).toBe(code)
    })

    it('#code= 接頭辞があっても復元できること', () => {
      const code = 'test'
      const url = share.compress(code)
      const fullHash = new URL(url).hash
      
      const recovered = share.decompress(fullHash)
      expect(recovered).toBe(code)
    })

    it('不正なデータに対して null を返すこと', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(share.decompress('invalid-base64-!!!')).toBeNull()
      consoleSpy.mockRestore()
    })

    it('空のハッシュに対して null を返すこと', () => {
      expect(share.decompress('')).toBeNull()
    })
  })

  describe('可逆性', () => {
    it('compress して decompress したら元のコードに戻ること', () => {
      const complexCode = 'def hello(name)\n  "Hello, #{name}!"\nend\n\nputs hello("Rubbit")'
      const url = share.compress(complexCode)
      const hash = new URL(url).hash
      
      expect(share.decompress(hash)).toBe(complexCode)
    })
  })

  describe('generateEmbedTag', () => {
    it('正しい iframe タグを生成すること', () => {
      const code = 'puts "embed"'
      const tag = share.generateEmbedTag(code)
      
      expect(tag).toContain('<iframe')
      expect(tag).toContain('src="http://localhost:5173/embed.html#code=')
      expect(tag).toContain('width="100%"')
    })
  })

  describe('generateCodeBlock', () => {
    it('Rubyのコードブロック形式で生成すること', () => {
      const code = 'puts "hello"'
      const block = share.generateCodeBlock(code)
      
      expect(block).toBe('```ruby\nputs "hello"\n```')
    })
  })
})
