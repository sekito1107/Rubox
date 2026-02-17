/**
 * 正規表現ベースの高速なコード走査を担当する
 */
export interface ScannedMethod {
  name: string
  line: number
  col: number
  scanType: 'symbol' | 'dot' | 'call' | 'bare' | 'definition'
}



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
    // 1. 定義: def name or def self.name
    // 2. シンボル形式: &:method (優先)
    // 3. ドット形式: .method
    // 4. 括弧・ブロック形式: method( or method { or method do
    // 5. 単独形式: method
    const methodPattern = /(?:def\s+(?:self\.)?([a-zA-Z_]\w*[!?]?))|&:(?:([a-zA-Z_]\w*[!?]?))|(?:\.)([a-zA-Z_]\w*[!?]?)|(\b[a-zA-Z_]\w*[!?]?)\s*(?=[({]|\s+do\b)|(\b[a-zA-Z_]\w*[!?]?)/g

    lineIndices.forEach(idx => {
      const lineNum = idx + 1
      if (lineNum <= 0 || lineNum > (model as any).getLineCount()) return;
      
      let lineContent = "";
      try {
        // コメントを除去
        lineContent = model.getLineContent(lineNum).replace(/#(?!\{).*$/g, m => " ".repeat(m.length))

        // 文字列リテラルを空白で置換（式展開 #{...} は残す）
        lineContent = lineContent.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (m) => {
            if (m.includes("#{")) {
                let result = m[0]; // 開始クォート
                let i = 1;
                while (i < m.length - 1) {
                    if (m.substring(i, i + 2) === "#{") {
                        const start = i;
                        let nest = 0;
                        for (; i < m.length - 1; i++) {
                            if (m.substring(i, i + 2) === "#{") nest++;
                            if (m[i] === "}") {
                                nest--;
                                if (nest === 0) break;
                            }
                        }
                        result += m.substring(start, i + 1);
                        i++;
                    } else {
                        result += " ";
                        i++;
                    }
                }
                result += m[m.length - 1]; // 終了クォート
                return result;
            }
            return " ".repeat(m.length);
        });
      } catch {
        return;
      }
      const matches: ScannedMethod[] = []
      let match: RegExpExecArray | null

      while ((match = methodPattern.exec(lineContent)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4] || match[5]

        // 定数（大文字開始）は全形式で除外
        if (name && /^[A-Z]/.test(name)) {
            continue;
        }

        if (name && !Scanner.BLACKLIST.has(name)) {
          // match.index は正規表現全体の開始位置。
          const offsetInMatch = match[0].indexOf(name)

          let scanType: 'symbol' | 'dot' | 'call' | 'bare' | 'definition' = 'bare'
          
          if (match[1]) scanType = 'definition'
          else if (match[2]) scanType = 'symbol'
          else if (match[3]) scanType = 'dot'
          else if (match[4]) scanType = 'call'
          // match[5] is bare

          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + offsetInMatch + 1, // 1-indexed
            scanType
          })
        }
      }
      results.set(idx, matches)
    })
    return results
  }
}
