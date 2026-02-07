// るりまリファレンスのベースURL
const RUREMA_BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
const RUREMA_SEARCH_URL = "https://rurema.clear-code.com/query:"

export class RuremaUtils {
  /**
   * メソッド名をるりま形式にエンコードする
   * @param {string} name - メソッド名
   * @returns {string} - エンコードされた文字列
   */
  static encodeMethodName(name) {
    return name
      .replace(/\=/g, "=3d") // `=` must be replaced first
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
   * シグネチャからるりまのURLを生成する
   * @param {string} signature - "Class#method" or "Class.method"
   * @returns {object} - { url, className, methodName, separator }
   */
  static generateUrlInfo(signature) {
    const isInstanceMethod = signature.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const [className, methodName] = signature.split(separator)

    const methodType = isInstanceMethod ? "i" : "s"
    const encodedMethod = this.encodeMethodName(methodName)
    const url = `${RUREMA_BASE_URL}/${className}/${methodType}/${encodedMethod}.html`

    return {
      url,
      className,
      methodName,
      separator,
      displayName: separator + methodName
    }
  }

  /**
   * 検索用URLを生成する
   * @param {string} query
   * @returns {string}
   */
  static generateSearchUrl(query) {
    return `${RUREMA_SEARCH_URL}${encodeURIComponent(query)}/`
  }
}
