import { Scanner } from "./analysis/scanner"
import { Tracker } from "./analysis/tracker"
import { Resolver } from "./analysis/resolver"
import { AnalysisStore } from "./analysis/store"

/**
 * コード解析ドメインを統括する Coordinator
 */
export class AnalysisCoordinator {
  constructor(editor, lspManager, rurima) {
    this.editor = editor
    this.lspManager = lspManager
    
    // コンポーネントの初期化
    this.store = new AnalysisStore()
    this.scanner = new Scanner()
    this.tracker = new Tracker()
    this.resolver = new Resolver(lspManager, rurima)
    
    // 後位互換性のためのエイリアス (Resolution へのアクセス用)
    this.resolution = this.resolver.resolution
    
    // Rurima ドメインへの参照を保持
    this.rurima = rurima

    this.lineMethods = [] // キャッシュ: インデックス=行番号, 値=Array of {name, line, col}
    this.isAnalyzing = false
    this.needsReanalysis = false
    this.debounceTimer = null
    this.WAIT_MS = 800
  }

  /**
   * 解析エンジンの稼働開始
   */
  start() {
    // 1. エディタの変更を監視
    this.editor.onDidChangeModelContent((e) => {
      this.tracker.processChangeEvent(e, this.lineMethods)
      this.scheduleAnalysis()
    })

    // 2. 初期スキャン
    this.scheduleAnalysis(0)

    // 3. LSP の解析完了イベントを購読
    this.boundHandleLSPFinished = () => this.scheduleAnalysis()
    window.addEventListener("rubpad:lsp-analysis-finished", this.boundHandleLSPFinished)
  }

  stop() {
    window.removeEventListener("rubpad:lsp-analysis-finished", this.boundHandleLSPFinished)
  }

  scheduleAnalysis(delay = this.WAIT_MS) {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.performAnalysis(), delay)
  }

  /**
   * 解析の実行コア
   */
  async performAnalysis() {
    if (this.isAnalyzing) {
      this.needsReanalysis = true
      return
    }

    const model = this.editor.getModel()
    if (!model) return

    this.isAnalyzing = true
    this.needsReanalysis = false
    
    // 解析前にドキュメントを強制同期 (LSP側)
    if (this.lspManager.flushDocumentSync) {
      this.lspManager.flushDocumentSync()
    }

    try {
      const dirtyLines = this.tracker.getDirtyLines()
      const shouldFullScan = this.lineMethods.length === 0 || this.lineMethods.length !== model.getLineCount()
      
      // 1. 必要に応じて再スキャン
      if (shouldFullScan || dirtyLines.size > 0) {
        if (shouldFullScan) this.tracker.markAllDirty(model.getLineCount())
        
        const scanResults = this.scanner.scanLines(model, Array.from(this.tracker.getDirtyLines()))
        scanResults.forEach((methods, lineIdx) => {
          this.lineMethods[lineIdx] = methods
        })
        this.tracker.clearDirtyLines()
      }

      // 2. 現在の全出現箇所をフラット化
      const allOccurrences = this.lineMethods.flat().filter(Boolean)
      const currentNames = new Set(allOccurrences.map(m => m.name))

      // 3. 不要になったメソッドの除去
      let changed = this.store.keepOnly(currentNames)

      // 4. 新規メソッドの登録と位置更新
      for (const item of allOccurrences) {
        let state = this.store.get(item.name)
        
        if (!state) {
          // 新規発見: 解決待ち状態で登録
          state = { ...item, status: 'pending', className: null, url: null, isResolving: false }
          this.store.set(item.name, state)
          changed = true
          this.resolveSingleMethod(item.name)
        } else {
          // 位置がずれた場合は更新
          if (state.line !== item.line || state.col !== item.col) {
            state.line = item.line
            state.col = item.col
          }
          // 未解決ならリトライ
          if (state.status === 'unknown') {
            this.resolveSingleMethod(item.name)
          }
        }
      }

      // 初回または変更があった場合に通知
      if (changed || !this.store.firstScanDone) {
        this.store.setFirstScanDone(true)
        this.store.notify()
      }

    } catch (e) {
      console.error("[AnalysisCoordinator] Analysis failed:", e)
    } finally {
      this.isAnalyzing = false
      if (this.needsReanalysis) this.scheduleAnalysis()
    }
  }

  /**
   * 単一メソッドの型解決依頼
   */
  async resolveSingleMethod(name) {
    const data = this.store.get(name)
    if (!data || data.status === 'resolved' || data.isResolving) return

    data.isResolving = true
    try {
      const info = await this.resolver.resolve(name, data.line, data.col)
      if (info.status === 'resolved') {
        this.store.set(name, { ...data, ...info })
      } else {
        this.store.set(name, { ...data, status: 'unknown' })
      }
    } finally {
      data.isResolving = false
      this.store.notify()
    }
  }

  // 外部インターフェース (エイリアス)
  getAnalysis() {
    return {
      methods: this.store.getAll(),
      firstScanDone: this.store.firstScanDone
    }
  }
}
