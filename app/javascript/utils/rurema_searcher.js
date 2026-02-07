/**
 * RuremaSearcher (Singleton)
 * るりまインデックスの読み込みと検索を担当するユーティリティクラス
 */
class RuremaSearcher {
  constructor() {
    if (RuremaSearcher.instance) {
      return RuremaSearcher.instance
    }
    this.index = null
    RuremaSearcher.instance = this
  }

  /**
   * インデックス(rurema_index.json)を非同期で読み込む
   */
  async loadIndex() {
    if (this.index) return // 読み込み済み

    try {
      // 複数回呼ばれてもfetchは1回にするためのLock機構が必要かもしれないが、
      // 簡易的に this.loadingPromise で制御する
      if (this.loadingPromise) {
        await this.loadingPromise
        return
      }

      this.loadingPromise = (async () => {
        const response = await fetch("/data/rurema_index.json")
        this.index = await response.json()
      })()

      await this.loadingPromise
    } catch (error) {
      console.error("るりまインデックスの読み込みに失敗しました:", error)
      this.index = {}
    }
  }

  /**
   * メソッド名に対応するドキュメントエントリを検索する
   * @param {string} methodName - 検索するメソッド名 (例: "map", "each")
   * @returns {Array|null} - 見つかったエントリの配列、またはnull
   */
  findMethod(methodName) {
    if (!this.index) return null
    return this.index[methodName] || null
  }

  /**
   * 特定のクラスに属するメソッドを検索する
   * @param {string} className - クラス名 (例: "String", "Array")
   * @returns {Array} - メソッド情報の配列 { name: ".method" or "#method", entries: [...] }
   */
  findMethodsByClass(className) {
    if (!this.index) return []

    const results = []

    // インデックス全体を走査して、指定されたクラスのメソッドを探す
    for (const [methodName, candidates] of Object.entries(this.index)) {
      const classMethods = candidates.filter(candidate => {
        // "String#gsub" や "String.new" のような形式
        return candidate.startsWith(`${className}#`) || candidate.startsWith(`${className}.`)
      })

      if (classMethods.length > 0) {
        results.push({
          methodName: methodName,
          candidates: classMethods
        })
      }
    }

    return results.sort((a, b) => a.methodName.localeCompare(b.methodName))
  }
}

// シングルトンインスタンスをエクスポートするのではないが、
// new RuremaSearcher() したときに常に同じインスタンスが返るようにする。
export { RuremaSearcher }
