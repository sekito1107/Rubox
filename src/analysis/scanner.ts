/**
 * 正規表現ベースの高速なコード走査を担当する
 */
export interface ScannedMethod {
  name: string
  line: number
  col: number
}

export class Scanner {
  /**
   * 指定された行範囲をスキャンし、メソッド出現箇所を抽出する
   * @param model monaco.editor.ITextModel
   * @param lineIndices 
   * @returns Map<number, ScannedMethod[]>
   */
  scanLines(model: { getLineContent(lineNumber: number): string }, lineIndices: number[]): Map<number, ScannedMethod[]> {
    const results = new Map<number, ScannedMethod[]>()
    
    // 定義済みの重要なメソッド名のパターン
    // .member や member() や member do ... や &:member を捕捉
    const methodPattern = /(?:\.)([a-z_][a-zA-Z0-9_]*[!?]?)|([a-z_][a-zA-Z0-9_]*[!?]?)\s*[({]|([a-z_][a-zA-Z0-9_]*[!?]?)\s+do\b|&:([a-z_][a-zA-Z0-9_]*[!?]?)/g

    lineIndices.forEach(idx => {
      // コメントを除去しつつインデックスを維持するため、空白で置換する
      const lineContent = model.getLineContent(idx + 1).replace(/#.*$/, m => " ".repeat(m.length))
      const matches: ScannedMethod[] = []
      let match: RegExpExecArray | null

      // 簡易的な正規表現マッチング
      while ((match = methodPattern.exec(lineContent)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4]
        if (name && !this._isBlacklisted(name)) {
          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + 2 // 1-indexed かつ、ドットや&:が含まれる場合はそれをスキップした位置
          })
        }
      }
      results.set(idx, matches)
    })
    return results
  }

  private _isBlacklisted(name: string): boolean {
    return ["if", "def", "class", "module", "end", "do", "yield", "begin", "rescue", "ensure", "elsif", "else"].includes(name)
  }
}
