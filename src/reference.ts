import { ResolveSignature } from "./reference/resolve_signature"
import { FetchMethodList } from "./reference/fetch_method_list"

// UIコンポーネントのエクスポート
export { MethodListComponent } from "./reference/method-list"
export { CursorDocComponent } from "./reference/cursor-doc"

/**
 * Reference (リファレンス) ドメインの機能を統括するメインクラス
 */
export class Reference {
  private resolver: ResolveSignature
  private fetcher: FetchMethodList

  constructor(lspClient: any) {
    this.resolver = new ResolveSignature(lspClient)
    this.fetcher = new FetchMethodList(lspClient)
  }

  /**
   * インデックスファイルを読み込む (現在は不要だが互換性のために残す)
   */
  async loadIndex(): Promise<void> {
    // 以前はJSONをロードしていたが、現在はRuby側で解決するため何もしない
    return
  }

  /**
   * クラス名とメソッド名から、継承関係を考慮したシグネチャ解決を行う
   */
  async resolve(className: string, methodName: string) {
    return this.resolver.resolve(className, methodName)
  }

  /**
   * 指定されたクラスに属する全メソッドと URL 情報を取得する
   */
  async fetchMethods(className: string) {
    return this.fetcher.fetch(className)
  }
}
