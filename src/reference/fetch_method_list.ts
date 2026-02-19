import { URLGenerator } from "./url_generator"
import type { LSPClient } from "../lsp/client"

// 指定されたクラスのメソッド一覧を取得し、URL情報を付与する
export class FetchMethodList {
  private client: LSPClient

  constructor(lspClient: LSPClient) {
    this.client = lspClient
  }

  // クラス名からメソッド一覧（URL情報付き）を取得する
  async fetch(className: string): Promise<{
    methodName: string
    candidates: string[]
    links: {
      signature: string
      url: string
      className: string
      methodName: string
      separator: string
      displayName: string
    }[]
  }[]> {
    try {
      const result = await this.client.sendRequest("workspace/executeCommand", {
        command: "rubox.fetchMethods",
        arguments: [className]
      })

      if (!result || !Array.isArray(result)) {
        return []
      }

      return result.map((item: any) => ({
        methodName: item.methodName,
        candidates: item.candidates,
        links: item.candidates.map((cand: string) => ({
          signature: cand,
          ...URLGenerator.generateUrlInfo(cand)
        }))
      }))
    } catch {
      return []
    }
  }
}
