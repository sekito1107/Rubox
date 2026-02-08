/**
 * LSP を使用して型を解決し、ドメイン固有のフォールバックロジックを提供する Interactor
 */
export class ResolutionInteractor {
  /**
   * @param {LSPInteractor} lspInteractor 
   */
  constructor(lspInteractor) {
    this.lspInteractor = lspInteractor
  }

  /**
   * 指定された位置の型を解決する（リトライ付き）
   * @param {Object} options { maxRetries: number, initialDelay: number, retryDelay: number, skipSync: boolean }
   * @returns {Promise<string|null>}
   */
  async resolveAtPosition(line, col, options = {}) {
    const { maxRetries = 3, initialDelay = 100, retryDelay = 2000, skipSync = false } = options

    // 初回待機（初期化直後の混雑回避用）
    if (initialDelay > 0) {
      await new Promise(r => setTimeout(r, initialDelay))
    }

    for (let i = 0; i <= maxRetries; i++) {
       const type = await this.lspInteractor.getTypeAtPosition(line, col, skipSync)
       if (type) return type

       // 解析待ちのリトライ
       if (i < maxRetries) {
         const delay = i === 0 ? retryDelay : retryDelay * 2
         await new Promise(r => setTimeout(r, delay))
       }
    }

    return null
  }

  /**
   * 指定位置のメソッドの型を解決する（ドメイン特化の推論付き）
   * @param {number} line 
   * @param {number} col 
   * @param {Object} options { methodName, skipSync }
   */
  async resolveMethodAt(line, col, options = {}) {
    const { methodName, skipSync = false } = options

    // 1. まずはそのままの位置を試行 (リトライ付き)
    // バックグラウンド解析時は i < 2 程度に抑える
    let type = await this.resolveAtPosition(line, col, { skipSync, maxRetries: 2, retryDelay: 1000 })
    if (type) return type

    // 2. ドットやシンボル渡しのコンテキストを考慮したフォールバック
    // Monaco のモデルを使用して周辺の文字列を確認
    const model = this.lspInteractor.model
    if (!model) return null

    const lineContent = model.getLineContent(line)
    // col は 1-indexed (e.g., 2文字目は col=2, index=1)
    const charBefore = lineContent[col - 2]
    const charBefore2 = lineContent[col - 3]

    // ".each" のようにドットがある場合
    if (charBefore === ".") {
        // ドットの直前の位置（レシーバの最後）で型解決を試みる
        type = await this.lspInteractor.getTypeAtPosition(line, col - 1, true)
        if (type) return type
    }
    
    // "&:upcase" のようにシンボルがある場合
    if (charBefore === ":" && charBefore2 === "&") {
        // & の直前の位置（レシーバの最後、または map 等の呼び出し位置）を試みる
        // 現状は簡易的に &: の手前で解決
        type = await this.lspInteractor.getTypeAtPosition(line, col - 2, true)
        if (type) return type
    }

    return null
  }

  /**
   * コンテキストに基づいたフォールバック解析を行う
   * (例: ドットの直後にカーソルがある場合、ドットを除去してレシーバの型を推測する)
   * @param {Object} editor Monaco editor instance
   * @param {Object} position { lineNumber, column }
   * @returns {Promise<string|null>}
   */
  async resolveWithFallback(editor, position) {
    const lineContent = editor.getModel().getLineContent(position.lineNumber)
    const charBefore = lineContent[position.column - 2]

    // 1. 通常の解析を試行
    let type = await this.resolveAtPosition(position.lineNumber, position.column, { maxRetries: 0 })
    if (type) return type

    // 2. ドット除去によるリトライ (".|" -> "|")
    if (charBefore === ".") {
        // ドットをスペースに置換した一時コンテンツを作成
        const tempLine = lineContent.substring(0, position.column - 2) + " " + lineContent.substring(position.column - 1)
        const fullContent = editor.getModel().getValue().split("\n")
        fullContent[position.lineNumber - 1] = tempLine
        
        // 置換後の位置でプローブ (ドットがあった位置)
        type = await this.lspInteractor.probeTypeWithTemporaryContent(
            fullContent.join("\n"), 
            position.lineNumber, 
            position.column - 2
        )
        
        // もし null なら、その一文字前（レシーバの末尾トークン）を直接プローブ
        if (!type && position.column > 2) {
           type = await this.lspInteractor.getTypeAtPosition(position.lineNumber, position.column - 2, true)
        }
        if (type) return type
    }
    
    // 3. &: 記法の処理 ("&:|meth")
    if (charBefore === ":" && lineContent[position.column - 3] === "&") {
        type = await this.lspInteractor.getTypeAtPosition(position.lineNumber, position.column - 2)
        if (type) return type
    }

    return null
  }
}
