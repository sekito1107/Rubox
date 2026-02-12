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
    // 2. 順にマッチするものを探す（自クラス -> 継承先 -> Object...）
    for (const ancestor of chain) {
      // 優先順位: インスタンスメソッド (#) -> 特異メソッド (.)
      const matchI = candidates.find(c => c.startsWith(`${ancestor}#`))
      if (matchI) {
        return {
          signature: matchI,
          ...URLGenerator.generateUrlInfo(matchI)
        }
      }

      const matchS = candidates.find(c => c.startsWith(`${ancestor}.`))
      if (matchS) {
        const info = URLGenerator.generateUrlInfo(matchS)
        
        // 特例: Kernelモジュールのメソッドとして検出された場合、
        // 実態がモジュール関数（かつ暗黙的メソッド）の場合はモジュール関数のURL (/m/) に誘導する
        if (ancestor === "Kernel" && (info.url.includes("/s/") || info.url.includes("/i/"))) {
           // Kernelメソッドは /i/ や /s/ ではなく /m/ で記録されていることが多いためリライト
           info.url = info.url.replace(/\/[si]\//, "/m/")
        }
        
        return {
          signature: matchS,
          ...info
        }
      }
    }

    return null
  }
}
