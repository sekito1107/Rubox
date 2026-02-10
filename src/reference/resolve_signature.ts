import { URLGenerator } from "./url_generator"
import type { IndexSearcher } from "./index_searcher"

/**
 * 継承関係を考慮して、特定のメソッド名に対応する最適なるりまシグネチャを解決する
 */
export class ResolveSignature {
  // 主要なクラスの継承/ミックスイン関係
  static readonly INHERITANCE_MAP: Record<string, string[]> = {
    "Array": ["Array", "Enumerable", "Object", "Kernel", "BasicObject"],
    "String": ["String", "Comparable", "Object", "Kernel", "BasicObject"],
    "Hash": ["Hash", "Enumerable", "Object", "Kernel", "BasicObject"],
    "Integer": ["Integer", "Numeric", "Comparable", "Object", "Kernel", "BasicObject"],
    "Float": ["Float", "Numeric", "Comparable", "Object", "Kernel", "BasicObject"],
    "Symbol": ["Symbol", "Comparable", "Object", "Kernel", "BasicObject"],
    "Range": ["Range", "Enumerable", "Object", "Kernel", "BasicObject"],
    "Enumerator": ["Enumerator", "Enumerable", "Object", "Kernel", "BasicObject"],
    "Module": ["Module", "Object", "Kernel", "BasicObject"],
    "Class": ["Class", "Module", "Object", "Kernel", "BasicObject"]
  }

  private searcher: IndexSearcher

  constructor(indexSearcher: IndexSearcher) {
    this.searcher = indexSearcher
  }

  /**
   * クラス名とメソッド名からるりま情報を解決する
   */
  resolve(className: string, methodName: string): {
    signature: string
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } | null {
    const candidates = this.searcher.findMethod(methodName)
    if (!candidates) return null

    // 1. 継承チェーンを取得 (継承マップにない場合は Object 系をデフォルトとする)
    const chain = ResolveSignature.INHERITANCE_MAP[className] || [className, "Object", "Kernel", "BasicObject"]

    // 2. 順にマッチするものを探す（自クラス -> 継承先 -> Object...）
    for (const ancestor of chain) {
      const match = candidates.find(c => c.startsWith(`${ancestor}#`) || c.startsWith(`${ancestor}.`))
      if (match) {
        return {
          signature: match,
          ...URLGenerator.generateUrlInfo(match)
        }
      }
    }

    return null
  }
}
