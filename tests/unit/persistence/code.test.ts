import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CodePersistence } from '../../../src/persistence/code'

describe('CodePersistence', () => {
  let persistence: CodePersistence
  let localStorageMock: {
    getItem: any
    setItem: any
    removeItem: any
    clear: any
  }

  beforeEach(() => {
    persistence = new CodePersistence()
    
    // localStorage のモック化
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    vi.stubGlobal('localStorage', localStorageMock)
  })

  describe('save', () => {
    it('正常な文字列を保存できること', () => {
      const code = 'puts "hello"'
      persistence.save(code)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(CodePersistence.STORAGE_KEY, code)
    })

    it('undefined または null が渡された場合、保存しないこと', () => {
      persistence.save(null)
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
      
      persistence.save(undefined)
      expect(localStorageMock.setItem).not.toHaveBeenCalled()
    })

    it('空文字列を保存できること', () => {
      persistence.save('')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(CodePersistence.STORAGE_KEY, '')
    })
  })

  describe('load', () => {
    it('保存されている文字列を正しく取得できること', () => {
      const code = 'puts "test"'
      localStorageMock.getItem.mockReturnValue(code)
      
      expect(persistence.load()).toBe(code)
      expect(localStorageMock.getItem).toHaveBeenCalledWith(CodePersistence.STORAGE_KEY)
    })

    it('保存データがない場合、null を返すこと', () => {
      localStorageMock.getItem.mockReturnValue(null)
      expect(persistence.load()).toBeNull()
    })

    it('localStorage アクセス時にエラーが発生した場合、null を返しログを出力すること', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockImplementation(() => {
        throw new Error('Access denied')
      })
      
      expect(persistence.load()).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})
