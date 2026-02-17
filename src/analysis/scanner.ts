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
      const lineNum = idx + 1
      if (lineNum <= 0 || lineNum > (model as any).getLineCount()) return;
      
      let lineContent = "";
      try {
        // コメントを除去
        lineContent = model.getLineContent(lineNum).replace(/#(?!\{).*$/g, m => " ".repeat(m.length))

        // 文字列リテラルを空白で置換（式展開 #{...} は残す）
        // 簡易的な実装: "..." or '...' を探し、中身を空白にする。ただし # は考慮しない（コメントは先に消している）
        lineContent = lineContent.replace(/(["'])(?:(?=(\\?))\2.)*?\1/g, (m) => {
            // 式展開 #{...} が含まれている場合は、その部分だけ残して周りを空白にする
            if (m.includes("#{")) {
                let result = m[0]; // 開始クォート
                let i = 1;
                while (i < m.length - 1) {
                    if (m.substring(i, i + 2) === "#{") {
                        // 式展開開始。対応する } を探す
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
        const name = match[1] || match[2] || match[3] || match[4]
        
        // 1. 単独形式（グループ4）のフィルタリング
        if (match[4]) {
            // 暗黙のメソッド（ホワイトリスト）に含まれる場合のみ採用
            if (!ImplicitMethods.has(name)) {
              continue
            }
        }

        // 2. 定数（大文字開始）はメソッドではないので全形式で除外する
        // (例: Sum(...) はメソッドではなく定数/クラス)
        if (name && /^[A-Z]/.test(name)) {
            continue;
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
