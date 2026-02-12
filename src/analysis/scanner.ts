/**
 * 正規表現ベースの高速なコード走査を担当する
 */
export interface ScannedMethod {
  name: string
  line: number
  col: number
}

import { ImplicitMethods } from "./builtins"

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
    // 1. ドット形式: .method
    // 2. 括弧形式: method( or method {
    // 3. ブロック形式: method do
    // 4. シンボル形式: &:method
    // 5. 単独形式 (ホワイトリスト用): method
    const methodPattern = /(?:\.)([a-z_][a-zA-Z0-9_]*[!?]?)|(\b[a-z_][a-zA-Z0-9_]*[!?]?)\s*[({]|(\b[a-z_][a-zA-Z0-9_]*[!?]?)\s+do\b|&:([a-z_][a-zA-Z0-9_]*[!?]?)|(\b[a-z_][a-zA-Z0-9_]*[!?]?)/g

    lineIndices.forEach(idx => {
      // コメントを除去しつつインデックスを維持するため、空白で置換する
      // # から行末までを置換するが、#{ (式展開) は除外する
      const lineContent = model.getLineContent(idx + 1).replace(/#(?!\{).*$/g, m => " ".repeat(m.length))
      const matches: ScannedMethod[] = []
      let match: RegExpExecArray | null

      // 簡易的な正規表現マッチング
      while ((match = methodPattern.exec(lineContent)) !== null) {
        // match[1]: .method
        // match[2]: method(
        // match[3]: method do
        // match[4]: &:method
        // match[5]: method (standalone)
        const name = match[1] || match[2] || match[3] || match[4] || match[5]
        
        // 5番目のグループ（単独形式）の場合は、ホワイトリストに含まれるかチェック
        if (match[5]) {
           // ドットなどが先行していないことを確認 (他のグループでマッチしていない場合のみ)
           if (!ImplicitMethods.has(match[5])) {
             continue
           }
        }

        if (name && !this._isBlacklisted(name)) {
          // マッチしたグループに基づいて正確なカラム位置を計算する
          let columnOffset = 0
          if (match[1]) {
            // .name -> . の次の文字から
            columnOffset = match[0].indexOf(name)
          } else if (match[2] || match[3] || match[5]) {
            // name( or name do or name -> そのまま
            columnOffset = match[0].indexOf(name)
          } else if (match[4]) {
            // &:name -> &: の次の文字から
            columnOffset = match[0].indexOf(name)
          }

          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + columnOffset + 1 // 1-indexed
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
