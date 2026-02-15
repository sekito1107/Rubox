/**
 * Rurima インデックスのエントリ型
 */
type RurimaIndex = Record<string, string[]>

/**
 * Rurima インデックスの読み込みと特定クラス/メソッドの検索を担当する
 */
export class IndexSearcher {
  private index: RurimaIndex | null = null
  private inheritanceMap: Record<string, string[]> | null = null
  private loadingPromise: Promise<void> | null = null

  constructor() {}

  /**
   * インデックス(rurima_index.json)および継承マップ(inheritance_map.json)を非同期で読み込む
   */
  async load(): Promise<void> {
    if (this.index && this.inheritanceMap) return

    if (this.loadingPromise) {
      await this.loadingPromise
      return
    }

    this.loadingPromise = (async () => {
      try {
        const [indexRes, inheritanceRes] = await Promise.all([
          fetch("/data/rurima_index.json"),
          fetch("/data/inheritance_map.json")
        ])

        if (!indexRes.ok) {
          throw new Error(`Server returned ${indexRes.status} for rurima_index.json`)
        }
        if (!inheritanceRes.ok) {
          throw new Error(`Server returned ${inheritanceRes.status} for inheritance_map.json`)
        }

        const [index, inheritanceMap] = await Promise.all([
          indexRes.json(),
          inheritanceRes.json()
        ])

        this.index = index
        this.inheritanceMap = inheritanceMap
        this.index = index
        this.inheritanceMap = inheritanceMap
      } catch (error) {
        this.index = this.index || {}
        this.inheritanceMap = this.inheritanceMap || {}
      }
    })()

    await this.loadingPromise
  }

  /**
   * 特定のクラスの継承チェーンを取得する
   */
  getInheritanceChain(className: string): string[] | null {
    if (!this.inheritanceMap) return null
    return this.inheritanceMap[className] || null
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
