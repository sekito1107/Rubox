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
  private static readonly BLACKLIST = new Set([
    "if", "def", "class", "module", "end", "do", "yield", "begin", "rescue", "ensure", "elsif", "else", "then", "case", "when", "unless", "until", "while", "for", "return", "next", "break", "redo", "retry", "alias", "undef", "and", "or", "not", "super", "self"
  ]);

  /**
   * 指定された行範囲をスキャンし、メソッド出現箇所を抽出する
   */
  scanLines(model: { getLineContent(lineNumber: number): string }, lineIndices: number[]): Map<number, ScannedMethod[]> {
    const results = new Map<number, ScannedMethod[]>()
    
    // 定義済みの重要なメソッド名のパターン
    // 1. シンボル形式: &:method (優先)
    // 2. ドット形式: .method
    // 3. 括弧・ブロック形式: method( or method { or method do
    // 4. 単独形式: method
    const methodPattern = /&:(?:([a-zA-Z_]\w*[!?]?))|(?:\.)([a-zA-Z_]\w*[!?]?)|(\b[a-zA-Z_]\w*[!?]?)\s*(?=[({]|\s+do\b)|(\b[a-zA-Z_]\w*[!?]?)/g

    lineIndices.forEach(idx => {
      const lineContent = model.getLineContent(idx + 1).replace(/#(?!\{).*$/g, m => " ".repeat(m.length))
      const matches: ScannedMethod[] = []
      let match: RegExpExecArray | null

      while ((match = methodPattern.exec(lineContent)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4]
        
        // 単独形式（グループ4）のフィルタリング
        if (match[4]) {
            // 定数（大文字開始）またはホワイトリストに含まれる場合のみ採用
            const isConstant = /^[A-Z]/.test(name)
            if (!isConstant && !ImplicitMethods.has(name)) {
              continue
            }
        }

        if (name && !Scanner.BLACKLIST.has(name)) {
          // match.index は正規表現全体の開始位置。
          // name の位置を特定するために match[0].indexOf(name) を使用（より安全）
          const offsetInMatch = match[0].indexOf(name)

          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + offsetInMatch + 1 // 1-indexed
          })
        }
      }
      results.set(idx, matches)
    })
    return results
  }
}
