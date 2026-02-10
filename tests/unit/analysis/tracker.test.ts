import { describe, it, expect, beforeEach } from 'vitest'
import { Tracker } from '../../../src/analysis/tracker'

describe('Tracker', () => {
  let tracker: Tracker

  beforeEach(() => {
    tracker = new Tracker()
  })

  describe('processChangeEvent', () => {
    it('行が単純に更新（置換）された場合、その行を dirty にすること', () => {
      const lineMethods = [null, null, null]
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 2 },
          text: 'new content'
        }]
      }
      
      tracker.processChangeEvent(event, lineMethods)
      
      expect(Array.from(tracker.getDirtyLines())).toContain(1) // 0-indexed
      expect(lineMethods.length).toBe(3) // 行数は変わらない
    })

    it('行が追加された場合、以降のキャッシュをずらし、新しい行を dirty にすること', () => {
      const lineMethods = ['m1', 'm2', 'm3']
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 2 },
          text: 'line2\nline3' // 1行が2行になる（1行追加）
        }]
      }
      
      tracker.processChangeEvent(event, lineMethods)
      
      // Tracker.js line 26: lineMethods.splice(startLine + 1, 0, ...new Array(diff).fill(null))
      // startLine = 1, diff = 1 -> splice(2, 0, null)
      expect(lineMethods).toEqual(['m1', 'm2', null, 'm3'])
      expect(Array.from(tracker.getDirtyLines())).toContain(1)
      expect(Array.from(tracker.getDirtyLines())).toContain(2)
    })

    it('行が削除された場合、キャッシュを詰め、現在の行を dirty にすること', () => {
      const lineMethods = ['m1', 'm2', 'm3', 'm4']
      const event = {
        changes: [{
          range: { startLineNumber: 2, endLineNumber: 3 }, // 2行目から3行目までを置換
          text: 'shrunk' // 2行が1行になる（1行削除）
        }]
      }
      
      tracker.processChangeEvent(event, lineMethods)
      
      // Tracker.js line 29: lineMethods.splice(startLine + 1, Math.abs(diff))
      // startLine = 1, diff = -1 -> splice(2, 1) を実行
      expect(lineMethods).toEqual(['m1', 'm2', 'm4'])
      expect(Array.from(tracker.getDirtyLines())).toContain(1)
    })
  })

  describe('markAllDirty', () => {
    it('指定された行数分すべての行を dirty にすること', () => {
      tracker.markAllDirty(5)
      const dirty = tracker.getDirtyLines()
      expect(dirty.size).toBe(5)
      expect(Array.from(dirty)).toEqual([0, 1, 2, 3, 4])
    })
  })

  describe('clearDirtyLines', () => {
    it('dirty 状態をリセットできること', () => {
      tracker.markAllDirty(3)
      tracker.clearDirtyLines()
      expect(tracker.getDirtyLines().size).toBe(0)
    })
  })
})
