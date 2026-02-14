/**
 * LSP (TypeProf) のレスポンスをパースして情報を抽出するユーティリティクラス
 */
export class LSPResponseParser {
  /**
   * Hover レスポンスから Ruby のクラス名を抽出する
   * @param {string | null | undefined} markdownContent 
   * @returns {string | null}
   */
  static parseClassNameFromHover(markdownContent: string | null | undefined): string | null {
    if (!markdownContent) return null;
    const content = markdownContent.trim();

    return this._doParse(content);
  }

  private static _doParse(content: string): string | null {
    // 1. "Class#method" or "Class.method" 形式を文中から最優先で探す
    const sigMatch = content.match(/([A-Z][a-zA-Z0-9_:]*)(?:\[.*\])?[#.]/);
    if (sigMatch) {
      return this.normalizeTypeName(sigMatch[1]);
    }

    // 2. 配列/タプル形式 [Integer, String] -> Array とみなす
    if (content.startsWith("[") || content.includes(": [") || content.includes("-> [") || content.match(/^Array\[/)) {
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

    // 5. シンボルリテラル
    if (content.match(/^:[a-zA-Z0-9_!?]+$/)) {
      return "Symbol";
    }

    return null;
  }

  /**
   * 型名を正規化する (ジェネリクス除去、既知の型の変換など)
   * @param {string | null} typeName 
   * @returns {string | null}
   */
  static normalizeTypeName(typeName: string | null): string | null {
    if (!typeName) return null;
    
    // ジェネリクス除去: Array[Integer] -> Array
    const normalized = typeName.replace(/\[.*\]$/, "");
    
    // 文字列リテラルや特殊な型表現の変換
    if (normalized.startsWith('"') || normalized.startsWith("'")) return "String";
    if (normalized.startsWith(":")) return "Symbol";
    if (normalized === "true" || normalized === "TrueClass") return "TrueClass";
    if (normalized === "false" || normalized === "FalseClass") return "FalseClass";
    if (normalized === "Boolean" || normalized === "bool") return "Object"; // RurimaにBooleanは存在しないためObjectで代用
    
    // 名前空間 (::) は維持する (Rurimaインデックスと継承マップがフルネームを期待するため)
    return normalized;
  }
}
