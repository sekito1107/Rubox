import { URLGenerator } from "./url_generator"
import type { LSPClient } from "../lsp/client"

/**
 * Ruby VM (RBS) を使用して、特定のメソッド名に対応する最適なるりまシグネチャを解決する
 */
export class ResolveSignature {
  private client: LSPClient

  constructor(lspClient: LSPClient) {
    this.client = lspClient
  }

  /**
   * クラス名とメソッド名からるりま情報を解決する
   */
  async resolve(className: string, methodName: string): Promise<{
    signature: string
    url: string
    className: string
    methodName: string
    separator: string
    displayName: string
  } | null> {
    try {
      // Ruby VM (server.rb) の rubbit.resolveSignature コマンドを呼び出す
      const result = await this.client.sendRequest("workspace/executeCommand", {
        command: "rubbit.resolveSignature",
        arguments: [className, methodName]
      })

      if (!result || !result.signature) {
        return null
      }

      const info = URLGenerator.generateUrlInfo(result.signature)
      
      // 特例: Kernelモジュールのメソッドとして検出された場合、
      // 実態がモジュール関数（かつ暗黙的メソッド）の場合はモジュール関数のURL (/m/) に誘導する
      if (result.className === "Kernel" && (info.url.includes("/s/") || info.url.includes("/i/"))) {
          info.url = info.url.replace(/\/[si]\//, "/m/")
      }

      return {
        signature: result.signature,
        ...info
      }
    } catch (e) {
      console.error("Failed to resolve signature via Ruby VM:", e)
      return null
    }
  }
}
