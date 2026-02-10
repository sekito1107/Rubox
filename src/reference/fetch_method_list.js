import { URLGenerator } from "./url_generator"

/**
 * 指定されたクラスのメソッド一覧を取得し、URL情報を付与する
 */
export class FetchMethodList {
  constructor(indexSearcher) {
    this.searcher = indexSearcher
  }

  /**
   * クラス名からメソッド一覧（URL情報付き）を取得する
   */
  fetch(className) {
    const methods = this.searcher.findMethodsByClass(className)
    return methods.map(item => ({
      ...item,
      links: item.candidates.map(cand => ({
        signature: cand,
        ...URLGenerator.generateUrlInfo(cand)
      }))
    }))
  }
}
