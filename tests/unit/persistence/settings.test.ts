import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Settings } from '../../../src/persistence/settings'

describe('Settings', () => {
  let settings: Settings
  let localStorageMock: {
    getItem: any
    setItem: any
    removeItem: any
    clear: any
  }

  beforeEach(() => {
    localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    }
    vi.stubGlobal('localStorage', localStorageMock)
  })

  describe('初期化 (constructor)', () => {
    it('localStorage から既存の設定を読み込むこと', () => {
      const storedData = { fontSize: 16 }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedData))
      
      settings = new Settings()
      expect(settings.getAll()).toEqual(storedData)
    })

    it('localStorage が空の場合、空オブジェクトで初期化されること', () => {
      localStorageMock.getItem.mockReturnValue(null)
      settings = new Settings()
      expect(settings.getAll()).toEqual({})
    })

    it('JSONが破損している場合、空オブジェクトとして復元し警告を出すこと', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      localStorageMock.getItem.mockReturnValue('invalid-json')
      
      settings = new Settings()
      expect(settings.getAll()).toEqual({})
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('update', () => {
    it('特定のキーを更新し、localStorage に保存すること', () => {
      localStorageMock.getItem.mockReturnValue(null)
      settings = new Settings()
      
      settings.update('theme', 'dark')
      expect(settings.getAll().theme).toBe('dark')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        Settings.STORAGE_KEY,
        JSON.stringify({ theme: 'dark' })
      )
    })

    it('既存のキーを保持したまま新しいキーを追加できること', () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ existing: 'value' }))
      settings = new Settings()
      
      settings.update('newKey', 123)
      expect(settings.getAll()).toEqual({ existing: 'value', newKey: 123 })
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        Settings.STORAGE_KEY,
        JSON.stringify({ existing: 'value', newKey: 123 })
      )
    })
  })
})
