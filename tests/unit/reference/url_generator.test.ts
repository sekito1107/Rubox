import { describe, it, expect } from 'vitest'
import { URLGenerator } from '../../../src/reference/url_generator'

describe('URLGenerator', () => {
  describe('generateUrlInfoFromComponents', () => {
    it('generates correct URL for instance method', () => {
      const info = URLGenerator.generateUrlInfoFromComponents('String', 'gsub', '#')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/String/i/gsub.html')
      expect(info.className).toBe('String')
      expect(info.methodName).toBe('gsub')
      expect(info.separator).toBe('#')
    })

    it('generates correct URL for class method', () => {
      const info = URLGenerator.generateUrlInfoFromComponents('File', 'open', '.')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/File/s/open.html')
      expect(info.className).toBe('File')
      expect(info.methodName).toBe('open')
      expect(info.separator).toBe('.')
    })

    it('encodes special characters in method name', () => {
      const info = URLGenerator.generateUrlInfoFromComponents('Array', '[]', '#')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/Array/i/=5b=5d.html')
    })
  })

  describe('generateUrlInfo', () => {
    it('generates correct URL from simple signature', () => {
      const info = URLGenerator.generateUrlInfo('String#length')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/String/i/length.html')
    })

    it('strips arguments from signature', () => {
      const info = URLGenerator.generateUrlInfo('String#gsub(pattern, replacement)')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/String/i/gsub.html')
      expect(info.methodName).toBe('gsub')
    })

    it('handles signature with class method and arguments', () => {
      const info = URLGenerator.generateUrlInfo('File.open(path, mode)')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/File/s/open.html')
      expect(info.methodName).toBe('open')
    })
    
     it('handles signature with spaces', () => {
      const info = URLGenerator.generateUrlInfo('String#gsub (pattern, replacement)')
      expect(info.url).toBe('https://docs.ruby-lang.org/ja/latest/method/String/i/gsub.html')
      expect(info.methodName).toBe('gsub')
    })
  })
})
