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
      const lineContent = model.getLineContent(line)
      const commentIdx = lineContent.indexOf('#')
      // '#' が見つかり、かつその直後が '{' (式展開) でない場合のみコメントとみなす
      if (commentIdx !== -1 && lineContent[commentIdx + 1] !== '{' && commentIdx < col - 1) {
        return null
      }
    }

    // 1. 現在位置を試行
    let type: string | null = await this.lsp.getTypeAtPosition(line, col)
    
    // 2. フォールバック: 1文字戻って試行 (単語の末尾にカーソルがある場合への対応: names|)
    if (!type && col > 1) {
      type = await this.lsp.getTypeAtPosition(line, col - 1)
    }
    
    // 3. フォールバック: さらに1文字戻って試行 (ドットの直後にカーソルがある場合への対応: names.| )
    if (!type && col > 2) {
      type = await this.lsp.getTypeAtPosition(line, col - 2)
    }

    // 4. フォールバック: 1文字進めて試行 (ドットの直後などの微調整)
    if (!type) {
      type = await this.lsp.getTypeAtPosition(line, col + 1)
    }

    // 5. 最終手段: ドット直後の解決失敗時、ドットを除去したコードでプローブ試行
    if (!type && model) {
      type = await this._probeReceiverType(model, line, col)
    }
    
    return type
  }

  /**
   * メソッド名に対応する定義位置での解決を試みる
   * Scanner から渡される col は既に識別子の開始位置であるため、そのまま使用する
   */
  async resolveMethodAt(line: number, col: number): Promise<string | null> {
    return await this.lsp.getTypeAtPosition(line, col)
  }

  /**
   * ドット (".") の直後にカーソルがある場合に備え、ドットを除去した状態でプローブを行う
   */
  private async _probeReceiverType(model: { getLineContent(l: number): string, getLinesContent(): string[] }, line: number, col: number): Promise<string | null> {
    const lineContent = model.getLineContent(line)
    
    // カーソル位置(col)の直前または現在位置が "." かを確認
    // 1-indexedなので col-1 が現在文字の 0-indexed 位置
    const prevChar = lineContent[col - 2]
    const currChar = lineContent[col - 1]
    
    if (prevChar !== '.' && currChar !== '.') return null

    // ドットを一つ除去した一時的な全行コンテンツを作成
    // (TypeProf の解析精度を保つため、当該行のドットだけを消す)
    const lines = model.getLinesContent()
    const targetIdx = line - 1
    const dotPos = (prevChar === '.') ? col - 2 : col - 1
    
    const newLine = lineContent.substring(0, dotPos) + lineContent.substring(dotPos + 1)
    lines[targetIdx] = newLine
    const tempContent = lines.join("\n")

    // ドットを除去した位置（またはその直前）でプローブ
    // ドットを消したので、新しい位置は line, dotPos (0-indexed to 1-indexed is dotPos+1, 
    // しかしその一点前を見たいので dotPos)
    return this.probe(tempContent, line, Math.max(1, dotPos))
  }

  /**
   * 一時的なコンテンツで型解決を試みる
   */
  async probe(content: string, line: number, col: number): Promise<string | null> {
    return await this.lsp.probeTypeWithTemporaryContent(content, line, col)
  }
}
