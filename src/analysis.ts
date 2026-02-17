import { Scanner, ScannedMethod } from "./analysis/scanner"
import { Tracker } from "./analysis/tracker"
import { Resolver } from "./analysis/resolver"
import { AnalysisStore, MethodItem } from "./analysis/store"

/**
 * コード解析ドメインを統括する Coordinator
 */
export class AnalysisCoordinator {
  private editor: any
  private lspManager: any
  public store: AnalysisStore
  private scanner: Scanner
  public tracker: Tracker
  public resolver: Resolver
  public reference: any

  private lineMethods: Array<ScannedMethod[] | null>
  public isAnalyzing: boolean
  public needsReanalysis: boolean
  private debounceTimer: any
  private WAIT_MS: number

  private boundHandleLSPFinished: () => void

  constructor(editor: any, lspManager: any, rurima: any) {
    this.editor = editor
    this.lspManager = lspManager
    
    // コンポーネントの初期化
    this.store = new AnalysisStore()
    this.scanner = new Scanner()
    this.tracker = new Tracker()
    this.resolver = new Resolver(lspManager, rurima)
    this.reference = rurima
    
    this.lineMethods = [] // キャッシュ: インデックス=行番号, 値=メソッド情報（name, line, col）の配列
    this.isAnalyzing = false
    this.needsReanalysis = false
    this.debounceTimer = null
    this.WAIT_MS = 800

    this.boundHandleLSPFinished = () => this.scheduleAnalysis()
  }

  /**
   * 解析エンジンの稼働開始
   */
  start(): void {
    // 1. エディタの変更を監視
    this.editor.onDidChangeModelContent((e: any) => {
      // コードに変更があったらゴーストテキスト(測定値)を消去する
      if (this.lspManager && typeof this.lspManager.clearMeasuredValues === 'function') {
        this.lspManager.clearMeasuredValues()
      }
      this.tracker.processChangeEvent(e, this.lineMethods)
      this.scheduleAnalysis()
    })

    // 2. 初期スキャン
    this.scheduleAnalysis(0)

    // 3. LSP の解析完了イベントを購読
    window.addEventListener("rubbit:lsp-analysis-finished", () => {
      if (this.needsReanalysis) {
        this.scheduleAnalysis()
      } else {
        // LSP 解析が終わったので、これまで unknown だったものも再試行する
        this.retryUnknownMethods()
      }
    })
  }

  private retryUnknownMethods(): void {
    const unknownItems = this.store.getAll().filter(item => item.status === 'unknown')
    if (unknownItems.length > 0) {
      unknownItems.forEach(item => {
        const id = `${item.name}:${item.line}:${item.col}`
        this.resolveSingleMethod(id, true) // 強制再試行
      })
    }
  }

  stop(): void {
    window.removeEventListener("rubbit:lsp-analysis-finished", this.boundHandleLSPFinished)
  }

  scheduleAnalysis(delay: number = this.WAIT_MS): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.performAnalysis(), delay)
  }

  private _getMethodId(item: ScannedMethod): string {
    return `${item.name}:${item.line}:${item.col}`
  }

  /**
   * 解析の実行コア
   */
  async performAnalysis(): Promise<void> {
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
      const lineCount = model.getLineCount()
      const dirtyLines = this.tracker.getDirtyLines()
      const shouldFullScan = this.lineMethods.length === 0 || this.lineMethods.length !== lineCount
      
      // 1. 必要に応じて再スキャン
      if (shouldFullScan || dirtyLines.size > 0) {
        if (shouldFullScan) {
          this.tracker.markAllDirty(lineCount)
          // サイズが変わっている場合、既存のキャッシュを今の行数に合わせる
          this.lineMethods = new Array(lineCount).fill(null)
        }
        
      const scanResults = this.scanner.scanLines(model, Array.from(this.tracker.getDirtyLines()))
      scanResults.forEach((methods, lineIdx) => {
        this.lineMethods[lineIdx] = methods
      })
        this.tracker.clearDirtyLines()
      }

      // 2. 現在の全出現箇所をフラット化
      const allOccurrences = this.lineMethods.flat().filter((m): m is ScannedMethod => m !== null)

      // ローカル定義されたメソッド（def name）を特定
      const definedMethods = new Set(
        allOccurrences.filter(m => m.scanType === 'definition').map(m => m.name)
      )
      
      // 定義そのものと、ローカル定義が存在するメソッドの呼び出しを除外
      const filteredOccurrences = allOccurrences.filter(m => 
        m.scanType !== 'definition' && !definedMethods.has(m.name)
      )

      const currentIds = new Set(filteredOccurrences.map(m => this._getMethodId(m)))

      // 3. 不要になったメソッドの除去
      let changed = this.store.keepOnly(currentIds)

      // 4. 新規メソッドの登録と位置更新
      for (const item of filteredOccurrences) {
        const id = this._getMethodId(item)
        let state = this.store.get(id)
        
        if (!state) {
          // 新規発見: 解決待ち状態で登録
          state = { ...item, status: 'pending', className: null, url: null, isResolving: false }
          this.store.set(id, state)
          changed = true
          this.resolveSingleMethod(id)
        }
      }

      // 初回または変更があった場合に通知
      if (changed || !this.store.firstScanDone) {
        this.store.setFirstScanDone(true)
        this.store.notify()
      }

    } catch {
      // 解析エラーは外部に伝播させず、静かに失敗する
    } finally {
      this.isAnalyzing = false
      if (this.needsReanalysis) {
        this.scheduleAnalysis()
      }
    }
  }

  /**
   * 単一メソッドの型解決依頼
   * @param id メソッドID
   * @param force すでに 'unknown' や 'resolved' の場合でも強制的に再試行するか
   */
  private async resolveSingleMethod(id: string, force: boolean = false): Promise<void> {
    const item = this.store.get(id)
    if (!item || item.isResolving) return
    if (!force && item.status === 'resolved') return

    item.isResolving = true
    this.store.set(id, item)

    const result = await this.resolver.resolve(item.name, item.line, item.col)
    
    const updatedItem = this.store.get(id)
    if (updatedItem) {
      updatedItem.isResolving = false
      if (result.status === 'resolved') {
        updatedItem.status = 'resolved'
        updatedItem.className = result.className || null
        updatedItem.url = result.url || null
        updatedItem.separator = result.separator || '.'
      } else {
        updatedItem.status = 'unknown'
      }
      this.store.set(id, updatedItem)
      this.store.notify()
    }
  }

  // 外部インターフェース (エイリアス)
  getAnalysis(): { methods: MethodItem[], firstScanDone: boolean } {
    return {
      methods: this.store.getAll(),
      firstScanDone: this.store.firstScanDone
    }
  }
}
