// 公式リファレンス特有の URL エンコードと生成を行うユーティリティ
export class URLGenerator {
  static readonly BASE_URL = "https://docs.ruby-lang.org/ja/latest/method"
  static readonly SEARCH_URL = "https://rurema.clear-code.com/query:"

  // メソッド名を公式リファレンスの形式にエンコードする
  static encodeMethodName(name: string): string {
    return name
      .replace(/=/g, "=3d")
      .replace(/\[/g, "=5b").replace(/\]/g, "=5d")
      .replace(/\+/g, "=2b").replace(/-/g, "=2d")
      .replace(/\*/g, "=2a").replace(/\//g, "=2f")
      .replace(/%/g, "=25").replace(/</g, "=3c")
      .replace(/>/g, "=3e")
      .replace(/!/g, "=21").replace(/\?/g, "=3f")
      .replace(/~/g, "=7e").replace(/\^/g, "=5e")
      .replace(/&/g, "=26").replace(/\|/g, "=7c")
      .replace(/`/g, "=60")
  }

  // クラス名、メソッド名、区切り文字から直接URL情報を生成する
  static generateUrlInfoFromComponents(className: string, methodName: string, separator: string): {
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } {
    const methodType = separator === "#" ? "i" : "s"
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

  // シグネチャから公式リファレンスのURL情報を生成する
  // signature: "Class#method" or "Class.method" 
  // (引数情報などが含まれている場合、それらは無視する)
  static generateUrlInfo(signature: string): {
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } {
    // 引数情報などを削除 (例: "String#gsub(pattern, replacement)" -> "String#gsub")
    const cleanSignature = signature.split("(")[0].trim()

    const isInstanceMethod = cleanSignature.includes("#")
    const separator = isInstanceMethod ? "#" : "."
    const parts = cleanSignature.split(separator)
    
    // スプリット結果が想定外（要素数が2未満など）の場合は安全策をとる
    if (parts.length < 2) {
      // 最低限のエラー回避。本来は呼び出し側でチェックすべきだが、
      // ここでは既存の動作を壊さないように空文字などで対応するか、
      // あるいはそのまま処理して致命的なエラーにならないようにする。
      // ここでは、分割できない場合はそのまま返す（ただしURL生成は失敗する可能性が高い）
      // 既存ロジックを踏襲しつつ、最低限のガードを入れるなら:
      console.warn(`Invalid signature format: ${signature}`)
    }

    const className = parts[0]
    // メソッド名に余計なものがついていないか確認（.splitの挙動次第だが、
    // separatorが複数あるケースは稀。もしあれば最後をメソッド名とするか、
    // 最初の方をクラス名とするか。ここは既存通り[1]をメソッド名とするが、
    // partsが2つ以上あることを前提とする）
    const methodName = parts.slice(1).join(separator)

    return this.generateUrlInfoFromComponents(className, methodName, separator)
  }

  // 検索用URLを生成する
  static generateSearchUrl(query: string): string {
    return `${this.SEARCH_URL}${encodeURIComponent(query)}/`
  }
}
