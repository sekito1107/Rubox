/**
 * Rurima インデックスのエントリ型
 */
type RurimaIndex = Record<string, string[]>

/**
 * Rurima インデックスの読み込みと特定クラス/メソッドの検索を担当する
 */
export class IndexSearcher {
  private index: RurimaIndex | null = null
  private loadingPromise: Promise<void> | null = null

  constructor() {}

  /**
   * インデックス(rurima_index.json)を非同期で読み込む
   */
  async load(): Promise<void> {
    if (this.index) return

    if (this.loadingPromise) {
      await this.loadingPromise
      return
    }

    this.loadingPromise = (async () => {
      try {
        const url = "/data/rurima_index.json"
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`Server returned ${response.status} ${response.statusText} for ${url}`)
        }
        this.index = await response.json()
      } catch (error) {
        console.error("[IndexSearcher] Failed to load index:", error)
        this.index = {}
      }
    })()

    await this.loadingPromise
  }

  /**
   * メソッド名に対応するエントリを取得する
   */
  findMethod(methodName: string): string[] | null {
    if (!this.index) return null
    return this.index[methodName] || null
  }

  /**
   * 特定のクラスに属する全メソッドを抽出する
   */
  findMethodsByClass(className: string): { methodName: string; candidates: string[] }[] {
    if (!this.index) return []

    const results: { methodName: string; candidates: string[] }[] = []
    for (const [methodName, candidates] of Object.entries(this.index)) {
      const classMethods = candidates.filter(candidate => {
        return candidate.startsWith(`${className}#`) || candidate.startsWith(`${className}.`)
      })

      if (classMethods.length > 0) {
        results.push({ methodName, candidates: classMethods })
      }
    }

    return results.sort((a, b) => a.methodName.localeCompare(b.methodName))
  }
}
