// LSP (TypeProf) のレスポンスをパースして情報を抽出するユーティリティクラス
export class LSPResponseParser {
  // Hover レスポンスから Ruby のクラス名を抽出する
  static parseClassNameFromHover(markdownContent: string | null | undefined): string | null {
    if (!markdownContent) return null;
    const content = markdownContent.trim();

    // TypeProf のホバーが変数型情報である場合にメソッド候補から除外するための判定
    // メソッドシグネチャ (def ...) や クラス/モジュール定義を含まない、
    // かつ "名前: 型" の形式が主要な情報として含まれる場合は、メソッド解決用として扱わない。
    if (!content.includes("def ") && !content.match(/^(?:class|module)\s/)) {
      // プレーンテキストまたはコードブロック内の "var: Type" 形式をチェック
      if (content.match(/(?:^|\n|```ruby\n)\s*[a-z_]\w*\s*:\s*[A-Z]/)) {
        return null;
      }
    }

    return this._doParse(content);
  }

  // Hover レスポンスからメソッドの戻り値型を抽出する
  static parseReturnTypeFromHover(markdownContent: string | null | undefined): string | null {
    if (!markdownContent) return null;
    const content = markdownContent.trim();

    // "-> Type" パターンを探す。
    // ブロック引数内の "-> " と混同しないよう、末尾に近いものを優先する。
    // クラス名(大文字)、文字列リテラル(" or ')、シンボル(:)、配列([) に対応し、改行までを型名とする。
    const returnTypeMatch = content.match(/->\s+([A-Z"':[][^\r\n]*)/g);
    if (returnTypeMatch) {
      const lastMatch = returnTypeMatch[returnTypeMatch.length - 1];
      const typeName = lastMatch.replace(/^->\s+/, "").trim();
      return this.normalizeTypeName(typeName);
    }

    return null;
  }

  // プローブ変数のホバーレスポンスから型を抽出する ("var: Type" 形式に対応)
  static parseTypeFromProbe(markdownContent: string | null | undefined): string | null {
    if (!markdownContent) return null;
    const content = markdownContent.trim();
    const varMatch = content.match(/[a-z_]\w*\s*:\s*([A-Z][a-zA-Z0-9_:]*(?:\[.*?\])?)/);
    if (varMatch) return this.normalizeTypeName(varMatch[1]);
    return this._doParse(content);
  }

  private static _doParse(content: string): string | null {
    // 1. "Class#method" or "Class.method" 形式を文中から最優先で探す
    // `Prime.each` のようなケースに対応するため、[#.] の直前の識別子を柔軟に捕まえる
    const sigMatch = content.match(/([A-Z][a-zA-Z0-9_:]*)(?:\[.*\])?[#.]/);
    if (sigMatch) {
      return this.normalizeTypeName(sigMatch[1]);
    }

    // 1b. "module Prime", "class Array" などの明示的な開始
    const explicitMatch = content.match(/^(?:module|class)\s+([A-Z][a-zA-Z0-9_:]*)/);
    if (explicitMatch) {
      return this.normalizeTypeName(explicitMatch[1]);
    }

    // 2. 配列/タプル形式 [Integer, String] -> Array とみなす
    if (
      content.startsWith("[") ||
      content.includes(": [") ||
      content.includes("-> [") ||
      content.includes("```ruby\n[") ||
      content.match(/^Array\[/)
    ) {
      return "Array";
    }

    // 3. コードブロック内の最初のクラス名
    const codeBlockMatch = content.match(/```ruby\n(?:.*?\s)?([A-Z][a-zA-Z0-9_:]*)/);
    if (codeBlockMatch) {
      return this.normalizeTypeName(codeBlockMatch[1]);
    }

    // 4. 単純な型名 (String, Array[Integer], etc.)
    // カッコ内の型（引数）を誤って拾わないように、スペース区切りや末尾を優先
    const typeMatch = content.match(/(?:^|\s)([A-Z][a-zA-Z0-9_:]*(?:\[.*\])?)[?|]?(?:\s|$|:)/);
    if (typeMatch) {
      return this.normalizeTypeName(typeMatch[1]);
    }

    // フォールバック: カッコ内も含めて最初に見つかったクラス名
    const fallbackMatch = content.match(/([A-Z][a-zA-Z0-9_:]*(?:\[.*\])?)/);
    if (fallbackMatch) {
      return this.normalizeTypeName(fallbackMatch[1]);
    }

    // シンボルリテラル形式（例: :my_count, :string）は型名ではない。
    // TypeProf が型を特定できない場合にメソッド名などをシンボル形式で返すが、
    // これはクラス名として扱うべきではないため null を返す。
    return null;
  }

  // 型名を正規化する (ジェネリクス除去、既知の型の変換など)
  static normalizeTypeName(typeName: string | null): string | null {
    if (!typeName) return null;

    // ジェネリクス除去: Array[Integer] -> Array
    const normalized = typeName.replace(/\[.*\]$/, "");

    // 文字列リテラルや特殊な型表現の変換
    if (normalized.startsWith('"') || normalized.startsWith("'")) return "String";
    if (normalized.startsWith(":")) return "Symbol";
    if (normalized === "true" || normalized === "TrueClass") return "TrueClass";
    if (normalized === "false" || normalized === "FalseClass") return "FalseClass";
    if (normalized === "Boolean" || normalized === "bool") return "Object";

    return normalized;
  }
}
