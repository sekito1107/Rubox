import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { CursorDocComponent } from '../../../src/reference/cursor-doc'

describe('CursorDocComponent', () => {
  let component: CursorDocComponent
  let mockList: HTMLElement
  let mockLoader: HTMLElement
  let mockCardTemplate: HTMLTemplateElement
  let mockLinkTemplate: HTMLTemplateElement
  let mockEditor: any
  let mockModel: any

  beforeEach(() => {
    vi.useFakeTimers()

    // DOMモック
    mockList = document.createElement('div')
    mockLoader = document.createElement('div')
    mockCardTemplate = document.createElement('template')
    mockCardTemplate.innerHTML = '<div><span data-role="methodName"></span><div data-role="linksDetails"></div></div>'
    mockLinkTemplate = document.createElement('template')
    mockLinkTemplate.innerHTML = '<a><span data-role="className"></span><span data-role="separatorMethod"></span></a>'

    mockModel = {
      getWordAtPosition: vi.fn(),
      getLineContent: vi.fn(),
      getValueInRange: vi.fn(),
      getLineCount: vi.fn().mockReturnValue(10),
      getPosition: vi.fn()
    }

    mockEditor = {
      getPosition: vi.fn(),
      getModel: vi.fn().mockReturnValue(mockModel),
      onDidChangeCursorPosition: vi.fn()
    }

    // グローバルモック
    const g = window as any
    g.ruboxLSPManager = {
      probeReturnType: vi.fn().mockResolvedValue('String'),
      flushDocumentSync: vi.fn()
    }
    g.ruboxAnalysisCoordinator = {
      resolver: {
        resolution: {
          resolveAtPosition: vi.fn().mockResolvedValue('Integer')
        }
      },
      reference: {
        fetchMethods: vi.fn().mockResolvedValue([{ methodName: 'test', links: [] }])
      }
    }

    component = new CursorDocComponent(mockList, mockLoader, mockCardTemplate, mockLinkTemplate)
    // 直接 editor を流し込む
    ;(component as any).editor = mockEditor
    component['setupListeners']()
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window as any).ruboxLSPManager
    delete (window as any).ruboxAnalysisCoordinator
  })

  describe('isMethodCallPosition', () => {
    it('ドット直後であれば true を返すこと', () => {
      const pos = { lineNumber: 1, column: 10 }
      mockModel.getWordAtPosition.mockReturnValue({ startColumn: 10, endColumn: 15 })
      mockModel.getValueInRange.mockReturnValue('.')
      
      expect((component as any).isMethodCallPosition(pos)).toBe(true)
      expect(mockModel.getValueInRange).toHaveBeenCalledWith({
        startLineNumber: 1,
        startColumn: 9,
        endLineNumber: 1,
        endColumn: 10
      })
    })

    it('ドットがなければ false を返すこと', () => {
      const pos = { lineNumber: 1, column: 5 }
      mockModel.getWordAtPosition.mockReturnValue({ startColumn: 1, endColumn: 5 })
      mockModel.getValueInRange.mockReturnValue(' ')
      
      expect((component as any).isMethodCallPosition(pos)).toBe(false)
    })
  })

  describe('getMethodCallExpression', () => {
    it('メソッドチェーン式を正しく抽出すること', () => {
      const pos = { lineNumber: 1, column: 19 }
      mockModel.getWordAtPosition.mockReturnValue({ startColumn: 10, endColumn: 20 })
      mockModel.getLineContent.mockReturnValue('  user.profile.name')
      
      const result = (component as any).getMethodCallExpression(pos)
      expect(result).toBe('user.profile.name')
    })

    it('代入文の右辺のみを抽出すること', () => {
      const pos = { lineNumber: 1, column: 17 }
      mockModel.getWordAtPosition.mockReturnValue({ startColumn: 12, endColumn: 18 })
      mockModel.getLineContent.mockReturnValue('var = obj.method')
      
      const result = (component as any).getMethodCallExpression(pos)
      expect(result).toBe('obj.method')
    })
  })

  describe('performContextualUpdate (キャッシュとループ防止)', () => {
    it('同一の probeKey の場合は再解析をスキップすること', async () => {
      const pos = { lineNumber: 1, column: 5 }
      mockEditor.getPosition.mockReturnValue(pos)
      mockModel.getWordAtPosition.mockReturnValue({ word: 'test' })
      
      const g = window as any
      const probeSpy = g.ruboxLSPManager.probeReturnType
      
      await component['performContextualUpdate']()
      expect(probeSpy).toHaveBeenCalledTimes(1)
      
      // 2回目呼び出し（同一位置）
      await component['performContextualUpdate']()
      expect(probeSpy).toHaveBeenCalledTimes(1) // 増えないはず
    })

    it('wordInfoがない場合(ドット直後等)でも lastPositionKey でキャッシュすること', async () => {
      const pos = { lineNumber: 1, column: 10 }
      mockEditor.getPosition.mockReturnValue(pos)
      mockModel.getWordAtPosition.mockReturnValue(null) // wordInfoなし
      
      const g = window as any
      const resolveSpy = g.ruboxAnalysisCoordinator.resolver.resolution.resolveAtPosition
      
      await component['performContextualUpdate']()
      expect(resolveSpy).toHaveBeenCalledTimes(1)
      
      // 同一位置での再試行
      await component['performContextualUpdate']()
      expect(resolveSpy).toHaveBeenCalledTimes(1) // 増えないはず
    })

    it('isProbingフラグが立っている間は lsp-analysis-finished イベントを無視すること', () => {
      const updateSpy = vi.spyOn(component as any, 'updateContextualList')
      
      ;(component as any).isProbing = true
      window.dispatchEvent(new CustomEvent('rubox:lsp-analysis-finished'))
      
      expect(updateSpy).not.toHaveBeenCalled()
      
      ;(component as any).isProbing = false
      window.dispatchEvent(new CustomEvent('rubox:lsp-analysis-finished'))
      expect(updateSpy).toHaveBeenCalled()
    })

    it('解析前後で isProbing フラグを適切に制御すること', async () => {
      const pos = { lineNumber: 1, column: 5 }
      mockEditor.getPosition.mockReturnValue(pos)
      mockModel.getWordAtPosition.mockReturnValue({ word: 'test' })
      
      expect((component as any).isProbing).toBe(false)
      
      const updatePromise = component['performContextualUpdate']()
      // 非同期実行中
      expect((component as any).isProbing).toBe(true)
      
      await updatePromise
      expect((component as any).isProbing).toBe(false)
    })
  })

  describe('updateContextualList', () => {
    it('300msのデバウンスが効くこと', () => {
      const performSpy = vi.spyOn(component as any, 'performContextualUpdate').mockResolvedValue(undefined)
      
      component['updateContextualList']()
      component['updateContextualList']()
      component['updateContextualList']()
      
      vi.advanceTimersByTime(299)
      expect(performSpy).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(1)
      expect(performSpy).toHaveBeenCalledTimes(1)
    })
  })
})
