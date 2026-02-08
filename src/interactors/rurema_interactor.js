import { RuremaSearcher } from "utils/rurema_searcher"
import { RuremaUtils } from "utils/rurema_utils"

/**
 * るりま検索とURL生成に関する責務を持つ Interactor
 * RuremaSearcher と RuremaUtils をラップし、コントローラーにドメイン固有の操作を提供する
 */
export class RuremaInteractor {
  constructor() {
    this.searcher = new RuremaSearcher()
    this._indexLoaded = false
  }

  /**
   * インデックスをロードする
   */
  async loadIndex() {
    if (this._indexLoaded) return
    await this.searcher.loadIndex()
    this._indexLoaded = true
  }

  /**
   * 主要なクラスの継承/ミックスイン関係（るりま検索用）
   */
  static INHERITANCE_MAP = {
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

  /**
   * 指定されたクラス名とメソッド名に合致するるりま情報を解決する
   * @param {string} className 
   * @param {string} methodName 
   * @returns {Object|null} { signature, url, className, methodName, separator }
   */
  resolve(className, methodName) {
    const candidates = this.searcher.findMethod(methodName)
    if (!candidates) return null

    // 1. 継承チェーンを取得
    const chain = RuremaInteractor.INHERITANCE_MAP[className] || [className, "Object", "Kernel", "BasicObject"]

    // 2. 順にマッチするものを探す（自クラス -> 継承先 -> Object...）
    for (const ancestor of chain) {
      const match = candidates.find(c => c.startsWith(`${ancestor}#`) || c.startsWith(`${ancestor}.`))
      if (match) {
        // console.log(`[RuremaInteractor] [TRACE] Found match for ${methodName} in ${ancestor}`)
        return {
          signature: match,
          ...RuremaUtils.generateUrlInfo(match)
        }
      }
    }

    return null
  }

  /**
   * 指定されたクラスのすべてのメソッドを取得し、それぞれのるりま情報（URLなど）を付与する
   * @param {string} className 
   * @returns {Array<Object>}
   */
  getMethodsWithInfo(className) {
    const methods = this.searcher.findMethodsByClass(className)
    return methods.map(item => ({
      ...item,
      // 各候補シグネチャに対するURL情報を付与
      links: item.candidates.map(cand => ({
        signature: cand,
        ...RuremaUtils.generateUrlInfo(cand)
      }))
    }))
  }

  /**
   * 検索URLを生成する
   */
  generateSearchUrl(method) {
    return RuremaUtils.generateSearchUrl(method)
  }
}
