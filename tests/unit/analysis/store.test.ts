import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AnalysisStore } from '../../../src/analysis/store'
import type { MethodItem } from '../../../src/analysis/store'

describe('AnalysisStore', () => {
  let store: AnalysisStore

  beforeEach(() => {
    store = new AnalysisStore()
  })

  describe('set & get & getAll', () => {
    it('メソッドデータを保存し、取得できること', () => {
      const data: MethodItem = { name: 'test', line: 1, col: 1, status: 'pending', scanType: 'bare' }
      store.set('test', data)
      
      expect(store.get('test')).toEqual(data)
      expect(store.getAll()).toContainEqual(data)
    })
  })

  describe('keepOnly', () => {
    it('リストに含まれないメソッドを削除し、変更があった場合に true を返すこと', () => {
      store.set('m1', { name: 'm1', line: 1, col: 1, status: 'pending', scanType: 'bare' })
      store.set('m2', { name: 'm2', line: 1, col: 2, status: 'pending', scanType: 'bare' })
      
      const changed = store.keepOnly(new Set(['m1']))
      
      expect(changed).toBe(true)
      expect(store.get('m1')).toBeDefined()
      expect(store.get('m2')).toBeUndefined()
    })

    it('すべてのメソッドがリストに含まれる場合、削除せず false を返すこと', () => {
      store.set('m1', { name: 'm1', line: 1, col: 1, status: 'pending', scanType: 'bare' })
      const changed = store.keepOnly(new Set(['m1']))
      expect(changed).toBe(false)
    })
  })

  describe('notify', () => {
    it('rubox:analysis-updated イベントを正しいペイロードで発火すること', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
      const data: MethodItem = { name: 'm1', line: 1, col: 1, status: 'resolved', scanType: 'bare' }
      store.set('m1', data)
      store.setFirstScanDone(true)
      
      store.notify()
      
      expect(dispatchSpy).toHaveBeenCalled()
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent
      expect(event.type).toBe('rubox:analysis-updated')
      expect(event.detail.methods).toEqual([data])
      expect(event.detail.firstScanDone).toBe(true)
    })
  })
})
