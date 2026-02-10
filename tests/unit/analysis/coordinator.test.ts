import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AnalysisCoordinator } from '../../../src/analysis'

describe('AnalysisCoordinator', () => {
  let coordinator: AnalysisCoordinator
  let mockEditor: any
  let mockLspManager: any
  let mockRurima: any

  beforeEach(() => {
    vi.useFakeTimers()

    mockEditor = {
      onDidChangeModelContent: vi.fn(),
      getModel: vi.fn().mockReturnValue({
        getLineCount: () => 3,
        getLineContent: (ln: number) => ['line1', 'line2.method()', 'line3'][ln - 1]
      })
    }
    mockLspManager = {
      flushDocumentSync: vi.fn()
    }
    mockRurima = {}
    
    coordinator = new AnalysisCoordinator(mockEditor, mockLspManager, mockRurima)
    
    // 特定の非同期挙動を制御するためにリゾルバーをモック化
    // Organizer/Interactor パターンにおいて、内部の Interactor をモック化して Coordinator の挙動をテストしています。
    vi.spyOn(coordinator.resolver, 'resolve').mockResolvedValue({ status: 'unknown' })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('start', () => {
    it('エディタの変更イベントを購読し、初期スキャンをスケジュールすること', () => {
      coordinator.start()
      expect(mockEditor.onDidChangeModelContent).toHaveBeenCalled()
      
      // 初期スキャン (delay=0) がスケジュールされているはず
      vi.advanceTimersByTime(0)
      expect(mockLspManager.flushDocumentSync).toHaveBeenCalled()
    })
  })

  describe('performAnalysis', () => {
    it(' dirty 行をスキャンし、Store を更新して通知すること', async () => {
      const storeSpy = vi.spyOn(coordinator.store, 'notify')
      
      await coordinator.performAnalysis()
      
      // line2 の 'method' が見つかっているはず
      const methods = coordinator.getAnalysis().methods
      expect(methods).toHaveLength(1)
      expect(methods[0].name).toBe('method')
      expect(storeSpy).toHaveBeenCalled()
    })

    it('不要になったメソッドが Store から削除されること', async () => {
      // 1. 最初は method1 がある状態で解析を実行
      mockEditor.getModel.mockReturnValue({
        getLineCount: () => 1,
        getLineContent: () => 'method1()'
      })
      await coordinator.performAnalysis()
      expect(coordinator.getAnalysis().methods).toHaveLength(1)
      
      // 2. エディタの内容が空になった場合を想定して再解析
      mockEditor.getModel.mockReturnValue({
        getLineCount: () => 1,
        getLineContent: () => ''
      });
      coordinator.tracker.markAllDirty(1) // 変更を明示的に通知
      
      await coordinator.performAnalysis()
      expect(coordinator.getAnalysis().methods).toHaveLength(0)
    })

    it('解析中に再実行要求があった場合、完了後に再実行すること', async () => {
      coordinator.isAnalyzing = true
      
      coordinator.scheduleAnalysis(100)
      vi.advanceTimersByTime(100)
      
      expect(coordinator.needsReanalysis).toBe(true)
    })
  })

  describe('resolveSingleMethod', () => {
    it('未解決のメソッドに対して型解決を試みること', async () => {
      const resolver = coordinator.resolver
      vi.mocked(resolver.resolve).mockResolvedValue({ 
        status: 'resolved', 
        className: 'TestClass', 
        url: 'http://test' 
      })

      const data = { name: 'test', line: 1, col: 1, status: 'pending' as const }
      coordinator.store.set('test', data)

      await coordinator.resolveSingleMethod('test')

      const result = coordinator.store.get('test')!
      expect(result.status).toBe('resolved')
      expect(result.className).toBe('TestClass')
    })
  })
})
