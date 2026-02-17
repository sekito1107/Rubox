/**
 * LSP クライアントを直接使用し、シンボルや位置に基づいた型解決を行う
 */
export class Resolution {
  private lsp: any

  constructor(lspManager: any) {
    this.lsp = lspManager
  }

  /**
   * 指定された位置の型を特定し、クラス名を返す
   */
  async resolveAtPosition(line: number, col: number): Promise<string | null> {
    // 0. コメント内チェック
    const model = this.lsp.model
    if (model) {
      if (line <= 0 || line > model.getLineCount()) return null
      let lineContent = "";
      try {
        lineContent = model.getLineContent(line)
      } catch (e: any) {
        console.error(`[Resolution/resolveAtPosition] Error getting content for line ${line}:`, e.message);
        return null;
      }
      const commentIdx = lineContent.indexOf('#')
      // '#' が見つかり、かつその直後が '{' (式展開) でない場合のみコメントとみなす
      if (commentIdx !== -1 && lineContent[commentIdx + 1] !== '{' && commentIdx < col - 1) {
        return null
      }

      // 1. 本来の位置で試行
      let type: string | null = await this.lsp.getTypeAtPosition(line, col)
      if (type) return type

      // 2. フォールバック: 前方に遡って意味のあるシンボルを探す
      // ドット直後や単語の末尾で解決に失敗した場合のため、空白やドットを飛ばして文字を探す
      for (let offset = 1; offset <= 5; offset++) {
        const targetCol = col - offset
        if (targetCol <= 0) break
        
        const char = lineContent[targetCol - 1]
        // 空白とドットは飛ばす (names. | のようなケース)
        if (/\s/.test(char) || char === '.') continue

        type = await this.lsp.getTypeAtPosition(line, targetCol)
        if (type) return type
      }


    }
    
    return null
  }

  /**
   * メソッド名に対応する定義位置での解決を試みる
   * Scanner から渡される col は既に識別子の開始位置であるため、そのまま使用する
   */
  async resolveMethodAt(line: number, col: number): Promise<string | null> {
    return await this.lsp.getTypeAtPosition(line, col)
  }


}
