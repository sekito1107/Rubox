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
      flushDocumentSync: vi.fn(),
      clearMeasuredValues: vi.fn()
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
    it('エディタの変更時に LSP の測定値をクリアすること', () => {
      coordinator.start()
      // onDidChangeModelContent のコールバックを取得
      const callback = vi.mocked(mockEditor.onDidChangeModelContent).mock.calls[0][0]
      callback({ changes: [] })
      
      expect(mockLspManager.clearMeasuredValues).toHaveBeenCalled()
    })

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
      
      // Scanner が greedy になったため、line1, line2, method, line3 全てが検出される
      const methods = coordinator.getAnalysis().methods
      expect(methods).toHaveLength(4)
      expect(methods.map(m => m.name)).toEqual(['line1', 'line2', 'method', 'line3'])
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

      const data = { name: 'test', line: 1, col: 1, status: 'pending' as const, scanType: 'bare' as const }
      const id = `${data.name}:${data.line}:${data.col}`
      coordinator.store.set(id, data)
      await (coordinator as any).resolveSingleMethod(id, true) // 強制再試行

      const result = coordinator.store.get(id)!
      expect(result.status).toBe('resolved')
      expect(result.className).toBe('TestClass')
    })
  })
})
