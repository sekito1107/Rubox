/**
 * Rurima (るりま) 特有の URL エンコードと生成を行うユーティリティ
 */
export class URLGenerator {
  static BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
  static SEARCH_URL = "https://rurema.clear-code.com/query:"

  /**
   * メソッド名をるりま形式にエンコードする
   */
  static encodeMethodName(name) {
    return name
      .replace(/\=/g, "=3d")
      .replace(/\[/g, "=5b").replace(/\]/g, "=5d")
      .replace(/\+/g, "=2b").replace(/\-/g, "=2d")
      .replace(/\*/g, "=2a").replace(/\//g, "=2f")
      .replace(/\%/g, "=25").replace(/\</g, "=3c")
      .replace(/\>/g, "=3e")
      .replace(/\!/g, "=21").replace(/\?/g, "=3f")
      .replace(/\~/g, "=7e").replace(/\^/g, "=5e")
      .replace(/\&/g, "=26").replace(/\|/g, "=7c")
      .replace(/\`/g, "=60")
  }

  /**
   * シグネチャからるりまの URL 情報を生成する
   * @param {string} signature - "Class#method" or "Class.method"
   */
  static generateUrlInfo(signature) {
    const isInstanceMethod = signature.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const [className, methodName] = signature.split(separator)

    const methodType = isInstanceMethod ? "i" : "s"
    const encodedMethod = this.encodeMethodName(methodName)
    const url = `${this.BASE_URL}/${className}/${methodType}/${encodedMethod}.html`

    return {
      url,
      className,
      methodName,
      separator,
      displayName: separator + methodName
    }
  }

  /**
   * 検索用 URL を生成する
   */
  static generateSearchUrl(query) {
    return `${this.SEARCH_URL}${encodeURIComponent(query)}/`
  }
}
