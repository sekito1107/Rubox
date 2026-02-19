// 正規表現ベースの高速なコード走査を担当する
export interface ScannedMethod {
  name: string;
  line: number;
  col: number;
  scanType: "symbol" | "dot" | "call" | "bare" | "definition" | "variable_definition";
}

export class Scanner {
  private static readonly BLACKLIST = new Set([
    "if",
    "def",
    "class",
    "module",
    "end",
    "do",
    "yield",
    "begin",
    "rescue",
    "ensure",
    "elsif",
    "else",
    "then",
    "case",
    "when",
    "unless",
    "until",
    "while",
    "for",
    "return",
    "next",
    "break",
    "redo",
    "retry",
    "alias",
    "undef",
    "and",
    "or",
    "not",
    "super",
    "self",
  ]);

  // 指定された行範囲をスキャンし、メソッド出現箇所を抽出する
  scanLines(
    model: { getLineContent(lineNumber: number): string },
    lineIndices: number[]
  ): Map<number, ScannedMethod[]> {
    const results = new Map<number, ScannedMethod[]>();

    // 定義済みの重要なメソッド名のパターン
    // 1. 定義: def name or def self.name (演算子含む)
    // 2. シンボル形式: &:method (演算子含む)
    // 3. ドット形式: .method (演算子含む)
    // 4. 括弧・ブロック形式: method( or method { or method do
    // 5. 中置演算子: space op space (例: n * 2)
    // 6. 単独形式: method
    const methodPattern =
      /(?:def\s+(?:self\.)?([a-zA-Z_]\w*[!?]?|[-+*/%&|^<>~`^[\]=]+))|&:(?:([a-zA-Z_]\w*[!?]?|[-+*/%&|^<>~`^[\]=]+))|(?:\.)([a-zA-Z_]\w*[!?]?|[-+*/%&|^<>~`^[\]=]+)|(\b[a-zA-Z_]\w*[!?]?)\s*(?=[({]|\s+do\b)|(?:\s+([-+*/%&|^<>~`^[\]=]+)\s+)|(\b[a-zA-Z_]\w*[!?]?)/g;

    lineIndices.forEach((idx) => {
      const lineNum = idx + 1;
      if (lineNum <= 0 || lineNum > (model as any).getLineCount()) return;

      let lineContent = "";
      try {
        // コメントを除去
        lineContent = model
          .getLineContent(lineNum)
          .replace(/#(?!\{).*$/g, (m) => " ".repeat(m.length));

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
      const matches: ScannedMethod[] = [];
      let match: RegExpExecArray | null;

      while ((match = methodPattern.exec(lineContent)) !== null) {
        const name = match[1] || match[2] || match[3] || match[4] || match[5] || match[6];

        // 定数（大文字開始）は全形式で除外
        if (name && /^[A-Z]/.test(name)) {
          continue;
        }

        // 単なる代入 (=) は除外
        if (name === "=") {
          continue;
        }

        if (name && !Scanner.BLACKLIST.has(name)) {
          // match.index は正規表現全体の開始位置。
          const offsetInMatch = match[0].indexOf(name);

          let scanType: "symbol" | "dot" | "call" | "bare" | "definition" = "bare";

          if (match[1]) scanType = "definition";
          else if (match[2]) scanType = "symbol";
          else if (match[3]) scanType = "dot";
          else if (match[4]) scanType = "call";
          else if (match[5]) scanType = "dot"; // 中置演算子はドット形式と同等に扱う

          matches.push({
            name: name,
            line: idx + 1,
            col: match.index + offsetInMatch + 1,
            scanType,
          });
        }
      }

      // ブロック引数を変数定義として抽出
      const blockParamPattern = /\|([^|]+)\|/g;
      let bMatch;
      while ((bMatch = blockParamPattern.exec(lineContent)) !== null) {
        const paramsStr = bMatch[1];
        const params = paramsStr.split(",");
        params.forEach((p) => {
          const name = p.trim().match(/^[a-zA-Z_]\w*[!?]?/)?.[0];
          if (name && !Scanner.BLACKLIST.has(name)) {
            matches.push({
              name,
              line: idx + 1,
              col: bMatch!.index + bMatch![0].indexOf(name) + 1,
              scanType: "variable_definition",
            });
          }
        });
      }

      // for 文のループ変数を変数定義として抽出
      const forPattern = /for\s+([a-zA-Z_]\w*(?:\s*,\s*[a-zA-Z_]\w*)*)\s+in/g;
      let fMatch;
      while ((fMatch = forPattern.exec(lineContent)) !== null) {
        const varsStr = fMatch[1];
        const vars = varsStr.split(",");
        vars.forEach((v) => {
          const name = v.trim();
          if (name && !Scanner.BLACKLIST.has(name)) {
            matches.push({
              name,
              line: idx + 1,
              col: fMatch!.index + fMatch![0].indexOf(name) + 1,
              scanType: "variable_definition",
            });
          }
        });
      }

      // メソッド引数を変数定義として抽出 (例: def my_count(string, target))
      const defParamPattern = /def\s+(?:self\.)?[a-zA-Z_]\w*[!?]?\s*\(([^)]*)\)/g;
      let dMatch;
      while ((dMatch = defParamPattern.exec(lineContent)) !== null) {
        const paramsStr = dMatch[1];
        const params = paramsStr.split(",");
        params.forEach((p) => {
          // デフォルト値 (param = val) やスプラット (*args, **opts) を考慮して変数名のみ抽出
          const nameMatch = p.trim().match(/^[*&]*([a-zA-Z_]\w*)/);
          const name = nameMatch ? nameMatch[1] : null;
          if (name && !Scanner.BLACKLIST.has(name)) {
            matches.push({
              name,
              line: idx + 1,
              col: dMatch!.index + dMatch![0].indexOf(name) + 1,
              scanType: "variable_definition",
            });
          }
        });
      }

      // 単純な代入を変数定義として抽出 (例: string = "banana")
      const assignmentPattern = /(?:^|\s)([a-zA-Z_]\w*)\s*=[^=>]/g;
      let aMatch;
      while ((aMatch = assignmentPattern.exec(lineContent)) !== null) {
        const name = aMatch[1];
        if (name && !Scanner.BLACKLIST.has(name)) {
          matches.push({
            name,
            line: idx + 1,
            col: aMatch.index + aMatch[0].indexOf(name) + 1,
            scanType: "variable_definition",
          });
        }
      }

      // 重複を除去（同じ位置に定義と呼び出しがある場合は、定義を優先）
      const uniqueMatches = Array.from(
        matches
          .reduce((acc, current) => {
            const key = `${current.name}:${current.line}:${current.col}`;
            const existing = acc.get(key);
            // 既存がない、または既存が 'bare' で新しいのがより詳細な型（定義など）の場合は上書き
            if (
              !existing ||
              (existing.scanType === "bare" && current.scanType !== "bare") ||
              (existing.scanType === "call" &&
                (current.scanType === "definition" || current.scanType === "variable_definition"))
            ) {
              acc.set(key, current);
            }
            return acc;
          }, new Map<string, ScannedMethod>())
          .values()
      ).sort((a, b) => a.col - b.col);

      results.set(idx, uniqueMatches);
    });
    return results;
  }
}
