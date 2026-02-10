import { IndexSearcher } from "./reference/index_searcher"
import { ResolveSignature } from "./reference/resolve_signature"
import { FetchMethodList } from "./reference/fetch_method_list"

// UIコンポーネントのエクスポート
export { MethodListComponent } from "./reference/method-list"
export { CursorDocComponent } from "./reference/cursor-doc"

/**
 * Reference (リファレンス) ドメインの機能を統括するメインクラス
 */
export class Reference {
  constructor() {
    this.searcher = new IndexSearcher()
    this.resolver = new ResolveSignature(this.searcher)
    this.fetcher = new FetchMethodList(this.searcher)
  }

  /**
   * インデックスファイルを読み込む
   */
  async loadIndex() {
    return this.searcher.load()
  }

  /**
   * クラス名とメソッド名から、継承関係を考慮したシグネチャ解決を行う
   */
  resolve(className, methodName) {
    return this.resolver.resolve(className, methodName)
  }

  /**
   * 指定されたクラスに属する全メソッドと URL 情報を取得する
   */
  fetchMethods(className) {
    return this.fetcher.fetch(className)
  }
}
